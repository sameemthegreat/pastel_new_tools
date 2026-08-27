/** Dispute Orders module — auto-escalated Sharetribe transactions. */

export type DisputeType = "dispute" | "declined_dispute" | "replacement";

export type DisputeStatus =
  | "disputed"
  | "declined"
  | "replacement"
  | "resolved"
  | "refunded";

export type ResolutionOutcome = "buyer" | "seller" | "replacement";

export type TimelineKind =
  | "order"
  | "shipping"
  | "message"
  | "dispute"
  | "escalation"
  | "resolution";

export type TimelineStep = {
  id: string;
  kind: TimelineKind;
  label: string;
  detail?: string;
  at: string; // ISO timestamp
};

export type DisputeResolution = {
  outcome: ResolutionOutcome;
  resolvedAt: string;
  actor: string;
};

export type DisputeOrder = {
  id: string;
  /** Full Sharetribe transaction UUID — display first 8 chars mono. */
  transactionId: string;
  buyerName: string;
  buyerHandle: string;
  sellerName: string;
  sellerHandle: string;
  listingTitle: string;
  /** Payin total (what the buyer paid), USD. */
  amount: number;
  /** Payout total (what the seller receives), USD. */
  payout: number;
  type: DisputeType;
  status: DisputeStatus;
  disputeReason: string;
  messageExcerpt: string;
  escalatedAt: string;
  lastUpdatedAt: string;
  resolution?: DisputeResolution;
  timeline: TimelineStep[];
};
