import { create } from "zustand";
import {
  fetchOperatorIdentity,
  loginToAdminConsole,
  refreshAccessToken,
  revokeSession,
} from "@/lib/api/auth";
import type { AdminRole, ApiUser } from "@/types/auth";

/** The signed-in operator, projected for the console's chrome (sidebar card, RBAC gates, audit names). */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
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
  /** Rebuilds the session after a reload: refresh the cookie, then ask who the operator is. */
  restore: () => Promise<void>;
};

function toSessionUser(user: ApiUser, role: AdminRole): SessionUser {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return {
    id: user.id,
    name: user.displayName || fullName || user.email,
    email: user.email,
    role,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "idle",
  user: null,
  accessToken: null,

  signIn: async (email, password) => {
    const session = await loginToAdminConsole(email, password);
    set({
      status: "authenticated",
      user: toSessionUser(session.user, session.adminRole),
      accessToken: session.accessToken,
    });
  },

  signOut: () => {
    set({ status: "unauthenticated", user: null, accessToken: null });
    void revokeSession().catch(() => {
      // Logout is idempotent and the local session is already gone; nothing useful to surface.
    });
  },

  restore: async () => {
    if (get().status !== "idle") return;
    set({ status: "restoring" });
    try {
      const { accessToken } = await refreshAccessToken();
      const identity = await fetchOperatorIdentity(accessToken);
      set({
        status: "authenticated",
        user: toSessionUser(identity.user, identity.adminRole),
        accessToken,
      });
    } catch {
      // No refresh cookie, an expired family, or a revoked membership — all mean "sign in again".
      set({ status: "unauthenticated", user: null, accessToken: null });
    }
  },
}));
