import { type NextRequest } from "next/server";

/**
 * App-theme proxy (BFF). The console reads and flips the mobile app's active theme through the
 * backend's `GET|PATCH /api/v1/meta/theme` endpoints. Those are *public* on the backend today
 * (they carry no secret — the app fetches the theme before login), but the console still calls them
 * same-origin through this proxy so:
 *   1. there is no cross-origin/CORS preflight on the PATCH, and
 *   2. we attach `X-Operator-Secret` server-side, so the moment the backend puts the PATCH behind
 *      OperatorGuard (recommended before prod — see the meta controller note), the console keeps
 *      working with zero client changes and the secret never reaches the browser.
 *
 * Unlike `/api/admin/*`, this does NOT forward the caller's Bearer token — the meta endpoints don't
 * use the user scope. Only logged-in console users can reach this route (the (admin) layout gates it).
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

async function forward(request: NextRequest): Promise<Response> {
  const target = `${BACKEND_BASE_URL}/meta/theme`;

  const headers: Record<string, string> = { Accept: "application/json" };
  // Attached even though the endpoint is public today — harmless now, and ready the instant the
  // backend guards the write. The secret stays server-side.
  const secret = process.env.OPERATOR_SECRET;
  if (secret) headers["X-Operator-Secret"] = secret;

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let body: string | undefined;
  if (hasBody) {
    body = await request.text();
    if (body.length === 0) body = undefined;
    if (body) headers["Content-Type"] = "application/json";
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

export { forward as GET, forward as PATCH };
