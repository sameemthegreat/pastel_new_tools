import {
  Inbox,
  Scale,
  ShieldAlert,
  Smartphone,
  Trash2,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { formatCompact, formatNumber } from "@/lib/format";
import type {
  ActivityEvent,
  AttentionItem,
  CategorySlice,
  Kpi,
  RangeKey,
  TrendPoint,
} from "@/types/dashboard";

/**
 * Dashboard aggregates — fully deterministic mock data.
 * 90 daily points ending on the mock clock day (Aug 27, 2026); every
 * derived series is a pure transform of these fixed literals.
 */

const DAY_MS = 86_400_000;
/** First day of the 90-day window: May 30, 2026 (index 89 = Aug 27, 2026). */
const TREND_START_MS = Date.parse("2026-05-30T00:00:00.000Z");

// Daily marketplace visits, May 30 → Aug 27 2026 (weekend dips, steady growth).
const VISITS: number[] = [
  828, 861, 902, 887, 914, 953, 780, 745, 869, 921,
  948, 972, 1004, 812, 776, 903, 957, 989, 1012, 1041,
  846, 803, 934, 988, 1023, 1047, 1075, 872, 831, 962,
  1018, 1054, 1082, 1109, 903, 858, 994, 1049, 1086, 1117,
  1146, 931, 884, 1026, 1083, 1121, 1152, 1183, 962, 913,
  1058, 1117, 1156, 1189, 1221, 993, 941, 1092, 1152, 1193,
  1226, 1259, 1024, 972, 1126, 1188, 1230, 1264, 1299, 1056,
  1002, 1161, 1225, 1268, 1304, 1339, 1089, 1033, 1197, 1263,
  1308, 1344, 1381, 1123, 1066, 1234, 1302, 1349, 1386, 1424,
];

// Daily signups over the same window.
const SIGNUPS: number[] = [
  31, 34, 36, 33, 35, 39, 27, 25, 33, 36,
  38, 40, 43, 29, 26, 35, 38, 41, 43, 45,
  30, 28, 37, 41, 44, 45, 47, 32, 29, 38,
  42, 45, 47, 49, 33, 30, 40, 44, 46, 48,
  51, 34, 31, 41, 45, 48, 50, 52, 35, 32,
  43, 47, 49, 51, 54, 36, 33, 44, 48, 50,
  53, 55, 37, 34, 46, 50, 52, 55, 57, 38,
  35, 47, 51, 54, 56, 58, 39, 36, 49, 53,
  56, 58, 60, 40, 37, 50, 54, 57, 59, 62,
];

/** Full 90-day traffic trend with ISO dates. */
export const TREND: TrendPoint[] = VISITS.map((visits, i) => ({
  date: new Date(TREND_START_MS + i * DAY_MS).toISOString(),
  visits,
  signups: SIGNUPS[i],
}));

// Deterministic derived series for KPI sparklines.
const GMV_DAILY = VISITS.map((v, i) => Math.round(v * 3.6 + SIGNUPS[i] * 22));
const ACTIVE_DAILY = VISITS.map((v, i) => Math.round(v * 0.62 + SIGNUPS[i]));
const INSTALLS_DAILY = VISITS.map((v, i) =>
  Math.round(SIGNUPS[i] * 1.1 + (v % 13)),
);

// Current-queue sparklines (last ~2 weeks of queue depth).
const WAITLIST_QUEUE_SPARK = [14, 15, 17, 16, 18, 19, 21, 20, 22, 21, 22, 23];
const DISPUTES_SPARK = [9, 8, 8, 10, 9, 8, 7, 8, 8, 7, 6, 7];

export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
];

const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90 };

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function sum(values: number[]): number {
  return values.reduce((total, n) => total + n, 0);
}

/** Trend rows for a range, oldest → newest. */
export function trendForRange(range: RangeKey): TrendPoint[] {
  return TREND.slice(-RANGE_DAYS[range]);
}

/** X-axis labels ("Aug 21") matching trendForRange. */
export function trendLabels(range: RangeKey): string[] {
  return trendForRange(range).map((p) => shortDate.format(new Date(p.date)));
}

// Distinct active users per window (unique users, not a daily sum).
const ACTIVE_USERS: Record<RangeKey, number> = {
  "7d": 2841,
  "30d": 6412,
  "90d": 11208,
};

// Percent deltas vs the preceding window of the same length.
const DELTAS: Record<RangeKey, Record<string, number>> = {
  "7d": { gmv: 6.8, active: 4.2, installs: 9.1 },
  "30d": { gmv: 12.4, active: 8.7, installs: 15.3 },
  "90d": { gmv: 28.9, active: 19.4, installs: 34.6 },
};

