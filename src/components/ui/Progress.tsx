import * as React from "react";
import { cn } from "@/lib/cn";

const toneClasses: Record<"brand" | "success" | "warning" | "error", string> = {
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
};

export function Progress({
  value,
  max = 100,
  tone = "brand",
  className,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "success" | "warning" | "error";
  className?: string;
}) {
  const percent =
    max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-tile", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          toneClasses[tone],
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
