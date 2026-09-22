import { type NextRequest } from "next/server";

/**
 * Migration control-plane proxy (BFF). Twin of `/api/admin/*`, but forwards to the
 * separate FastAPI migration service (MIGRATION_API_URL) instead of the main backend.
 *
 * The migration API reuses the SAME operator identity as the backend: it verifies the
 * operator's Bearer token and demands the `X-Operator-Secret` second factor. That secret
 * must never reach the browser, so the console calls `/api/migration/*` same-origin and
 * this handler attaches it server-side — and only ever onto a request that already carries
 * a Bearer token, so the secret is never spent for an unidentified caller.
 */

const MIGRATION_BASE_URL = (process.env.MIGRATION_API_URL ?? "").replace(/\/+$/, "");

function envelopeError(status: number, message: string): Response {
  return Response.json(
    { status: false, message, errors: { value: [], meta: { statusCode: status } } },
    { status }
  );
}

async function forward(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  if (!MIGRATION_BASE_URL) {
    return envelopeError(
      500,
      "The console is missing MIGRATION_API_URL. Set it in the deployment environment."
    );
  }
  const secret = process.env.OPERATOR_SECRET;
  if (!secret) {
    return envelopeError(
      500,
      "The console is missing its OPERATOR_SECRET. Set it in the deployment environment."
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return envelopeError(401, "Authentication required");
  }

  const { path } = await ctx.params;
  const search = request.nextUrl.search;
  const target = `${MIGRATION_BASE_URL}/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: authorization,
    "X-Operator-Secret": secret,
  };

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
    return envelopeError(502, "Could not reach the migration service. Check that it is up.");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
