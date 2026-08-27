import * as React from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const palettes = [
  "bg-brand-100 text-brand-700",
  "bg-forest-light text-forest",
  "bg-warning-100 text-warning-700",
  "bg-gold-light text-ink",
  "bg-tile text-ink-secondary",
] as const;

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
};

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const palette = palettes[nameHash(name) % palettes.length];

  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase",
        sizeClasses[size],
        palette,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