/** KPI row for the selected range. */
export function kpisForRange(range: RangeKey): Kpi[] {
  const days = RANGE_DAYS[range];
  const label = RANGE_OPTIONS.find((r) => r.key === range)?.label ?? range;
  const vs = `vs prior ${days} days`;
  return [
    {
      key: "gmv",
      label: "GMV",
      value: `$${formatCompact(sum(GMV_DAILY.slice(-days)))}`,
      delta: DELTAS[range].gmv,
      hint: vs,
      icon: Wallet,
      spark: GMV_DAILY.slice(-days),
    },
    {
      key: "active-users",
      label: "Active users",
      value: formatNumber(ACTIVE_USERS[range]),
      delta: DELTAS[range].active,
      hint: label.toLowerCase(),
      icon: Users,
      spark: ACTIVE_DAILY.slice(-days),
    },
    {
      key: "waitlist-pending",
      label: "Waitlist pending",
      value: "23",
      delta: -8.3,
      hint: "awaiting review",
      icon: Inbox,
      spark: WAITLIST_QUEUE_SPARK,
    },
    {
      key: "open-disputes",
      label: "Open disputes",
      value: "7",
      delta: -12.5,
      hint: "escalated orders",
      icon: Scale,
      spark: DISPUTES_SPARK,
    },
    {
      key: "app-installs",
      label: "App installs",
      value: formatNumber(sum(INSTALLS_DAILY.slice(-days))),
      delta: DELTAS[range].installs,
      hint: vs,
      icon: Smartphone,
      spark: INSTALLS_DAILY.slice(-days),
    },
  ];
}

/** Live listings by category (donut). */
export const CATEGORY_SPLIT: CategorySlice[] = [
  { label: "Art", value: 342, color: "var(--color-brand-500)" },
  { label: "Decor", value: 289, color: "var(--color-forest)" },
  { label: "Jewelry", value: 253, color: "var(--color-gold)" },
  { label: "Furniture", value: 187, color: "var(--color-star)" },
  { label: "Collectible", value: 164, color: "var(--color-success-500)" },
  { label: "Fashion", value: 121, color: "var(--color-badge)" },
  { label: "Other", value: 96, color: "var(--color-ink-muted)" },
];

/** Queues that need an admin's attention, linked to their modules. */
export const ATTENTION_SEED: AttentionItem[] = [
  {
    id: "att-waitlist",
    label: "Waitlist signups pending review",
    description: "Verified sellers waiting on an approve / reject decision.",
    count: 23,
    href: "/requests",
    tone: "warning",
    icon: Inbox,
  },
  {
    id: "att-disputes",
    label: "Open disputes",
    description: "Auto-escalated orders awaiting resolution in Sharetribe.",
    count: 7,
    href: "/disputes",
    tone: "error",
    icon: Scale,
  },
  {
    id: "att-changes",
    label: "Flagged content changes",
    description: "Spikes and drops detected in the latest Content Pulse import.",
    count: 12,
    href: "/content-pulse",
    tone: "warning",
    icon: Zap,
  },
  {
    id: "att-appeals",
    label: "Restriction appeals",
    description: "Restricted accounts with an appeal awaiting review.",
    count: 4,
    href: "/users",
    tone: "brand",
    icon: ShieldAlert,
  },
  {
    id: "att-deletions",
    label: "Pending account deletions",
    description: "App-originated GDPR deletion requests to complete.",
    count: 3,
    href: "/requests",
    tone: "error",
    icon: Trash2,
  },
];

