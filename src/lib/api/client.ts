/**
 * Thin fetch wrapper for the Pastel backend.
 *
 * Every endpoint answers with the same envelope:
 *   success — { status: true,  message, data:   { value, meta } }
 *   failure — { status: false, message, errors: { value: [{ field, message }], meta } }
 *
 * Two transports share the core:
 *   - `apiFetch` — direct to the backend (auth endpoints; carries the refresh cookie).
 *   - `adminFetch` / `adminFetchPage` (in `admin.ts`) — same-origin through the `/api/admin/*`
 *     proxy that attaches the operator secret server-side.
 */

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3500/api/v1"
).replace(/\/+$/, "");

/** Per-field validation failure, as emitted by the backend's validation exception factory. */
export type FieldError = { field: string; message: string };

/** Any non-success outcome: HTTP error, failure envelope, unreachable API, or malformed body. */
export class ApiError extends Error {
  /** HTTP status of the response, or 0 when the API could not be reached at all. */
  readonly status: number;
  /** Field-level validation errors (`errors.value`); empty for non-validation failures. */
  readonly fieldErrors: FieldError[];

  constructor(status: number, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type SuccessEnvelope<T> = {
  status: true;
  message: string;
  data: { value: T; meta: Record<string, unknown> };
};

type ErrorEnvelope = {
  status: false;
  message: string;
  errors?: { value?: FieldError[]; meta?: Record<string, unknown> };
};

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON-serialized as the request body. Pass `{}` for cookie-driven POSTs like /auth/refresh. */
  body?: unknown;
  /** Sent as `Authorization: Bearer <token>` when the endpoint requires the `user` scope. */
  accessToken?: string;
  /** Extra request headers, e.g. `Idempotency-Key` on money endpoints. */
  headers?: Record<string, string>;
};

/** Core transport: resolves with the whole `data` block (`value` + `meta`), throws `ApiError`. */
export async function envelopeFetch<T>(
  url: string,
  options: RequestOptions = {}
): Promise<{ value: T; meta: Record<string, unknown> }> {
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Could not reach the Pastel API. Check your connection and try again.");
  }

  let envelope: SuccessEnvelope<T> | ErrorEnvelope | null = null;
  try {
    envelope = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  } catch {
    // fall through — a body-less or non-JSON reply is handled below by status code
  }

  if (!envelope || envelope.status !== true || !response.ok) {
    const message =
      (envelope && envelope.message) ||
      (response.status === 429
        ? "Too many attempts. Wait a minute and try again."
        : "The Pastel API returned an unexpected response.");
    const fieldErrors =
      envelope && envelope.status === false ? (envelope.errors?.value ?? []) : [];
    throw new ApiError(response.status, message, fieldErrors);
  }

  return envelope.data;
}

/** Calls `${API_BASE_URL}${path}` directly and resolves with the envelope's `data.value`. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { value } = await envelopeFetch<T>(`${API_BASE_URL}${path}`, options);
  return value;
}
