/** Marketplace user management — entity types (module: /users). */

export type UserType = "seller" | "buyer";

export type UserStatus = "active" | "restricted" | "banned";

export type ListingState = "published" | "closed" | "pending";

export type UserListing = {
  id: string;
  title: string;
  priceCents: number;
  state: ListingState;
  createdAt: string; // ISO
};

export type RestrictionEvent = {
  id: string;
  action: "restrict" | "unrestrict";
  reason: string;
  actor: string;
  createdAt: string; // ISO
};

export type MarketUser = {
  id: string;
  displayName: string;
  handle: string; // without @
  email: string;
  userType: UserType;
  status: UserStatus;
  businessName?: string;
  phone?: string;
  location?: string;
  bio?: string;
  createdAt: string; // joined, ISO
  lastSeenAt: string; // ISO
  /** Set while restricted or banned (ban date for banned accounts). */
  restrictedAt?: string;
  /** Reason for the current restriction / ban. */
  restrictionReason?: string;
  restrictionHistory: RestrictionEvent[];
  listings: UserListing[];
};

/** Admin deletion audit entry — this module logs only source="admin-user". */
export type DeletionLogEntry = {
  id: string;
  userName: string;
  userEmail: string;
  userType: UserType;
  reason: string;
  actor: string; // "by"
  records: number; // records removed
  source: "admin-user";
  deletedAt: string; // ISO
};