/** Recent admin events, newest first (all timestamps precede mock NOW). */
export const ACTIVITY_SEED: ActivityEvent[] = [
  {
    id: "act-01",
    actor: "Maya Chen",
    action: "approved waitlist signup",
    target: "Harriet Blum (@harrietsattic)",
    detail:
      "Verified seller approved from the waitlist queue. Welcome email with shop setup link was sent automatically.",
    module: "Requests",
    href: "/requests",
    at: "2026-08-27T11:24:00.000Z",
    type: "approval",
  },
  {
    id: "act-02",
    actor: "Sameem Amjad",
    action: "resolved dispute",
    target: "#8f3d21ac",
    detail:
      "Escalated dispute closed with a full refund to the buyer. Payout of $184.00 reversed on the provider side.",
    module: "Disputes",
    href: "/disputes",
    at: "2026-08-27T10:47:00.000Z",
    type: "dispute",
  },
  {
    id: "act-03",
    actor: "Priya Nair",
    action: "created discount",
    target: "FALLSHIP",
    detail:
      "Free-shipping promo, 500 total uses, shown on web + app, expires Sep 30, 2026.",
    module: "Discounts",
    href: "/discounts",
    at: "2026-08-27T09:58:00.000Z",
    type: "discount",
  },
  {
    id: "act-04",
    actor: "Jonas Petersen",
    action: "imported Content Pulse data",
    target: "August wk4 export",
    detail:
      "118 rows parsed — 9 new posts, 12 metric changes flagged (3 spikes, 2 drops).",
    module: "Content Pulse",
    href: "/content-pulse",
    at: "2026-08-27T09:12:00.000Z",
    type: "import",
  },
  {
    id: "act-05",
    actor: "Lena Fischer",
    action: "pinned listing to home",
    target: "Meiji-era bronze incense burner",
    detail:
      "Added to the Decor home pool — now 8 listings in rotation for that category.",
    module: "Curation",
    href: "/curation",
    at: "2026-08-27T08:30:00.000Z",
    type: "curation",
  },
  {
    id: "act-06",
    actor: "Maya Chen",
    action: "restricted account",
    target: "@vintage_vault_ny",
    detail:
      "Restricted after a counterfeit report on two listings. 14 published listings closed; seller notified with appeal instructions.",
    module: "Users",
    href: "/users",
    at: "2026-08-27T07:55:00.000Z",
    type: "moderation",
  },
  {
    id: "act-07",
    actor: "Sameem Amjad",
    action: "enforced stable bundle",
    target: "v1.4.72",
    detail:
      "Fleet pinned to v1.4.72 — rollback of the 1.4.73 camera crash. Note attached for the release channel.",
    module: "App Versions",
    href: "/app-versions",
    at: "2026-08-26T18:40:00.000Z",
    type: "system",
  },
  {
    id: "act-08",
    actor: "Priya Nair",
    action: "customized email template",
    target: "Waitlist approved",
    detail:
      "Updated the greeting and CTA copy; template now carries the CUSTOMIZED badge and renders in preview.",
    module: "Email Templates",
    href: "/email-templates",
    at: "2026-08-26T16:05:00.000Z",
    type: "email",
  },
  {
    id: "act-09",
    actor: "Jonas Petersen",
    action: "rejected waitlist signup",
    target: "Marcus Webb (@webbcurios)",
    detail:
      "Rejected with note — currently at capacity for the collectibles category. Rejection email sent.",
    module: "Requests",
    href: "/requests",
    at: "2026-08-26T14:22:00.000Z",
    type: "rejection",
  },
  {
    id: "act-10",
    actor: "Lena Fischer",
    action: "pushed 24 listings",
    target: "oldworldantiques (Etsy import)",
    detail:
      "Fill Seller bulk import — 24 created, 0 failed. Listings published and visible to buyers.",
    module: "Fill Seller",
    href: "/fill-seller",
    at: "2026-08-26T11:10:00.000Z",
    type: "import",
  },
  {
    id: "act-11",
    actor: "Maya Chen",
    action: "uplifted restriction",
    target: "@atelier_rosa",
    detail:
      "Appeal reviewed and accepted — restriction lifted, listings restored to published state.",
    module: "Users",
    href: "/users",
    at: "2026-08-25T17:48:00.000Z",
    type: "moderation",
  },
  {
    id: "act-12",
    actor: "Sameem Amjad",
    action: "deactivated discount",
    target: "SUMMER20",
    detail: "Initial promo deactivated after reaching 92% redemption.",
    module: "Discounts",
    href: "/discounts",
    at: "2026-08-25T15:02:00.000Z",
    type: "discount",
  },
  {
    id: "act-13",
    actor: "Priya Nair",
    action: "completed GDPR removal",
    target: "elsie.moran@gmail.com",
    detail:
      "Self-requested data removal completed — 4 records purged, confirmation email sent.",
    module: "Requests",
    href: "/requests",
    at: "2026-08-25T10:31:00.000Z",
    type: "moderation",
  },
  {
    id: "act-14",
    actor: "Jonas Petersen",
    action: "assigned posts to employee",
    target: "14 posts → Sofia Reyes",
    detail:
      "Attribution coverage now 91% (162 of 178 posts assigned) after the August wk3 import.",
    module: "Content Pulse",
    href: "/content-pulse",
    at: "2026-08-24T16:44:00.000Z",
    type: "import",
  },
  {
    id: "act-15",
    actor: "Lena Fischer",
    action: "saved category curation",
    target: "Jewelry — 6 home, 4 top",
    detail:
      "Home pool refreshed for the weekend rotation; two sold-out pins replaced.",
    module: "Curation",
    href: "/curation",
    at: "2026-08-24T09:20:00.000Z",
    type: "curation",
  },
  {
    id: "act-16",
    actor: "Sameem Amjad",
    action: "added team member",
    target: "Noah Okafor (@nokafor)",
    detail: "Member role — welcome email with login details sent.",
    module: "Team",
    href: "/team",
    at: "2026-08-23T13:15:00.000Z",
    type: "approval",
  },
  {
    id: "act-17",
    actor: "Maya Chen",
    action: "approved waitlist signup",
    target: "Dmitri Volkov (@volkovtimepieces)",
    detail:
      "Approved after follow-up call — priority #12, 3 referrals. Welcome email sent.",
    module: "Requests",
    href: "/requests",
    at: "2026-08-23T10:05:00.000Z",
    type: "approval",
  },
  {
    id: "act-18",
    actor: "Priya Nair",
    action: "banned account",
    target: "@fastflip_resale",
    detail:
      "Soft ban with listings closed — repeated policy violations after restriction. Reason logged to the deletion audit.",
    module: "Users",
    href: "/users",
    at: "2026-08-22T15:37:00.000Z",
    type: "moderation",
  },
];
