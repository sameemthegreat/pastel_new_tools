/**
 * Shapes returned by the backend's operator endpoints (marketplace_new_backend, `/admin/*`).
 * All reached through the console's `/api/admin/*` proxy — see `src/lib/api/admin.ts`.
 * Dates arrive as ISO strings; money is integer minor units (cents).
 */

/** Cursor-pagination block at `data.meta` on every list endpoint. */
export type PageMeta = {
  perPage: number;
  count: number;
  nextCursor: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type Page<T> = { items: T[]; meta: PageMeta };

// ── Users ─────────────────────────────────────────────────────────────────

export type AccountStatus = "active" | "restricted" | "banned" | "deleted";

export type AdminUser = {
  id: string;
  email: string;
  userType: string;
  accountStatus: AccountStatus;
  restrictedAt: string | null;
};

export type UserRestrictionEntry = {
  id: string;
  userId: string;
  action: string;
  reason: string;
  userType: string;
  adminActor: string;
  createdAt: string;
};

export type AdminUserDetail = AdminUser & { restrictionHistory: UserRestrictionEntry[] };

// ── Seller applications (the waitlist + CRM) ──────────────────────────────

export type ApplicationStatus =
  | "pending_verification"
  | "verified"
  | "approved"
  | "rejected"
  | "revoked"
  | "withdrawn";

export type CrmStatus =
  | "contacted"
  | "under_discussion"
  | "pending"
  | "under_review"
  | "approved"
  | "on_hold";

export type SellerApplication = {
  id: string;
  userId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  addressId: string | null;
  addressText: string | null;
  sellerType: string | null;
  sellingPlatforms: string[];
  collectionSize: string | null;
  whatDoYouSell: string | null;
  websiteOrSocialUrl: string | null;
  biggestChallenge: string | null;
  source: string | null;
  status: ApplicationStatus;
  verifiedAt: string | null;
  revokedAt: string | null;
  priority: number;
  signupAttempts: number;
  referredById: string | null;
  referralCount: number;
  emailOptOut: boolean;
  crmStatus: CrmStatus | null;
  assignedAdminId: string | null;
  followUpAt: string | null;
  onboardingBatch: string | null;
  inviteStatus: string;
  invitedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  reviewedByUserId: string | null;
  decisionNote: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SellerApplicationNote = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type SellerApplicationDetail = SellerApplication & { notes: SellerApplicationNote[] };

export type SellerApplicationStats = {
  total: number;
  byStatus: Partial<Record<ApplicationStatus, number>>;
  byCrmStatus: Partial<Record<CrmStatus, number>>;
  last7Days: number;
};

// ── Account deletion requests (GDPR/CCPA) ─────────────────────────────────

export type DeletionRequest = {
  id: string;
  userId: string | null;
  email: string;
  userType: string | null;
  status: "pending" | "completed";
  resolution: string | null;
  requestedAt: string;
  completedAt: string | null;
};

// ── Discounts (platform promo codes) ──────────────────────────────────────

export type Discount = {
  id: string;
  code: string;
  kind: "percentage" | "freeShipping";
  percentage: number;
  title: string | null;
  isActive: boolean;
  remainingUsage: number | null;
  showOn: string[];
  applyOn: string[];
  expiresAt: string | null;
  usageCount: number;
};

export type DiscountInput = {
  code: string;
  kind: "percentage" | "freeShipping";
  percentage?: number;
  title?: string;
  remainingUsage?: number;
  showOn?: string[];
  applyOn?: string[];
  expiresAt?: string;
  isActive?: boolean;
};

// ── Team (operator memberships) ───────────────────────────────────────────

import type { AdminRole } from "@/types/auth";

export type OperatorMember = {
  userId: string;
  email: string;
  displayName: string | null;
  role: AdminRole;
  grantedAt: string;
  grantedByUserId: string | null;
  accountStatus: AccountStatus;
};

// ── Orders & disputes ─────────────────────────────────────────────────────

export type OrderStatusBucket =
  | "pendingPayment"
  | "preparingShipment"
  | "inTransit"
  | "delivered"
  | "pendingReview"
  | "completed"
  | "disputed"
  | "refundOffered"
  | "partiallyRefunded"
  | "refunded"
  | "disputeEscalated"
  | "disputeResolved"
  | "canceled";

export type AdminOrderParty = { id: string; email: string; displayName: string | null };

export type AdminOrder = {
  id: string;
  orderNumber: string;
  statusBucket: OrderStatusBucket;
  lastTransition: string | null;
  lastTransitionedAt: string | null;
  payinTotalAmount: number;
  currency: string;
  customer: AdminOrderParty;
  provider: AdminOrderParty;
  createdAt: string;
};

export type DisputeStatus =
  | "open"
  | "underReview"
  | "offerMade"
  | "escalated"
  | "resolved"
  | "withdrawn";

export type AdminDispute = {
  id: string;
  status: DisputeStatus;
  reason: string;
  description: string | null;
  openedByUserId: string;
  offerAmount: number | null;
  offerCurrency: string | null;
  resolution: "fullRefund" | "partialRefund" | "replacement" | "released" | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  order: AdminOrder;
  createdAt: string;
};

/** One FSM transition on an order's audit trail — GET /admin/orders/{id} `transitions`, oldest first. */
export type OrderTransition = {
  name: string;
  actor: string;
  actorUserId: string | null;
  at: string;
};

/** One refund issued against an order — GET /admin/orders/{id} `refunds`. Amount is integer cents. */
export type OrderRefund = {
  id: string;
  mode: "full" | "partial";
  amount: number;
  currency: string;
  reason: string | null;
  actor: string | null;
  stripeRefundId: string | null;
  createdAt: string;
};

/** GET /admin/orders/{id} — the list row plus lifecycle, payout, refund, and dispute detail. */
export type AdminOrderDetail = AdminOrder & {
  state: string;
  refundStatus: "none" | "requested" | "partial" | "full";
  payoutTotalAmount: number;
  payoutReleased: boolean;
  payoutReleasedAt: string | null;
  payoutBlockedAt: string | null;
  payoutBlockReason: string | null;
  listingTitle: string | null;
  buyerNote: string | null;
  shippingAddress: unknown | null;
  transitions: OrderTransition[];
  refunds: OrderRefund[];
  dispute: { id: string; status: DisputeStatus } | null;
};

/**
 * One uploaded piece of dispute evidence — GET /admin/disputes/{id} `evidence`.
 * `url` is a short-lived presigned image URL and can be null when signing failed.
 */
export type DisputeEvidence = {
  assetId: string;
  uploadedByUserId: string;
  url: string | null;
  note: string | null;
  createdAt: string;
};

/** GET /admin/disputes/{id} — the list row plus offer, internal-note, and evidence detail. */
export type AdminDisputeDetail = AdminDispute & {
  offerNote: string | null;
  offerExpiresAt: string | null;
  adminNote: string | null;
  resolvedByUserId: string | null;
  evidence: DisputeEvidence[];
};

/** GET /admin/orders/{id}/refund-eligibility — which operator resolutions are valid right now. */
export type RefundEligibility = {
  availableResolutions: string[];
  [key: string]: unknown;
};

// ── Analytics ─────────────────────────────────────────────────────────────

export type AnalyticsDay = {
  day: string;
  pageViews: number;
  uniqueSessions: number;
  signups: number;
  emailVerifications: number;
  cartAdds: number;
  checkoutStarts: number;
  paymentStepViews: number;
  reviewStepViews: number;
  checkoutCompletes: number;
  shopVisits: Record<string, number>;
  referrals: Record<string, number>;
};

// ── Referrals (Invite Links) ──────────────────────────────────────────────

export type Referrer = {
  id: string;
  fullName: string;
  email: string;
  status: ApplicationStatus;
  referralCount: number;
  referralToken: string | null;
  submittedAt: string;
};

export type ReferralReport = {
  referrers: number;
  referredSignups: number;
  top: Referrer[];
};

// ── Sales tax ─────────────────────────────────────────────────────────────

export type SalesTaxStateRow = {
  state: string | null;
  orders: number;
  amount: number;
  shipping: number;
  salesTax: number;
};

export type SalesTaxSummary = {
  states: SalesTaxStateRow[];
  totalOrders: number;
  totalSalesTax: number;
  refundCount: number;
  refundedAmount: number;
  refundedSalesTax: number;
};

export type TaxOrderRow = {
  id: string;
  orderId: string;
  amount: number;
  shipping: number;
  salesTax: number;
  toState: string | null;
  reportedAt: string | null;
};

// ── App versions / OTA ────────────────────────────────────────────────────

export type BundleAdoptionRow = {
  bundleVersion: string;
  devices: number;
  activeLast7Days: number;
  lastSeenAt: string | null;
};

export type BundleAdoption = {
  bundles: BundleAdoptionRow[];
  platforms: Record<string, number>;
  totalDevices: number;
  activeLast7Days: number;
  stableVersion: string | null;
  stableUpdatedAt: string | null;
};

export type StablePin = { stableVersion: string | null; stableUpdatedAt: string };

export type NativeLogEntry = {
  id: string;
  level: "debug" | "info" | "warn" | "error" | string;
  event: string;
  data: unknown;
  ua: string | null;
  origin: string | null;
  createdAt: string;
};

// ── Email templates ───────────────────────────────────────────────────────

export type EmailTemplate = {
  key: string;
  label: string;
  category: "account" | "seller" | "waitlist" | "gdpr" | "internal";
  trigger: string;
};

export type EmailTemplatePreview = EmailTemplate & {
  subject: string;
  html: string;
  text: string;
};

// ── Curation ──────────────────────────────────────────────────────────────

export type CurationEntry = {
  listingId: string;
  position: number;
  title: string;
  state: string;
  priceAmount: number | null;
  priceCurrency: string | null;
};

export type CurationScope = { scope: string; entries: CurationEntry[] };

// ── Fill Seller ───────────────────────────────────────────────────────────

export type NormalizedDraft = {
  source: "etsy";
  sourceUrl: string;
  sourceListingId: string;
  title: string;
  description: string;
  priceAmount: number;
  currency: string;
  quantity: number;
  tags: string[];
  imageUrls: string[];
};

export type FillSellerImportResult = {
  created: { listingId: string; title: string }[];
  failed: { title: string; reason: string }[];
};

export type FillSellerStatus = { etsyConfigured: boolean; ebayEnabled: boolean };

// ── Content Pulse ─────────────────────────────────────────────────────────

export type CpParsedRow = {
  id: string;
  accountId: string | null;
  username: string | null;
  accountName: string | null;
  caption: string | null;
  postType: string | null;
  publishTime: string | null;
  durationSec: number | null;
  permalink: string | null;
  dataComment: string | null;
  datePeriodRaw: string | null;
  periodType: string | null;
  views: number;
  reach: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  follows: number;
};

export type CpUploadPreview = {
  token: string;
  filename: string;
  rowCount: number;
  newPosts: number;
  updatedPosts: number;
  dominantPeriod: string | null;
  sample: CpParsedRow[];
};

export type CpImport = {
  id: string;
  label: string | null;
  period: string | null;
  filename: string;
  rowCount: number;
  newPosts: number;
  updatedPosts: number;
  importedBy: string;
  createdAt: string;
};

export type CpMetricSnapshot = {
  views: number;
  reach: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  follows: number;
  importId: string;
  recordedAt: string;
};

export type CpPost = {
  id: string;
  type: string | null;
  username: string | null;
  caption: string | null;
  permalink: string | null;
  publishTime: string | null;
  createdAt: string;
  latestMetrics: CpMetricSnapshot | null;
  employee: { id: string; name: string } | null;
  engagementRate: number;
};

export type CpEmployee = {
  id: string;
  name: string;
  handle: string | null;
  active: boolean;
  createdAt: string;
};

export type CpMetricTotals = {
  posts: number;
  views: number;
  reach: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  follows: number;
  avgEngagementRate: number;
};

export type CpOverview = {
  days: number;
  totals: CpMetricTotals;
  series: ({ day: string; avgEngagementRate: number } & Omit<CpMetricTotals, "posts" | "avgEngagementRate"> & {
      posts?: number;
    })[];
};

export type CpEmployeeAnalytics = {
  employeeId: string | null;
  name: string;
  handle: string | null;
  active: boolean | null;
  posts: number;
  views: number;
  reach: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  follows: number;
  avgEngagementRate: number;
};
