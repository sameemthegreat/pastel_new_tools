import { apiFetch } from "@/lib/api/client";
import type {
  AccessToken,
  AdminSession,
  OperatorIdentity,
} from "@/types/auth";

/**
 * Auth endpoints the admin console uses. Session lifecycle is cookie-driven on web: login sets the
 * httpOnly `pa_rt` refresh cookie, `refresh` and `logout` read it — the console only ever holds the
 * short-lived access token in memory (see `src/stores/authStore.ts`).
 */

/**
 * POST /admin/auth/login — operator sign-in.
 * 401: wrong email/password · 403: banned account or no active AdminMembership · 429: throttled.
 *
 * NOT `/auth/login`: that is the marketplace endpoint, which happily signs in any customer and
 * returns no `adminRole`. Operator standing has to be established at the door — the console must
 * never hold a session it will then hand the operator secret on behalf of.
 */
export function loginToAdminConsole(email: string, password: string): Promise<AdminSession> {
  return apiFetch<AdminSession>("/admin/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

/**
 * GET /admin/auth/me — the signed-in operator plus their role; the session-restore call.
 * 401: token expired (refresh first) · 403: not (or no longer) an operator.
 */
export function fetchOperatorIdentity(accessToken: string): Promise<OperatorIdentity> {
  return apiFetch<OperatorIdentity>("/admin/auth/me", { accessToken });
}

/** POST /auth/refresh — rotates the `pa_rt` cookie and returns a fresh access token. 401: signed out. */
export function refreshAccessToken(): Promise<AccessToken> {
  return apiFetch<AccessToken>("/auth/refresh", { method: "POST", body: {} });
}

/** POST /auth/logout — revokes the refresh token and clears the session cookies. Idempotent. */
export function revokeSession(): Promise<null> {
  return apiFetch<null>("/auth/logout", { method: "POST", body: {} });
}

/**
 * POST /auth/password/forgot — emails a reset magic link. Deliberately not an enumeration oracle:
 * the response is identical whether or not an account exists, so always confirm neutrally.
 */
export function requestPasswordReset(email: string): Promise<unknown> {
  return apiFetch<unknown>("/auth/password/forgot", { method: "POST", body: { email } });
}
