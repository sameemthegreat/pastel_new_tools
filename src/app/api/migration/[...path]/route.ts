import { type NextRequest } from "next/server";
import { isMigrationTarget, type MigrationTarget } from "@/types/migration";

/**
 * Migration control-plane proxy (BFF). Twin of `/api/admin/*`, but forwards to a FastAPI
 * migration service instead of the main backend — one per TARGET environment:
 *
 *   primary  MIGRATION_API_URL          — the control plane beside the backend this console is
 *                                           signed into (dev → api-v1-new's database)
 *   staging  MIGRATION_STAGING_API_URL  — the staging control plane (api-staging-new's database)
 *
 * The client picks the target with `?__target=primary|staging` (omitted = primary, so the
 * original single-environment URLs are unchanged). The param is stripped before forwarding.
 *
 * AUTHENTICATION — two legs, because the two services trust different things:
 *
 * primary: the migration API reuses the SAME operator identity as the backend the console logs
 * into. It verifies the operator's Bearer token and demands the `X-Operator-Secret` second
 * factor. That secret must never reach the browser, so this handler attaches it server-side —
 * and only onto a request that already carries a Bearer token, so the secret is never spent
 * for an unidentified caller.
 *
 * staging: the staging service lives next to a DIFFERENT backend, with its own JWT_SECRET and
 * its own AdminMembership table (which a migration run truncates anyway). The console's
 * operator token cannot pass there. So this leg uses the cross-backend bridge — the same
 * contract the backend's OperatorGuard offers for dual-run (`X-Cross-Backend-Secret`): the
 * staging migration API acts as its own superAdmin when the shared secret matches. Because
 * that header alone is the whole credential on the far side, this handler first verifies the
 * caller is a signed-in superAdmin on OUR backend (`GET /admin/auth/me`) before spending it —
 * the staging target is exactly as gated as a dev run, just enforced here instead of there.
 */

const BACKEND_BASE_URL = (
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3500/api/v1"
).replace(/\/+$/, "");

type TargetConfig =
  | { kind: "operator"; baseUrl: string; operatorSecret: string }
  | { kind: "cross-backend"; baseUrl: string; crossBackendSecret: string };

function envelopeError(status: number, message: string): Response {
  return Response.json(
    { status: false, message, errors: { value: [], meta: { statusCode: status } } },
    { status }
  );
}

/** Resolve the env for a target, or a Response explaining which variable is missing. */
function resolveTarget(target: MigrationTarget): TargetConfig | Response {
  if (target === "primary") {
    const baseUrl = (process.env.MIGRATION_API_URL ?? "").replace(/\/+$/, "");
    const operatorSecret = process.env.OPERATOR_SECRET ?? "";
    if (!baseUrl) {
      return envelopeError(
        500,
        "The console is missing MIGRATION_API_URL. Set it in the deployment environment."
      );
    }
    if (!operatorSecret) {
      return envelopeError(
        500,
        "The console is missing its OPERATOR_SECRET. Set it in the deployment environment."
      );
    }
    return { kind: "operator", baseUrl, operatorSecret };
  }

  const baseUrl = (process.env.MIGRATION_STAGING_API_URL ?? "").replace(/\/+$/, "");
  const crossBackendSecret = process.env.MIGRATION_STAGING_CROSS_BACKEND_SECRET ?? "";
  if (!baseUrl || !crossBackendSecret) {
    return envelopeError(
      501,
      "The staging migration target isn't configured. Set MIGRATION_STAGING_API_URL and MIGRATION_STAGING_CROSS_BACKEND_SECRET."
    );
  }
  return { kind: "cross-backend", baseUrl, crossBackendSecret };
}

/**
 * Verify the caller is a signed-in superAdmin on our own backend. Used only for the
 * cross-backend leg, where the far side cannot check who is calling. Returns a Response to
 * short-circuit on failure, or null when the caller is authorised.
 */
async function requireSuperAdmin(authorization: string): Promise<Response | null> {
  let identity: Response;
  try {
    identity = await fetch(`${BACKEND_BASE_URL}/admin/auth/me`, {
      headers: { Accept: "application/json", Authorization: authorization },
      cache: "no-store",
    });
  } catch {
    return envelopeError(502, "Could not verify your session — the backend is unreachable.");
  }
  if (identity.status === 401) return envelopeError(401, "Your session has expired. Sign in again.");
  if (!identity.ok) return envelopeError(403, "Operator verification failed.");

  let role: unknown;
  try {
    const body = (await identity.json()) as { data?: { value?: { adminRole?: unknown } } };
    role = body?.data?.value?.adminRole;
  } catch {
    return envelopeError(502, "The backend returned an unexpected session response.");
  }
  if (role !== "superAdmin") {
    return envelopeError(403, "Driving the staging migration requires the super admin role.");
  }
  return null;
}

async function forward(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return envelopeError(401, "Authentication required");
  }

  // `__target` is ours; everything else is forwarded verbatim.
  const forwardParams = new URLSearchParams(request.nextUrl.searchParams);
  const rawTarget = forwardParams.get("__target") ?? "primary";
  forwardParams.delete("__target");
  if (!isMigrationTarget(rawTarget)) {
    return envelopeError(400, "__target must be one of: primary, staging.");
  }
  const config = resolveTarget(rawTarget);
  if (config instanceof Response) return config;

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: authorization,
  };
  if (config.kind === "operator") {
    headers["X-Operator-Secret"] = config.operatorSecret;
  } else {
    const blocked = await requireSuperAdmin(authorization);
    if (blocked) return blocked;
    headers["X-Cross-Backend-Secret"] = config.crossBackendSecret;
  }

  const { path } = await ctx.params;
  const search = forwardParams.toString() ? `?${forwardParams.toString()}` : "";
  const target = `${config.baseUrl}/${path.map(encodeURIComponent).join("/")}${search}`;

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    body = await request.arrayBuffer();
    if (body.byteLength === 0) body = undefined;
    const contentType = request.headers.get("content-type");
    if (body && contentType) headers["Content-Type"] = contentType;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: request.method, headers, body, cache: "no-store" });
  } catch {
    return envelopeError(
      502,
      `Could not reach the ${rawTarget} migration service. Check that it is up.`
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
