"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, ChevronRight, LogOut, Menu, Settings, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { SearchInput } from "@/components/ui/SearchInput";
import { useAuthStore } from "@/stores/authStore";
import { toast, useUIStore } from "@/stores/uiStore";

/** "fill-seller" -> "Fill Seller" */
function humanize(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [query, setQuery] = useState("");

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => ({
    label: humanize(decodeURIComponent(segment)),
    href: "/" + segments.slice(0, index + 1).join("/"),
  }));

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-hairline bg-surface/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
        className="-ml-2 rounded-lg p-2 text-ink-secondary transition-colors hover:bg-tile hover:text-ink lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link
          href="/dashboard"
          className="shrink-0 text-ink-muted transition-colors hover:text-ink"
        >
          Admin
        </Link>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight size={14} aria-hidden className="shrink-0 text-ink-muted" />
              {isLast ? (
                <span aria-current="page" className="truncate font-medium text-ink">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-ink-muted transition-colors hover:text-ink"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden md:block">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search users, content, orders"
            className="w-72"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-hairline bg-tile px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
            ⌘K
          </kbd>
        </div>

        <span aria-hidden className="hidden h-6 w-px bg-hairline md:block" />

        <button
          type="button"
          onClick={() =>
            toast({
              title: "Notifications",
              description: "You are all caught up.",
              tone: "info",
            })
          }
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-ink-secondary transition-colors hover:bg-tile hover:text-ink"
        >
          <Bell size={18} />
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-badge ring-2 ring-surface"
          />
        </button>

        <Dropdown
          align="right"
          trigger={<Avatar name={user?.name ?? "Pastel Admin"} size="sm" />}
          items={[
            {
              label: "Profile",
              icon: UserRound,
              onClick: () =>
                toast({
                  title: "Profile",
                  description: "Profile settings are not part of this demo.",
                  tone: "info",
                }),
            },
            {
              label: "Settings",
              icon: Settings,
              onClick: () =>
                toast({
                  title: "Settings",
                  description: "Workspace settings are not part of this demo.",
                  tone: "info",
                }),
            },
            {
              label: "Sign out",
              icon: LogOut,
              tone: "danger",
              separatorAbove: true,
              onClick: () => {
                signOut();
                router.push("/login");
              },
            },
          ]}
        />
      </div>
    </header>
  );
}
