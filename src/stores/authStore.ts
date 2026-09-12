import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import {
  fetchOperatorIdentity,
  loginToAdminConsole,
  refreshAccessToken,
  revokeSession,
} from "@/lib/api/auth";
import type { AdminCapability, AdminRole, ApiUser } from "@/types/auth";

/** The signed-in operator, projected for the console's chrome (sidebar card, RBAC gates, audit names). */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  /** What this operator may do, as told by the backend — never derived from `role` here. */
  capabilities: AdminCapability[];
};

/**
 * idle → the store has not yet tried to restore a session (initial page load).
 * restoring → cookie refresh + operator lookup in flight; hold rendering, don't redirect yet.
 */
type AuthStatus = "idle" | "restoring" | "authenticated" | "unauthenticated";

type AuthState = {
  status: AuthStatus;
  user: SessionUser | null;
  /**
   * Short-lived bearer token, held in memory only — never persisted, so a fresh tab restores via
   * the httpOnly `pa_rt` refresh cookie instead (see `restore`).
   */
  accessToken: string | null;
  /** Signs in against POST /admin/auth/login. Rejects with `ApiError` for the form to render. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Clears the session immediately; token revocation completes in the background (idempotent). */
  signOut: () => void;
  /**
   * Drops the local session WITHOUT revoking anything — for when the backend has already decided
   * the session is over (refresh failed, operator membership revoked). The layout redirects to
   * /login off the resulting status.
   */
  endSession: () => void;
  /**
   * Re-asks the backend whether this account is still an operator, refreshing `user.role` from the
   * answer. Resolves `false` — and ends the session — when the membership is gone.
   *
   * The console needs this because operator access is now revocable per person and takes effect on
   * the operator's very next request: a session that was valid a minute ago can stop being one
   * without anything about the token changing.
   */
  revalidate: () => Promise<boolean>;
  /** Rebuilds the session after a reload: refresh the cookie, then ask who the operator is. */
  restore: () => Promise<void>;
  /** Capability check for the signed-in operator; see `operatorCan`. */
  can: (capability: AdminCapability) => boolean;
};

function toSessionUser(
  user: ApiUser,
  role: AdminRole,
  /** Absent when talking to a backend that predates the capability matrix. */
  capabilities: AdminCapability[] | undefined
): SessionUser {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return {
    id: user.id,
    name: user.displayName || fullName || user.email,
    email: user.email,
    role,
    capabilities: capabilities ?? [],
  };
}

/**
 * Does the signed-in operator hold this capability? Use it to hide or disable controls the backend
 * would refuse — `useAuthStore((s) => s.can("orders.act"))`.
 *
 * Hiding a control is courtesy, not security: OperatorGuard enforces the same capability on the
 * request, so this only spares someone a button that 403s. Signed out → `false`.
 */
export function operatorCan(
  user: SessionUser | null,
  capability: AdminCapability
): boolean {
  // Optional chain on `capabilities`, not just `user`: a backend that predates the capability
  // matrix omits the field entirely, and a crash-on-undefined here would take the whole console
  // down during the window between the two deploys. Absent list → nothing offered, which is the
  // safe direction to fail.
  return user?.capabilities?.includes(capability) ?? false;
}

let revalidateInFlight: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "idle",
  user: null,
  accessToken: null,

  signIn: async (email, password) => {
    const session = await loginToAdminConsole(email, password);
    set({
      status: "authenticated",
      user: toSessionUser(session.user, session.adminRole, session.capabilities),
      accessToken: session.accessToken,
    });
  },

  signOut: () => {
    set({ status: "unauthenticated", user: null, accessToken: null });
    void revokeSession().catch(() => {
      // Logout is idempotent and the local session is already gone; nothing useful to surface.
    });
  },

  endSession: () => set({ status: "unauthenticated", user: null, accessToken: null }),

  revalidate: () => {
    // Shared in-flight, so a page firing five parallel calls that all 403 probes once.
    revalidateInFlight ??= (async () => {
      try {
        const { accessToken } = get();
        if (!accessToken) return false;
        const identity = await fetchOperatorIdentity(accessToken);
        set({ user: toSessionUser(identity.user, identity.adminRole, identity.capabilities) });
        return true;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          get().endSession();
          return false;
        }
        // A network blip is not a revocation — keep the session; the caller still sees its own error.
        return true;
      } finally {
        revalidateInFlight = null;
      }
    })();
    return revalidateInFlight;
  },

  can: (capability) => operatorCan(get().user, capability),

  restore: async () => {
    if (get().status !== "idle") return;
    set({ status: "restoring" });
    try {
      const { accessToken } = await refreshAccessToken();
      const identity = await fetchOperatorIdentity(accessToken);
      set({
        status: "authenticated",
        user: toSessionUser(identity.user, identity.adminRole, identity.capabilities),
        accessToken,
      });
    } catch {
      // No refresh cookie, an expired family, or a revoked membership — all mean "sign in again".
      set({ status: "unauthenticated", user: null, accessToken: null });
    }
  },
}));
