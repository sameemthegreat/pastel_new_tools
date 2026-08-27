"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const generatedId = React.useId();

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label
          htmlFor={generatedId}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={generatedId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-9 w-full appearance-none rounded-lg border border-hairline bg-surface pl-3 pr-9 text-sm shadow-xs",
            "transition-colors duration-150 hover:border-tileborder",
            "disabled:cursor-not-allowed disabled:bg-tile disabled:text-ink-muted",
            value === "" && placeholder ? "text-ink-muted" : "text-ink",
          )}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
      </div>
    </div>
  );
}
