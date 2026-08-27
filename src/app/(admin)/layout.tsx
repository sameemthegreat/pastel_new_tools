"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ToastViewport } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const restore = useAuthStore((s) => s.restore);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  // Fresh tab or hard reload: try to rebuild the session from the refresh cookie before deciding.
  useEffect(() => {
    if (status === "idle") {
      void restore();
    }
  }, [status, restore]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-brand-500" />
        <span className="sr-only">Restoring your session…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <Sidebar />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]"
        )}
      >
        <Topbar />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <ToastViewport />
    </div>
  );
}
