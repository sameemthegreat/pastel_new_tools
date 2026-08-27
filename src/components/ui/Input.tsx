"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, className, id, ...rest }: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-9 w-full rounded-lg border bg-surface px-3 text-sm text-ink shadow-xs",
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
