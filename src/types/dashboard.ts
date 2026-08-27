import type { LucideIcon } from "lucide-react";

/** Range filter for the overview chart + KPI row. */
export type RangeKey = "7d" | "30d" | "90d";

/** One day of site traffic used by the trend chart. */
export type TrendPoint = {
  /** ISO date (UTC midnight). */
  date: string;
  visits: number;
  signups: number;
};

/** A single KPI tile in the top stat row. */
export type Kpi = {
  key: string;
  label: string;
  /** Pre-formatted display value ("$157.2K", "6,412"). */
  value: string;
  /** Percent delta vs the previous period. */
  delta: number;
  hint: string;
  icon: LucideIcon;
  spark: number[];
};

/** Donut slice for the listing-category split. */
export type CategorySlice = {
  label: string;
  value: number;
  color: string;
};

/** A queue that needs an admin's eyes, linked to its module. */
export type AttentionItem = {
  id: string;
  label: string;
  description: string;
  count: number;
  href: string;
  tone: "warning" | "error" | "brand";
  icon: LucideIcon;
};

export type ActivityType =
  | "approval"
  | "rejection"
  | "moderation"
  | "dispute"
  | "discount"
  | "curation"
  | "import"
  | "email"
  | "system";

/** One admin event in the recent-activity feed. */
export type ActivityEvent = {
  id: string;
  actor: string;
  /** Verb phrase, e.g. "approved waitlist signup". */
  action: string;
  /** What was acted on, e.g. a handle, code, or listing title. */
  target: string;
  /** Longer context shown in the detail drawer. */
  detail: string;
  module: string;
  href: string;
  /** ISO timestamp (all before the mock NOW clock). */
  at: string;
  type: ActivityType;
};
