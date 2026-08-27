/**
 * User Requests module — waitlist CRM + GDPR data-removal entities.
 */

/** Full CRM pipeline. `new` and `rejected` are display-only pseudo-stages. */
export type CrmStage =
  | "new"
  | "contacted"
  | "under_discussion"
  | "pending"
  | "under_review"
  | "approved"
  | "on_hold"
  | "rejected";

/** Stages an admin can pick in the per-row / drawer stage select. */
export const PICKABLE_STAGES: CrmStage[] = [
  "contacted",
  "under_discussion",
  "pending",
  "under_review",
  "approved",
  "on_hold",
];

export const STAGE_LABELS: Record<CrmStage, string> = {
  new: "New",
  contacted: "Contacted",
  under_discussion: "Under discussion",
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  on_hold: "On hold",
  rejected: "Rejected",
};

export const STAGE_ORDER: CrmStage[] = [
  "new",
  "contacted",
  "under_discussion",
  "pending",
  "under_review",
  "approved",
  "on_hold",
  "rejected",
];

export type StageHistoryEntry = {
  stage: CrmStage;
  changedBy: string;
  changedAt: string; // ISO
};

export type SignupNote = {
  id: string;
  author: string;
  text: string;
  createdAt: string; // ISO
};

export type WaitlistSignup = {
  id: string;
  name: string;
  email: string;
  phone: string;
  shopName: string;
  handle: string; // shop slug, no @
  location: string;
  website?: string;
  instagram?: string; // handle, no @
  tiktok?: string; // handle, no @
  collectionSize: string;
  currentlySellingOn: string;
  userType: "provider" | "customer";
  source: string; // how they heard about Pastel
  stage: CrmStage;
  appliedAt: string; // ISO
  lastUpdatedAt: string; // ISO
  priority: number; // waitlist position
  referralCount: number;
  stageHistory: StageHistoryEntry[];
  notes: SignupNote[];
};

/** GDPR removal sources surfaced in this module (admin-user lives in /users). */
export type RemovalSource = "public" | "admin-waitlist" | "app-account-deletion";

export type RemovalStatus = "pending" | "completed";

export const REMOVAL_SOURCE_LABELS: Record<RemovalSource, string> = {
  public: "Self-requested",
  "admin-waitlist": "Admin · Waitlist",
  "app-account-deletion": "App · Account deletion",
};

export type RemovalRequest = {
  id: string;
  requesterName: string;
  email: string;
  source: RemovalSource;
  status: RemovalStatus;
  reason: string;
  recordsCount: number;
  requestedAt: string; // ISO
  completedAt?: string; // ISO
  completedBy?: string;
  auditNote?: string;
};
