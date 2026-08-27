/**
 * ContentPulse — Instagram analytics entities.
 * Legacy tool: CSV/XLSX insight imports diffed against prior snapshots,
 * posts attributed to team members for leaderboards.
 */

export type PostType = "reel" | "photo" | "video" | "carousel" | "story";

export type PeriodType =
  | "lifetime"
  | "7d"
  | "28d"
  | "3d"
  | "range"
  | "unknown";

/** Numeric metrics tracked per post (comments tracked but not a leaderboard metric). */
export type MetricKey =
  | "reach"
  | "views"
  | "likes"
  | "shares"
  | "saves"
  | "follows";

export type PulsePost = {
  id: string;
  permalink: string;
  /** ISO timestamp the post went live. */
  publishTime: string;
  postType: PostType;
  caption: string;
  /** Account the post was published on. */
  username: string;
  /** Attributed team member — null until assigned. */
  employeeId: string | null;
  views: number;
  reach: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  follows: number;
  periodType: PeriodType;
};

export type PulseEmployee = {
  id: string;
  name: string;
  handle: string;
  /** CSS variable reference to a design token, e.g. "var(--color-forest)". */
  color: string;
};

export type ImportStatus = "completed" | "processing" | "failed";

export type PulseImport = {
  id: string;
  label: string;
  fileName: string;
  periodType: PeriodType;
  rowCount: number;
  newCount: number;
  changedCount: number;
  importedAt: string;
  importedBy: string;
  status: ImportStatus;
};

/**
 * Diff alert produced by an import.
 * Rules: spike = pctChange >= +50% AND delta >= 50;
 *        drop  = pctChange <= -40% AND |delta| >= 50.
 */
export type ChangeType = "new_post" | "spike" | "drop";

export type MetricChange = {
  id: string;
  importId: string;
  postId: string;
  changeType: ChangeType;
  /** null for new_post alerts. */
  metric: MetricKey | null;
  oldValue: number;
  newValue: number;
  delta: number;
  /** Signed percentage, e.g. +69.6 or -46.0. 0 for new_post. */
  pctChange: number;
  acknowledged: boolean;
};
