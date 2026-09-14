"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { listUsers, setFoundersBadge } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type { AccountStatus, AdminUser, PageMeta } from "@/types/admin";
import { UserDetailDrawer } from "./UserDetailDrawer";

type StatusTab = "all" | AccountStatus;

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "restricted", label: "Restricted" },
  { key: "banned", label: "Banned" },
  { key: "deleted", label: "Deleted" },
];

const STATUS_TONES: Record<AccountStatus, BadgeTone> = {
  active: "success",
  restricted: "warning",
  banned: "error",
  deleted: "neutral",
};

function statusLabel(status: AccountStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** 'seller' and 'provider' are the same class of account — only they can hold the Founder badge. */
function isSeller(u: AdminUser): boolean {
  return u.userType === "seller" || u.userType === "provider";
}

/** ?foundersBadge= filter: "all" sends nothing; "true"/"false" go through as-is. */
type FounderFilter = "all" | "true" | "false";

export default function UsersPage() {
  // UI courtesy only — POST /admin/users/:id/founders-badge enforces users.moderate itself.
  const canModerate = useAuthStore((s) => s.can("users.moderate"));
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<StatusTab>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [founderFilter, setFounderFilter] = useState<FounderFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loadingMore, setLoadingMore] = useState(false);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  // Founder toggles in flight, by user id — the row checkbox is inert while its request runs.
  const [pendingFounder, setPendingFounder] = useState<ReadonlySet<string>>(new Set());

  // Bumped on every fresh (non-append) request so stale responses are dropped.
  const requestSeq = useRef(0);

  // Debounce the search box so we query once typing pauses, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const statusParam = tab === "all" ? undefined : tab;
  const typeParam = typeFilter === "all" ? undefined : typeFilter;
  const founderParam = founderFilter === "all" ? undefined : founderFilter;
  const searchParam = debouncedSearch.trim() || undefined;

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const page = await listUsers({
        status: statusParam,
        type: typeParam,
        search: searchParam,
        foundersBadge: founderParam,
      });
      if (requestSeq.current !== seq) return;
      setItems(page.items);
      setMeta(page.meta);
      setError(null);
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setItems([]);
      setMeta(null);
      setError(err instanceof ApiError ? err.message : "Could not load users.");
    }
  }, [statusParam, typeParam, searchParam, founderParam]);

  // Changing the status tab or the (debounced) search starts the list over
  // from page one. Clearing during render (adjust-state-during-render, as
  // DataTable does) shows the skeleton on the very next paint; the effect
  // below only reloads.
  const filterKey = `${statusParam ?? ""}|${typeParam ?? ""}|${searchParam ?? ""}|${founderParam ?? ""}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setItems(null);
    setMeta(null);
    setError(null);
  }

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  async function loadMore() {
    if (loadingMore || !meta?.hasNext || !meta.nextCursor) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await listUsers({
        status: statusParam,
        type: typeParam,
        search: searchParam,
        foundersBadge: founderParam,
        cursor: meta.nextCursor,
      });
      if (requestSeq.current !== seq) return;
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setMeta(page.meta);
    } catch (err) {
      toast({
        title: "Could not load more users",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  // Grant/revoke straight from the row (the old console's Founder checkbox). Optimistic: the
  // box flips at once and is put back if the backend refuses; the row is then replaced with
  // the server's copy so `foundersBadgeGrantedAt` is right too.
  async function toggleFounder(user: AdminUser, next: boolean) {
    if (pendingFounder.has(user.id)) return;
    setPendingFounder((prev) => new Set(prev).add(user.id));
    setItems((prev) =>
      prev?.map((u) => (u.id === user.id ? { ...u, foundersBadge: next } : u)) ?? prev
    );
    try {
      const updated = await setFoundersBadge(user.id, next);
      setItems((prev) => prev?.map((u) => (u.id === user.id ? updated : u)) ?? prev);
      toast({
        title: next ? "Founder badge granted" : "Founder badge removed",
        description: user.email,
        tone: "success",
      });
    } catch (err) {
      setItems((prev) =>
        prev?.map((u) => (u.id === user.id ? { ...u, foundersBadge: !next } : u)) ?? prev
      );
      toast({
        title: "Founder badge update failed",
        description: err instanceof ApiError ? err.message : user.email,
        tone: "error",
      });
    } finally {
      setPendingFounder((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(user.id);
        return nextSet;
      });
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: "email",
      header: "Email",
      sortValue: (u) => u.email,
      render: (u) => <span className="font-semibold text-ink">{u.email}</span>,
    },
    {
      key: "userType",
      header: "Type",
      width: "w-36",
      sortValue: (u) => u.userType,
      render: (u) => <span className="capitalize text-ink-secondary">{u.userType}</span>,
    },
    {
      key: "accountStatus",
      header: "Status",
      width: "w-36",
      sortValue: (u) => u.accountStatus,
      render: (u) => (
        <Badge tone={STATUS_TONES[u.accountStatus]} dot>
          {statusLabel(u.accountStatus)}
        </Badge>
      ),
    },
    {
      key: "foundersBadge",
      header: "Founder",
      width: "w-24",
      sortValue: (u) => (u.foundersBadge ? 1 : 0),
      // Sellers get the checkbox; buyers a dash — only sellers can hold the badge. A badge left
      // on a demoted account stays visible so it can still be revoked.
      render: (u) =>
        isSeller(u) || u.foundersBadge ? (
          <input
            type="checkbox"
            aria-label={`Founder badge for ${u.email}`}
            title="Founder badge — shows on top of the seller's New/Active Seller badges"
            className="size-4 cursor-pointer rounded accent-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            checked={u.foundersBadge}
            disabled={!canModerate || pendingFounder.has(u.id) || (!isSeller(u) && !u.foundersBadge)}
            // Keep the row's click (open the drawer) from firing when the box is toggled.
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => void toggleFounder(u, e.target.checked)}
          />
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: "restrictedAt",
      header: "Restricted at",
      width: "w-40",
      sortValue: (u) => u.restrictedAt ?? "",
      render: (u) => (
        <span className="text-ink-secondary">
          {u.restrictedAt ? formatDate(u.restrictedAt) : "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description="Search, review, and moderate marketplace accounts — restrictions and bans take effect immediately."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden /> Refresh
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      <div className="mb-4">
        <Tabs
          tabs={STATUS_TABS}
          active={tab}
          onChange={(key) => setTab(key as StatusTab)}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by email…"
          className="w-full sm:w-80"
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "All types" },
            { value: "customer", label: "Customers" },
            { value: "seller", label: "Sellers" },
            { value: "provider", label: "Providers" },
            { value: "admin", label: "Admins" },
          ]}
          className="w-full sm:w-44"
        />
        <Select
          value={founderFilter}
          onChange={(v) => setFounderFilter(v as FounderFilter)}
          options={[
            { value: "all", label: "Founder: any" },
            { value: "true", label: "Founder Sellers" },
            { value: "false", label: "Not founders" },
          ]}
          className="w-full sm:w-44"
        />
      </div>

      {items === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : items.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={Users}
            title="No users found"
            description="No accounts match the current search, type, Founder, and status filters. Try different terms or another tab."
          />
        </Card>
      ) : (
        <Card className="p-0">
          <DataTable
            rows={items}
            columns={columns}
            rowKey={(u) => u.id}
            onRowClick={(u) => setOpenUserId(u.id)}
            pageSize={200}
            emptyTitle="No users to show"
            footer={
              meta?.hasNext ? (
                <Button
                  variant="outline"
                  size="sm"
                  loading={loadingMore}
                  onClick={() => void loadMore()}
                >
                  Load more
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      <UserDetailDrawer
        userId={openUserId}
        onClose={() => setOpenUserId(null)}
        onChanged={() => void load()}
      />
    </>
  );
}
