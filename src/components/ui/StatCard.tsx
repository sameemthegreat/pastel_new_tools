import * as React from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  spark,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  icon?: LucideIcon;
  spark?: number[];
}) {
  const deltaPositive = delta !== undefined && delta >= 0;

  return (
    <div className="bg-surface border border-hairline rounded-2xl shadow-xs p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-secondary">{label}</p>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon size={18} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-3xl font-bold tabular-nums tracking-tight text-ink">
            {value}
          </p>
          {(delta !== undefined || hint) && (
            <div className="mt-1.5 flex items-center gap-1.5">
              {delta !== undefined && (
                <span
                  className={
                    deltaPositive
                      ? "inline-flex items-center gap-0.5 text-xs font-medium text-success-600"
                      : "inline-flex items-center gap-0.5 text-xs font-medium text-error-600"
                  }
                >
                  {deltaPositive ? (
                    <ArrowUpRight size={14} aria-hidden="true" />
                  ) : (
                    <ArrowDownRight size={14} aria-hidden="true" />
                  )}
                  {Math.abs(delta)}%
                </span>
              )}
              {hint && <span className="text-xs text-ink-muted">{hint}</span>}
            </div>
          )}
        </div>
        {spark && spark.length > 1 && (
          <div className="shrink-0 pb-1">
            <Sparkline data={spark} />
          </div>
        )}
      </div>
    </div>
  );
}
