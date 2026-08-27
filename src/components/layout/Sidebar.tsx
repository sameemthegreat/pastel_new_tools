"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Palette, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/components/layout/nav";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

function NavLink({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        collapsed && "justify-center px-0 py-2.5",
        active
          ? "bg-brand-50 font-medium text-brand-700"
          : "text-ink-secondary hover:bg-tile hover:text-ink"
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand-500"
        />
      )}
      <span className="relative shrink-0">
        <Icon size={18} strokeWidth={active ? 2.25 : 2} />
        {collapsed && item.badge !== undefined && item.badge > 0 && (
          <span
            aria-hidden
            className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-badge ring-2 ring-surface"
          />
        )}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-brand-700">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
  showClose,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  showClose?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || user?.role === "admin"),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 border-b border-hairline px-4",
          collapsed && "justify-center px-2"
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
          <Palette size={18} />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-[15px] font-bold leading-tight tracking-tight text-ink">
              Pastel
            </span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Admin Console
            </span>
          </span>
        )}
        {showClose && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-2 text-ink-secondary transition-colors hover:bg-tile hover:text-ink"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Grouped nav */}
      <nav
        className={cn(
          "scrollbar-thin flex-1 space-y-5 overflow-y-auto py-4",
          collapsed ? "px-2.5" : "px-3"
        )}
      >
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  active={pathname.startsWith(item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: collapse toggle + user card */}
      <div className="shrink-0 border-t border-hairline p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "mb-2 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-tile hover:text-ink lg:flex",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>

        <div
          className={cn(
            "flex items-center gap-3 rounded-xl bg-tile/60 p-2.5",
            collapsed && "flex-col gap-2 bg-transparent p-0"
          )}
        >
          <Avatar name={user?.name ?? "Pastel Admin"} size="sm" />
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                {user?.name ?? "Signed out"}
              </span>
              <span className="block truncate text-xs capitalize text-ink-muted">
                {user?.role ?? "guest"}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              signOut();
              router.push("/login");
            }}
            title="Sign out"
            aria-label="Sign out"
            className="shrink-0 rounded-lg p-2 text-ink-secondary transition-colors hover:bg-tile hover:text-danger"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-hairline bg-surface transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-[264px]"
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile overlay drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[264px] flex-col border-r border-hairline bg-surface shadow-xl">
            <SidebarContent
              collapsed={false}
              onNavigate={() => setMobileNavOpen(false)}
              showClose
            />
          </aside>
        </div>
      )}
    </>
  );
}
