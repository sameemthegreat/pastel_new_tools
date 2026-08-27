"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

type ToastData = {
  id: string;
  title: string;
  description?: string;
  tone: "success" | "error" | "info";
};

const toneConfig: Record<ToastData["tone"], { icon: LucideIcon; className: string }> = {
  success: { icon: CheckCircle2, className: "text-success-600" },
  error: { icon: AlertCircle, className: "text-error-600" },
  info: { icon: Info, className: "text-brand-600" },
};

function ToastItem({ toast }: { toast: ToastData }) {
  const dismissToast = useUIStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, dismissToast]);

  const { icon: Icon, className } = toneConfig[toast.tone];

  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-lg">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${className}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-sm text-ink-secondary">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss"
        className="-m-1 rounded-lg p-1 text-ink-muted transition-colors hover:bg-tile hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
