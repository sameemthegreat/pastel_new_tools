"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { listDisputes } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, humanizeToken, timeAgo } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { AdminDispute, DisputeStatus, PageMeta } from "@/types/admin";
import { DisputeDrawer, disputeStatusMeta } from "./DisputeDrawer";

const TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "offerMade", label: "Offer made" },
  { key: "escalated", label: "Escalated" },
  { key: "resolved", label: "Resolved" },
];

const TAB_STATUS: Record<string, DisputeStatus | undefined> = {
  all: undefined,
  open: "open",
  offerMade: "offerMade",
  escalated: "escalated",
  resolved: "resolved",
};

const columns: Column<AdminDispute>[] = [
  {
    key: "order",
    header: "Order",
    sortValue: (d) => d.order.orderNumber,
    render: (d) => (
      <div className="min-w-0">
        <p className="font-semibold text-ink">{d.order.orderNumber}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{timeAgo(d.order.createdAt)}</p>
      </div>
    ),
  },
  {
    key: "buyer",
    header: "Buyer",
    sortValue: (d) => d.order.customer.email,
    render: (d) => (
      <span className="block max-w-52 truncate text-ink-secondary" title={d.order.customer.email}>
        {d.order.customer.email}
      </span>
    ),
  },
  {
    key: "seller",
    header: "Seller",
    sortValue: (d) => d.order.provider.email,
    render: (d) => (
      <span className="block max-w-52 truncate text-ink-secondary" title={d.order.provider.email}>
        {d.order.provider.email}
      </span>
    ),
  },
  {
    key: "reason",
    header: "Reason",
    render: (d) => (
      <span className="block max-w-56 truncate text-ink-secondary" title={d.reason}>
        {d.reason}
      </span>
    ),
  },
  {
    key: "offer",
    header: "Offer",
    align: "right",
    sortValue: (d) => d.offerAmount ?? -1,
    render: (d) =>
      d.offerAmount != null ? (
        <span className="font-medium tabular-nums text-ink">
          {formatCurrency(d.offerAmount / 100)}
        </span>
      ) : (
        <span className="text-ink-muted">—</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    sortValue: (d) => d.status,
    render: (d) => (
      <Badge tone={disputeStatusMeta[d.status].tone} dot>
        {disputeStatusMeta[d.status].label}
      </Badge>
    ),
  },
  {
    key: "orderState",
    header: "Order state",
    sortValue: (d) => d.order.statusBucket,
    render: (d) => <Badge tone="neutral">{humanizeToken(d.order.statusBucket)}</Badge>,
  },
];

export default function DisputesPage() {
  const [tab, setTab] = useState("all");
  const [disputes, setDisputes] = useState<AdminDispute[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<AdminDispute | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await listDisputes({ status: TAB_STATUS[tab] });
      setDisputes(page.items);
      setMeta(page.meta);
      setError(null);
      // Keep an open drawer in sync with the freshest copy of its dispute.
      setSelected((prev) =>
        prev ? (page.items.find((d) => d.id === prev.id) ?? prev) : null
      );
    } catch (err) {
      setDisputes([]);
      setMeta(null);
      setError(err instanceof ApiError ? err.message : "Could not load disputes.");
    }
  }, [tab]);

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  function changeTab(key: string) {
    if (key === tab) return;
    setTab(key);
    // Back to the skeleton while the new tab's first page loads; cursor resets with it.
    setDisputes(null);
    setMeta(null);
    setError(null);
  }

  const loadMore = useCallback(async () => {
    if (loadingMore || !meta?.hasNext || !meta.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await listDisputes({
        status: TAB_STATUS[tab],
        cursor: meta.nextCursor,
      });
      setDisputes((prev) => [...(prev ?? []), ...page.items]);
      setMeta(page.meta);
    } catch (err) {
      toast({
        title: "Could not load more disputes",
        description: err instanceof ApiError ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, meta, tab]);

  return (
    <>
      <PageHeader
        title="Disputes"
        description="Buyer-opened disputes across the marketplace — review each case and resolve the underlying order."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden /> Refresh
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs tabs={TABS} active={tab} onChange={changeTab} />
      </div>

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      {disputes === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : disputes.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={Scale}
            title="No disputes here"
            description={
              tab === "all"
                ? "No buyer has an open case right now. New disputes appear the moment they are filed."
                : "Nothing matches this status right now. Check the other tabs or refresh."
            }
          />
        </Card>
      ) : (
        <DataTable
          rows={disputes}
          columns={columns}
          rowKey={(d) => d.id}
          onRowClick={(d) => setSelected(d)}
          pageSize={200}
          emptyTitle="No disputes"
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
      )}

      <DisputeDrawer
        dispute={selected}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </>
  );
}
