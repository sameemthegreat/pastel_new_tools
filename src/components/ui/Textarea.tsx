"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  rows = 4,
  ...rest
}: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label
          htmlFor={textareaId}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm text-ink shadow-xs",
          "placeholder:text-ink-muted transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:bg-tile disabled:text-ink-muted",
          error
            ? "border-error-500"
            : "border-hairline hover:border-tileborder",
        )}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-error-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}
