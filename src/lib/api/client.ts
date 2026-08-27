/**
 * Thin fetch wrapper for the Pastel backend.
 *
 * Every endpoint answers with the same envelope:
 *   success — { status: true,  message, data:   { value, meta } }
 *   failure — { status: false, message, errors: { value: [{ field, message }], meta } }
 *
 * `apiFetch` unwraps `data.value` on success and throws `ApiError` on anything else, so callers
 * deal in payloads and typed errors only. Requests carry `credentials: "include"` because the
 * backend keeps the refresh token in the httpOnly `pa_rt` cookie (path `/api/v1/auth`).
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

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON-serialized as the request body. Pass `{}` for cookie-driven POSTs like /auth/refresh. */
  body?: unknown;
  /** Sent as `Authorization: Bearer <token>` when the endpoint requires the `user` scope. */
  accessToken?: string;
};

/** Calls `${API_BASE_URL}${path}` and resolves with the envelope's `data.value`. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
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

  return envelope.data.value;
}
