/**
 * Formatting helpers for the Pastel admin console.
 *
 * All date/time output is pinned to en-US + UTC, and all relative time is
 * computed against the fixed mock clock `NOW` — never `Date.now()` — so
 * server and client renders are byte-identical (deterministic SSR hydration).
 * (One deliberate exception: `timeAgoLive`, which is only for values that
 * never appear in server-rendered HTML — see its doc comment.)
 */

/** Fixed mock clock. All relative time ("3h ago") is computed against this. */
export const NOW = "2026-08-27T12:00:00.000Z";

const NOW_MS = Date.parse(NOW);

const numberFormatter = new Intl.NumberFormat("en-US");

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
});

/** 12480 -> "12,480" */
export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

/** 1234.56 -> "$1,234.56" (USD) */
export function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

/** 12400 -> "12.4K" */
export function formatCompact(n: number): string {
  return compactFormatter.format(n);
}

/** "2026-08-27T12:00:00.000Z" -> "Aug 27, 2026" */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** "2026-08-27T14:41:00.000Z" -> "Aug 27, 2026, 2:41 PM" */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Relative time versus the fixed mock clock `NOW`.
 * "just now", "3m ago", "3h ago", "2d ago", "3w ago", "4mo ago", "1y ago".
 * Timestamps after NOW render as "in 3h" etc.
 */
export function timeAgo(iso: string): string {
  const diff = NOW_MS - Date.parse(iso);
  const abs = Math.abs(diff);

  if (abs < MINUTE) return "just now";

  let value: number;
  let unit: string;
  if (abs < HOUR) {
    value = Math.floor(abs / MINUTE);
    unit = "m";
  } else if (abs < DAY) {
    value = Math.floor(abs / HOUR);
    unit = "h";
  } else if (abs < WEEK) {
    value = Math.floor(abs / DAY);
    unit = "d";
  } else if (abs < MONTH) {
    value = Math.floor(abs / WEEK);
    unit = "w";
  } else if (abs < YEAR) {
    value = Math.floor(abs / MONTH);
    unit = "mo";
  } else {
    value = Math.floor(abs / YEAR);
    unit = "y";
  }

  return diff >= 0 ? `${value}${unit} ago` : `in ${value}${unit}`;
}

/**
 * Relative time versus the REAL clock (`Date.now()`), same buckets and labels
 * as `timeAgo`. Safe ONLY for values that render after a client-side fetch
 * (skeleton first, data later) — such markup never exists in the server HTML,
 * so hydration stays deterministic. The Orders page and its drawer use this;
 * existing pages stay on the pinned `timeAgo`.
 */
export function timeAgoLive(date: string | Date): string {
  const diff = Date.now() - (typeof date === "string" ? Date.parse(date) : date.getTime());
  const abs = Math.abs(diff);

  if (abs < MINUTE) return "just now";

  let value: number;
  let unit: string;
  if (abs < HOUR) {
    value = Math.floor(abs / MINUTE);
    unit = "m";
  } else if (abs < DAY) {
    value = Math.floor(abs / HOUR);
    unit = "h";
  } else if (abs < WEEK) {
    value = Math.floor(abs / DAY);
    unit = "d";
  } else if (abs < MONTH) {
    value = Math.floor(abs / WEEK);
    unit = "w";
  } else if (abs < YEAR) {
    value = Math.floor(abs / MONTH);
    unit = "mo";
  } else {
    value = Math.floor(abs / YEAR);
    unit = "y";
  }

  return diff >= 0 ? `${value}${unit} ago` : `in ${value}${unit}`;
}

/** "preparingShipment" -> "Preparing shipment"; "fullRefund" -> "Full refund". */
export function humanizeToken(value: string): string {
  const spaced = value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "Maya Chen" -> "MC"; "Priya" -> "P" */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
