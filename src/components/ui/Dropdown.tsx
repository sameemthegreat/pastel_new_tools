"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function Dropdown({
  trigger,
  items,
  align = "right",
}: {
  trigger: React.ReactNode;
  items: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    tone?: "default" | "danger";
    separatorAbove?: boolean;
  }[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center rounded-lg"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1.5 min-w-44 rounded-2xl border border-hairline bg-surface py-1.5 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, index) => (
            <Fragment key={`${item.label}-${index}`}>
              {item.separatorAbove && <div className="my-1.5 border-t border-hairline" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-cream",
                  item.tone === "danger" ? "text-danger" : "text-ink"
                )}
              >
                {item.icon && (
                  <item.icon
                    className={cn("h-4 w-4 shrink-0", item.tone !== "danger" && "text-ink-muted")}
                  />
                )}
                {item.label}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
