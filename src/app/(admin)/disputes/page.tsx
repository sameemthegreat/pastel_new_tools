"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Package,
  RefreshCcw,
  RotateCw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Undo2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import {
  NOW,
  formatCurrency,
  formatDate,
  formatDateTime,
  timeAgo,
} from "@/lib/format";
import { useDisputesStore } from "@/stores/disputesStore";
import type {
  DisputeOrder,
  DisputeType,
  ResolutionOutcome,
  TimelineKind,
} from "@/types/disputes";

const NOW_MS = Date.parse(NOW);
const DAY_MS = 86_400_000;

const typeMeta: Record<DisputeType, { label: string; tone: BadgeTone }> = {
  dispute: { label: "Dispute", tone: "error" },
  declined_dispute: { label: "Declined", tone: "warning" },
  replacement: { label: "Replacement", tone: "success" },
};

const timelineIcon: Record<
  TimelineKind,
  React.ComponentType<{ className?: string }>
> = {
  order: ShoppingBag,
  shipping: Truck,
  message: MessageSquare,
  dispute: AlertTriangle,
  escalation: Scale,
  resolution: CheckCircle2,
};

const timelineTone: Record<TimelineKind, string> = {
  order: "border-hairline bg-tile text-ink-secondary",
  shipping: "border-hairline bg-tile text-ink-secondary",
  message: "border-brand-100 bg-brand-50 text-brand-600",
  dispute: "border-error-100 bg-error-50 text-error-600",
  escalation: "border-warning-100 bg-warning-50 text-warning-600",
  resolution: "border-success-100 bg-success-50 text-success-600",
};

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "disputed", label: "Disputed" },
  { value: "declined", label: "Declined" },
  { value: "replacement", label: "Replacement" },
  { value: "resolved", label: "Resolved" },
  { value: "refunded", label: "Refunded" },
];

const rangeOptions = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
];

function rangeCutoff(range: string): number {
  if (range === "7d") return NOW_MS - 7 * DAY_MS;
  if (range === "30d") return NOW_MS - 30 * DAY_MS;
  if (range === "month") return Date.parse("2026-08-01T00:00:00.000Z");
  return 0;
}

function Party({
  name,
  handle,
  role,
}: {
  name: string;
  handle: string;
  role: "Buyer" | "Seller";
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar name={name} size="sm" />
      <span className="truncate text-ink">{name}</span>
      <span className="hidden text-xs text-ink-muted xl:inline">
        @{handle} · {role.toLowerCase()}
      </span>
    </div>
  );
}

type ConfirmMeta = {
  title: string;
  message: (o: DisputeOrder) => string;
  confirmLabel: string;
  tone: "danger" | "brand";
};

const confirmMeta: Record<ResolutionOutcome, ConfirmMeta> = {
  buyer: {
    title: "Resolve in buyer's favor?",
    message: (o) =>
      `This refunds ${formatCurrency(o.amount)} to ${o.buyerName} for "${o.listingTitle}" and closes the dispute. The seller payout of ${formatCurrency(o.payout)} will be cancelled. This cannot be undone.`,
    confirmLabel: "Refund buyer",
    tone: "danger",
  },
  seller: {
    title: "Resolve in seller's favor?",
    message: (o) =>
      `This releases the ${formatCurrency(o.payout)} payout to ${o.sellerName} (@${o.sellerHandle}) and closes the dispute with no refund to ${o.buyerName}. This cannot be undone.`,
    confirmLabel: "Release payout",
    tone: "brand",
  },
  replacement: {
    title: "Issue a replacement?",
    message: (o) =>
      `${o.sellerName} will be asked to ship a replacement "${o.listingTitle}" to ${o.buyerName}. The payout stays held until the replacement is delivered.`,
    confirmLabel: "Issue replacement",
    tone: "brand",
  },
};

