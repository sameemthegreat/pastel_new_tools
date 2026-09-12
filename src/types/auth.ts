/**
 * Shapes returned by the Pastel backend's auth endpoints (marketplace_new_backend).
 * Payloads live at `data.value` of the API envelope — see `src/lib/api/client.ts`.
 */

/** Mirrors the backend's `AdminRole` Prisma enum — the operator's RBAC role. */
export type AdminRole =
  | "superAdmin"
  | "opsAgent"
  | "moderator"
  | "financeAgent"
  | "support";

/**
 * Mirrors the backend's `AdminCapability` union (`entities/admin-capabilities.ts`) — what a role may
 * actually DO. The console never derives these from the role: `/admin/auth/login` and
 * `/admin/auth/me` return the expanded list, and the UI gates on that.
 *
 * These names are UI HINTS, not the security boundary. Every one of them is enforced by
 * OperatorGuard on the request itself, so a stale or mistyped name here hides a control that would
 * have worked — never the reverse.
 */
export type AdminCapability =
  | "users.read"
  | "users.moderate"
  | "applications.read"
  | "applications.annotate"
  | "applications.review"
  | "moderation.read"
  | "moderation.act"
  | "deletion.read"
  | "deletion.act"
  | "orders.read"
  | "orders.act"
  | "disputes.read"
  | "discounts.read"
  | "discounts.manage"
  | "salesTax.read"
  | "analytics.read"
  | "curation.read"
  | "curation.manage"
  | "fillSeller.use"
  | "contentPulse.read"
  | "contentPulse.manage"
  | "appVersions.read"
  | "appVersions.manage"
  | "emailTemplates.read"
  | "emailTemplates.test"
  | "team.read"
  | "team.manage";

/** Human-readable labels for `AdminRole`, for chrome like the sidebar user card. */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  superAdmin: "Super admin",
  opsAgent: "Ops agent",
  moderator: "Moderator",
  financeAgent: "Finance agent",
  support: "Support",
};

/** The backend's `UserResource` — the public-safe user projection auth endpoints return. */
export type ApiUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  effectivelyVerified: boolean;
  userType: string;
  activeMode: "buyer" | "seller";
  accountStatus: "active" | "restricted" | "banned" | "deleted";
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  bio: string | null;
  handle: string | null;
  businessName: string | null;
  aboutShop: string | null;
  profileImageId: string | null;
  isTopSeller: boolean;
  followersCount: number;
  followingCount: number;
  publicData: unknown;
  createdAt: string;
};

/** `POST /admin/auth/login` — operator session. Refresh token arrives as the httpOnly `pa_rt` cookie. */
export type AdminSession = {
  user: ApiUser;
  adminRole: AdminRole;
  /** Everything this role may do, expanded server-side. See `AdminCapability`. */
  capabilities: AdminCapability[];
  accessToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
};

/** `GET /admin/auth/me` — session restore: who the operator is and their role. */
export type OperatorIdentity = {
  user: ApiUser;
  adminRole: AdminRole;
  capabilities: AdminCapability[];
};

/** `POST /auth/refresh` — a new access token only; the rotated refresh token rides the cookie. */
export type AccessToken = {
  accessToken: string;
  expiresIn: number;
};
