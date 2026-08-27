"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-lg border border-hairline bg-surface pl-9 pr-3 text-sm text-ink shadow-xs",
          "placeholder:text-ink-muted transition-colors duration-150 hover:border-tileborder",
          "disabled:cursor-not-allowed disabled:bg-tile disabled:text-ink-muted",
        )}
      />
    </div>
  );
}
