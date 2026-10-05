import { type NextRequest } from "next/server";
import { isGatewayEnv, type GatewayEnv } from "@/types/gateway";

/**
 * API-gateway cutover proxy (BFF), one route for every environment's gateway.
 *
 * A gateway (api-gateway repo) is the switch that repoints an environment's app builds between
 * Sharetribe and the v2 wrapper. There is one per environment — production
 * (api-gateway.mypastel.com) and staging (staging.api-gateway.mypastel.com) — each with its own
 * static admin token that must NEVER reach the browser. The console therefore calls
 * `/api/gateway/<env>/target` same-origin and this handler attaches the matching token server-side.
 *
 * WHY THIS TALKS TO THE GATEWAY DIRECTLY (not via the backend)
 * This switch's most important job is ROLLBACK — flip back to Sharetribe precisely because the
 * wrapper/backend is misbehaving. Routing the flip through the backend would make it unavailable
 * exactly when it's needed. So the flip leg depends only on the gateway being reachable.
 *
 * AUTHORISATION
 * The gateway itself only checks its own token; it has no notion of WHO is flipping. So before we
 * ever spend that token, we verify the caller's operator session against the backend
 * (`GET /admin/auth/me`) and require the `superAdmin` role — for staging too, so the two switches
 * behave identically and nobody learns the habit on the harmless one. (Auth verification uses the
 * backend, which the operator already logged into; the flip itself does not. A total backend outage
 * falls back to the documented curl/Postman break-glass in the gateway repo's CUTOVER.md.)
 *
 * Routes (both require a Bearer token + superAdmin; `env` is `production` | `staging`):
 *   GET  /api/gateway/{env}/target  → gateway GET  /gateway/status  → GatewayStatus
 *   POST /api/gateway/{env}/target  → gateway POST /gateway/target  → GatewayFlipResult
 *     body: { "target": "wrapper" | "sharetribe" }
 *
 * Environment variables (server-only, no NEXT_PUBLIC prefix):
 *   production: GATEWAY_API_URL          + GATEWAY_ADMIN_TOKEN
 *   staging:    GATEWAY_STAGING_API_URL  + GATEWAY_STAGING_ADMIN_TOKEN
 * An environment whose variables are unset renders a clear "not configured" error in its card and
 * cannot be switched; the other environment keeps working.
 */

type GatewayEnvConfig = {
  baseUrl: string;
  adminToken: string;
  /** Variable names, for the operator-facing "missing X" error. */
  urlVar: string;
  tokenVar: string;
};

function readEnvConfig(env: GatewayEnv): GatewayEnvConfig {
  const vars =
    env === "production"
      ? { urlVar: "GATEWAY_API_URL", tokenVar: "GATEWAY_ADMIN_TOKEN" }
      : { urlVar: "GATEWAY_STAGING_API_URL", tokenVar: "GATEWAY_STAGING_ADMIN_TOKEN" };
  return {
    baseUrl: (process.env[vars.urlVar] ?? "").replace(/\/+$/, ""),
    adminToken: process.env[vars.tokenVar] ?? "",
    ...vars,
  };
}

const BACKEND_BASE_URL = (
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3500/api/v1"
).replace(/\/+$/, "");

const VALID_TARGETS = new Set(["sharetribe", "wrapper"]);

type RouteContext = { params: Promise<{ env: string }> };

/** Mirrors the backend envelope so proxy-level failures render like any other ApiError. */
function envelopeError(status: number, message: string): Response {
  return Response.json(
    { status: false, message, errors: { value: [], meta: { statusCode: status } } },
    { status }
  );
}

/** Wraps a raw gateway payload in the success envelope the console's `envelopeFetch` expects. */
function envelopeOk(message: string, value: unknown): Response {
  return Response.json({ status: true, message, data: { value, meta: {} } }, { status: 200 });
}

/**
 * Verify the caller is a signed-in superAdmin before the gateway token is ever spent.
 * Returns a Response to short-circuit on failure, or null when the caller is authorised.
 */
async function requireSuperAdmin(request: NextRequest): Promise<Response | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return envelopeError(401, "Authentication required");
  }

  let identity: Response;
  try {
    identity = await fetch(`${BACKEND_BASE_URL}/admin/auth/me`, {
      headers: { Accept: "application/json", Authorization: authorization },
      cache: "no-store",
    });
  } catch {
    return envelopeError(502, "Could not verify your session — the backend is unreachable.");
  }

  // 401 → let the console refresh and retry; anything else non-OK → not (or no longer) an operator.
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
    return envelopeError(403, "Switching the backend requires the super admin role.");
  }
  return null;
}

/**
 * Guard shared by both verbs: env segment → config → env sanity → superAdmin.
 * Returns the resolved config, or a Response to short-circuit.
 */
async function preflight(
  request: NextRequest,
  ctx: RouteContext
): Promise<GatewayEnvConfig | Response> {
  const { env } = await ctx.params;
  if (!isGatewayEnv(env)) {
    return envelopeError(404, "Unknown gateway environment. Use production or staging.");
  }
  const config = readEnvConfig(env);
  if (!config.baseUrl) {
    return envelopeError(
      500,
      `The console is missing ${config.urlVar}. Set it in the environment to enable the ${env} switch.`
    );
  }
  if (!config.adminToken) {
    return envelopeError(
      500,
      `The console is missing ${config.tokenVar}. Set it in the environment to enable the ${env} switch.`
    );
  }
  const blocked = await requireSuperAdmin(request);
  return blocked ?? config;
}

export async function GET(request: NextRequest, ctx: RouteContext): Promise<Response> {
  const config = await preflight(request, ctx);
  if (config instanceof Response) return config;

  let upstream: Response;
  try {
    upstream = await fetch(`${config.baseUrl}/gateway/status`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return envelopeError(502, "Could not reach the API gateway. Check that it is up.");
  }
  if (!upstream.ok) {
    return envelopeError(502, `The gateway returned ${upstream.status} for its status.`);
  }
  return envelopeOk("Gateway status fetched.", await upstream.json());
}

export async function POST(request: NextRequest, ctx: RouteContext): Promise<Response> {
  const config = await preflight(request, ctx);
  if (config instanceof Response) return config;

  let target: unknown;
  try {
    const body = (await request.json()) as { target?: unknown };
    target = body?.target;
  } catch {
    return envelopeError(400, 'Body must be JSON: { "target": "wrapper" | "sharetribe" }.');
  }
  if (typeof target !== "string" || !VALID_TARGETS.has(target)) {
    return envelopeError(400, "target must be one of: sharetribe, wrapper.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${config.baseUrl}/gateway/target`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Gateway-Admin-Token": config.adminToken,
      },
      body: JSON.stringify({ target }),
      cache: "no-store",
    });
  } catch {
    return envelopeError(502, "Could not reach the API gateway. The switch was NOT changed.");
  }

  // 404 here means the gateway has no admin token set (flip surface hidden); 403 = our token is
  // wrong. Translate to something the operator can act on rather than a raw gateway error.
  if (upstream.status === 404) {
    return envelopeError(502, "The gateway has runtime flipping disabled (no admin token set on it).");
  }
  if (upstream.status === 403) {
    return envelopeError(502, `The gateway rejected the admin token — check ${config.tokenVar}.`);
  }
  if (!upstream.ok) {
    return envelopeError(502, `The gateway refused the switch (${upstream.status}).`);
  }

  return envelopeOk("Backend switched.", await upstream.json());
}
