"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150",
          checked ? "bg-brand-500" : "bg-tileborder group-hover:bg-nav-inactive/60",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-surface shadow-xs transition-transform duration-150",
            checked ? "translate-x-[18px]" : "translate-x-[2px]",
          )}
        />
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </button>
  );
}
