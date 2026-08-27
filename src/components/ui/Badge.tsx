import * as React from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "brand"
  | "success"
  | "warning"
  | "error"
  | "neutral"
  | "forest"
  | "gold";

const toneClasses: Record<BadgeTone, { pill: string; dot: string }> = {
  brand: { pill: "bg-brand-50 text-brand-700", dot: "bg-brand-500" },
  success: { pill: "bg-success-50 text-success-700", dot: "bg-success-500" },
  warning: { pill: "bg-warning-50 text-warning-700", dot: "bg-warning-500" },
  error: { pill: "bg-error-50 text-error-700", dot: "bg-error-500" },
  neutral: { pill: "bg-tile text-ink-secondary", dot: "bg-ink-muted" },
  forest: { pill: "bg-forest-light text-forest", dot: "bg-forest" },
  gold: { pill: "bg-gold/10 text-gold", dot: "bg-gold" },
};

export function Badge({
  tone = "neutral",
  children,
  dot,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  dot?: boolean;
}) {
  const classes = toneClasses[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        classes.pill,
      )}
    >
      {dot && (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", classes.dot)}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

const statusToneMap: Record<string, BadgeTone> = {
  approved: "success",
  active: "success",
  live: "success",
  completed: "success",
  published: "success",
  resolved: "success",
  verified: "success",
  delivered: "success",
  succeeded: "success",
  pending: "warning",
  review: "warning",
  in_review: "warning",
  processing: "warning",
  scanning: "warning",
  awaiting: "warning",
  rejected: "error",
  failed: "error",
  restricted: "error",
  disputed: "error",
  error: "error",
  removed: "error",
  declined: "error",
  draft: "neutral",
  archived: "neutral",
  inactive: "neutral",
  expired: "neutral",
  new: "brand",
  imported: "brand",
  running: "brand",
  refunded: "gold",
  replacement: "gold",
};

function formatStatusLabel(status: string): string {
  const label = status.replace(/_/g, " ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusToneMap[status.toLowerCase()] ?? "neutral";
  return (
    <Badge tone={tone} dot>
      {formatStatusLabel(status)}
    </Badge>
  );
}
