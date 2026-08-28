import { type NextRequest } from "next/server";

/**
 * Operator proxy (BFF). Every admin data endpoint on the backend sits behind OperatorGuard,
 * which demands the `X-Operator-Secret` header on top of the caller's Bearer token. That secret
 * must never reach the browser, so the console calls `/api/admin/*` same-origin and this handler
 * forwards to `${BACKEND}/admin/*`, attaching the secret server-side.
 *
 * Only the caller's Authorization header and JSON body are forwarded — cookies are not, so the
 * refresh-token cookie never transits the proxy. Auth endpoints (login/refresh/logout) keep
 * calling the backend directly; only operator data flows through here.
 */

const BACKEND_BASE_URL = (
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3500/api/v1"
).replace(/\/+$/, "");

/** Mirrors the backend envelope so proxy-level failures render like any other ApiError. */
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
  const secret = process.env.OPERATOR_SECRET;
  if (!secret) {
    return envelopeError(
      500,
      "The console is missing its OPERATOR_SECRET. Set it in the deployment environment."
    );
  }

  const { path } = await ctx.params;
  const search = request.nextUrl.search;
  const target = `${BACKEND_BASE_URL}/admin/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Operator-Secret": secret,
  };
  const authorization = request.headers.get("authorization");
  if (authorization) headers.Authorization = authorization;
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  // Forward the body VERBATIM with its own content type — JSON and multipart uploads alike.
  // (Reading multipart as text would corrupt the bytes and drop the boundary parameter.)
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
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return envelopeError(502, "Could not reach the Pastel API. Check that the backend is up.");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