export default function DisputesPage() {
  const orders = useDisputesStore((s) => s.orders);
  const resolvingId = useDisputesStore((s) => s.resolvingId);
  const refreshing = useDisputesStore((s) => s.refreshing);
  const resolve = useDisputesStore((s) => s.resolve);
  const refresh = useDisputesStore((s) => s.refresh);

  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [range, setRange] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pendingOutcome, setPendingOutcome] =
    React.useState<ResolutionOutcome | null>(null);
  const [activeOutcome, setActiveOutcome] =
    React.useState<ResolutionOutcome | null>(null);

  const selected = React.useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId]
  );

  // ---- Stats (over the full dataset, not the filtered view) ----
  const openDisputes = orders.filter((o) => o.status === "disputed").length;
  const resolvedOrders = orders.filter((o) => o.resolution);
  const avgResolutionDays =
    resolvedOrders.length === 0
      ? null
      : resolvedOrders.reduce(
          (sum, o) =>
            sum +
            (Date.parse(o.resolution!.resolvedAt) - Date.parse(o.escalatedAt)) /
              DAY_MS,
          0
        ) / resolvedOrders.length;
  const replacementsThisMonth = orders.filter(
    (o) =>
      o.type === "replacement" &&
      Date.parse(o.escalatedAt) >= Date.parse("2026-08-01T00:00:00.000Z")
  ).length;
  const refundedTotal = orders
    .filter((o) => o.status === "refunded")
    .reduce((sum, o) => sum + o.amount, 0);

  // ---- Filtering ----
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = rangeCutoff(range);
    return orders.filter((o) => {
      if (tab !== "all" && o.type !== tab) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (cutoff && Date.parse(o.escalatedAt) < cutoff) return false;
      if (q) {
        const haystack =
          `${o.transactionId} ${o.buyerName} ${o.buyerHandle} ${o.sellerName} ${o.sellerHandle} ${o.listingTitle}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, tab, statusFilter, range, search]);

  const tabs = [
    { key: "all", label: "All", count: orders.length },
    {
      key: "dispute",
      label: "Disputes",
      count: orders.filter((o) => o.type === "dispute").length,
    },
    {
      key: "declined_dispute",
      label: "Declined Disputes",
      count: orders.filter((o) => o.type === "declined_dispute").length,
    },
    {
      key: "replacement",
      label: "Replacements",
      count: orders.filter((o) => o.type === "replacement").length,
    },
  ];

  const columns: Column<DisputeOrder>[] = [
    {
      key: "transactionId",
      header: "Order ID",
      width: "w-24",
      sortValue: (o) => o.transactionId,
      render: (o) => (
        <span
          className="font-mono text-xs font-medium text-brand-600"
          title={o.transactionId}
        >
          {o.transactionId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "parties",
      header: "Buyer / Seller",
      sortValue: (o) => o.buyerName,
      render: (o) => (
        <div className="flex min-w-0 flex-col gap-1.5">
          <Party name={o.buyerName} handle={o.buyerHandle} role="Buyer" />
          <Party name={o.sellerName} handle={o.sellerHandle} role="Seller" />
        </div>
      ),
    },
    {
      key: "listingTitle",
      header: "Listing",
      sortValue: (o) => o.listingTitle,
      render: (o) => (
        <span
          className="block max-w-56 truncate text-ink-secondary"
          title={o.listingTitle}
        >
          {o.listingTitle}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (o) => o.amount,
      render: (o) => (
        <span className="font-medium tabular-nums text-ink">
          {formatCurrency(o.amount)}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortValue: (o) => o.type,
      render: (o) => (
        <Badge tone={typeMeta[o.type].tone}>{typeMeta[o.type].label}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (o) => o.status,
      render: (o) => <StatusBadge status={o.status} />,
    },
    {
      key: "escalatedAt",
      header: "Escalated",
      sortValue: (o) => Date.parse(o.escalatedAt),
      render: (o) => (
        <span className="text-ink-secondary">{formatDate(o.escalatedAt)}</span>
      ),
    },
    {
      key: "lastUpdatedAt",
      header: "Last Update",
      sortValue: (o) => Date.parse(o.lastUpdatedAt),
      render: (o) => (
        <span className="text-ink-muted">{timeAgo(o.lastUpdatedAt)}</span>
      ),
    },
  ];

  const canResolve =
    selected != null &&
    selected.status !== "resolved" &&
    selected.status !== "refunded";
  const busy = selected != null && resolvingId === selected.id;

  const confirmResolution = (outcome: ResolutionOutcome) => {
    if (!selected) return;
    setActiveOutcome(outcome);
    setPendingOutcome(null);
    resolve(selected.id, outcome);
  };

  return (
    <div>
      <PageHeader
        title="Dispute Orders"
        description="Auto-escalated Sharetribe orders — review disputes, declined disputes, and replacement requests."
        actions={
          <>
            <Button
              variant="outline"
              icon={ExternalLink}
              onClick={() =>
                window.open("https://console.sharetribe.com", "_blank")
              }
            >
              View in Sharetribe
            </Button>
            <Button
              variant="outline"
              icon={RotateCw}
              loading={refreshing}
              onClick={refresh}
            >
              Refresh
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open Disputes"
          value={String(openDisputes)}
          icon={Scale}
          hint="awaiting operator decision"
        />
        <StatCard
          label="Avg Resolution Time"
          value={
            avgResolutionDays == null
              ? "—"
              : `${avgResolutionDays.toFixed(1)} days`
          }
          icon={Clock}
          hint="escalation to resolution"
        />
        <StatCard
          label="Replacements This Month"
          value={String(replacementsThisMonth)}
          icon={RefreshCcw}
          hint="August 2026"
        />
        <StatCard
          label="Refunded Total"
          value={formatCurrency(refundedTotal)}
          icon={Undo2}
          hint="buyer-favor resolutions"
        />
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="my-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search order ID, buyer, seller, or listing…"
          className="w-full sm:w-80"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          className="w-44"
        />
        <Select
          value={range}
          onChange={setRange}
          options={rangeOptions}
          className="w-40"
        />
        <span className="ml-auto text-sm text-ink-muted">
          {filtered.length} {filtered.length === 1 ? "order" : "orders"}
        </span>
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(o) => o.id}
        onRowClick={(o) => setSelectedId(o.id)}
        pageSize={10}
        emptyTitle="No escalated orders"
        emptyDescription="No orders match the current tab and filters. Try clearing the search or widening the date range."
      />

      <Drawer
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={
          selected ? `Order ${selected.transactionId.slice(0, 8)}` : "Order"
        }
        description={selected?.listingTitle}
        width="lg"
        footer={
          selected &&
          (canResolve ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                icon={Package}
                disabled={busy || selected.status === "replacement"}
                loading={busy && activeOutcome === "replacement"}
                onClick={() => setPendingOutcome("replacement")}
              >
                Issue replacement
              </Button>
              <Button
                variant="secondary"
                icon={ShieldCheck}
                disabled={busy}
                loading={busy && activeOutcome === "seller"}
                onClick={() => setPendingOutcome("seller")}
              >
                Seller favor
              </Button>
              <Button
                icon={Undo2}
                disabled={busy}
                loading={busy && activeOutcome === "buyer"}
                onClick={() => setPendingOutcome("buyer")}
              >
                Buyer favor
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 text-sm text-ink-secondary">
              <CheckCircle2 className="h-4 w-4 text-success-600" />
              {selected.resolution
                ? `${
                    selected.resolution.outcome === "buyer"
                      ? "Refunded to buyer"
                      : selected.resolution.outcome === "seller"
                        ? "Resolved in seller's favor"
                        : "Replacement issued"
                  } · ${formatDate(selected.resolution.resolvedAt)} by ${selected.resolution.actor}`
                : "This order is closed."}
            </div>
          ))
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={typeMeta[selected.type].tone}>
                {typeMeta[selected.type].label}
              </Badge>
              <StatusBadge status={selected.status} />
              <a
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                href={`https://console.sharetribe.com/transactions/${selected.transactionId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Sharetribe <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Payin", value: formatCurrency(selected.amount) },
                { label: "Payout", value: formatCurrency(selected.payout) },
                { label: "Escalated", value: formatDate(selected.escalatedAt) },
                {
                  label: "Last update",
                  value: timeAgo(selected.lastUpdatedAt),
                },
              ].map((cell) => (
                <div
                  key={cell.label}
                  className="rounded-xl border border-hairline bg-tile/60 px-3 py-2.5"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                    {cell.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
                    {cell.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Buyer", selected.buyerName, selected.buyerHandle],
                  ["Seller", selected.sellerName, selected.sellerHandle],
                ] as const
              ).map(([role, name, handle]) => (
                <div
                  key={role}
                  className="flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3"
                >
                  <Avatar name={name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {name}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      @{handle} · {role}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-warning-100 bg-warning-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-600" />
                <p className="text-sm font-semibold text-warning-700">
                  Dispute reason
                </p>
              </div>
              <p className="mt-1.5 text-sm text-ink-secondary">
                {selected.disputeReason}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-ink">
                Message from {selected.buyerName}
              </p>
              <blockquote className="rounded-r-lg border-l-2 border-brand-500 bg-tile px-4 py-3 text-sm italic text-ink-secondary">
                “{selected.messageExcerpt}”
              </blockquote>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-ink">
                Order timeline
              </p>
              <ol>
                {selected.timeline.map((step, i) => {
                  const Icon = timelineIcon[step.kind];
                  const isLast = i === selected.timeline.length - 1;
                  return (
                    <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {!isLast && (
                        <span
                          aria-hidden
                          className="absolute bottom-0 left-4 top-8 w-px bg-hairline"
                        />
                      )}
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                          timelineTone[step.kind]
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-medium text-ink">
                          {step.label}
                        </p>
                        {step.detail && (
                          <p className="mt-0.5 text-xs text-ink-secondary">
                            {step.detail}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {formatDateTime(step.at)} · {timeAgo(step.at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={pendingOutcome != null && selected != null}
        onClose={() => setPendingOutcome(null)}
        onConfirm={() => pendingOutcome && confirmResolution(pendingOutcome)}
        title={pendingOutcome ? confirmMeta[pendingOutcome].title : ""}
        message={
          pendingOutcome && selected
            ? confirmMeta[pendingOutcome].message(selected)
            : ""
        }
        confirmLabel={
          pendingOutcome ? confirmMeta[pendingOutcome].confirmLabel : "Confirm"
        }
        tone={pendingOutcome ? confirmMeta[pendingOutcome].tone : "brand"}
      />
    </div>
  );
}
