"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Package, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { listOrders } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, humanizeToken, timeAgoLive } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { AdminOrder, OrderStatusBucket, PageMeta } from "@/types/admin";
import { OrderDrawer } from "./OrderDrawer";

/** Every bucket the backend's list endpoint accepts as its single `status` param. */
const ORDER_STATUS_BUCKETS: OrderStatusBucket[] = [
  "pendingPayment",
  "preparingShipment",
  "inTransit",
  "delivered",
  "pendingReview",
  "completed",
  "disputed",
  "refundOffered",
  "partiallyRefunded",
  "refunded",
  "disputeEscalated",
  "disputeResolved",
  "canceled",
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...ORDER_STATUS_BUCKETS.map((bucket) => ({ value: bucket, label: humanizeToken(bucket) })),
];

const columns: Column<AdminOrder>[] = [
  {
    key: "order",
    header: "Order",
    sortValue: (o) => o.orderNumber,
    render: (o) => (
      <div className="min-w-0">
        <p className="font-semibold text-ink">{o.orderNumber}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{timeAgoLive(o.createdAt)}</p>
      </div>
    ),
  },
  {
    key: "buyer",
    header: "Buyer",
    sortValue: (o) => o.customer.email,
    render: (o) => (
      <span className="block max-w-52 truncate text-ink-secondary" title={o.customer.email}>
        {o.customer.email}
      </span>
    ),
  },
  {
    key: "seller",
    header: "Seller",
    sortValue: (o) => o.provider.email,
    render: (o) => (
      <span className="block max-w-52 truncate text-ink-secondary" title={o.provider.email}>
        {o.provider.email}
      </span>
    ),
  },
  {
    key: "total",
    header: "Total",
    align: "right",
    sortValue: (o) => o.payinTotalAmount,
    render: (o) => (
      <span className="font-medium tabular-nums text-ink">
        {formatCurrency(o.payinTotalAmount / 100)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortValue: (o) => o.statusBucket,
    render: (o) => <StatusBadge status={humanizeToken(o.statusBucket)} />,
  },
  {
    key: "lastTransition",
    header: "Last transition",
    sortValue: (o) => o.lastTransitionedAt ?? "",
    render: (o) =>
      o.lastTransition ? (
        <div className="min-w-0">
          <p className="truncate text-ink-secondary">{humanizeToken(o.lastTransition)}</p>
          {o.lastTransitionedAt && (
            <p className="mt-0.5 text-xs text-ink-muted">{timeAgoLive(o.lastTransitionedAt)}</p>
          )}
        </div>
      ) : (
        <span className="text-ink-muted">—</span>
      ),
  },
];

export default function OrdersPage() {
  const [items, setItems] = useState<AdminOrder[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  // Bumped on every fresh (non-append) request so stale responses are dropped.
  const requestSeq = useRef(0);

  // Debounce the search box so we query once typing pauses, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const statusParam = statusFilter === "all" ? undefined : statusFilter;
  const searchParam = debouncedSearch.trim() || undefined;

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const page = await listOrders({ status: statusParam, search: searchParam });
      if (requestSeq.current !== seq) return;
      setItems(page.items);
      setMeta(page.meta);
      setError(null);
      // Keep an open drawer in sync with the freshest copy of its order.
      setSelected((prev) => (prev ? (page.items.find((o) => o.id === prev.id) ?? prev) : null));
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setItems([]);
      setMeta(null);
      setError(err instanceof ApiError ? err.message : "Could not load orders.");
    }
  }, [statusParam, searchParam]);

  // Changing the status filter or the (debounced) search starts the list over
  // from page one. Clearing during render (adjust-state-during-render, as
  // DataTable does) shows the skeleton on the very next paint; the effect
  // below only reloads.
  const filterKey = `${statusParam ?? ""}|${searchParam ?? ""}`;
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
      const page = await listOrders({
        status: statusParam,
        search: searchParam,
        cursor: meta.nextCursor,
      });
      if (requestSeq.current !== seq) return;
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setMeta(page.meta);
    } catch (err) {
      toast({
        title: "Could not load more orders",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every order, its lifecycle, and the money levers."
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by order number (PST-…)"
          className="w-full sm:w-80"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          className="w-full sm:w-52"
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
            icon={Package}
            title="No orders found"
            description={
              statusFilter === "all" && !searchParam
                ? "No orders have been placed yet. New orders appear here the moment checkout completes."
                : "Nothing matches the current status and search filters. Try different terms or another status."
            }
          />
        </Card>
      ) : (
        <Card className="p-0">
          <DataTable
            rows={items}
            columns={columns}
            rowKey={(o) => o.id}
            onRowClick={(o) => setSelected(o)}
            pageSize={200}
            emptyTitle="No orders to show"
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

      <OrderDrawer order={selected} onClose={() => setSelected(null)} onChanged={load} />
    </>
  );
}
