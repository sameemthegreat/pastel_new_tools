"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Landmark, Receipt, ReceiptText, RefreshCw, RotateCcw, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart } from "@/components/charts/BarChart";
import { fetchSalesTaxSummary, listTaxOrders } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { PageMeta, SalesTaxStateRow, SalesTaxSummary, TaxOrderRow } from "@/types/admin";

const CHART_STATES = 12;

/** Quote a CSV cell only when it needs it (commas, quotes, newlines). */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Integer cents -> "12.34" for CSV output. */
function csvDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function SalesTaxPage() {
  const [summary, setSummary] = useState<SalesTaxSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [orders, setOrders] = useState<TaxOrderRow[] | null>(null);
  const [ordersMeta, setOrdersMeta] = useState<PageMeta | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [stateFilter, setStateFilter] = useState("all");
  const [loadingMore, setLoadingMore] = useState(false);

  // Bumped on every fresh (non-append) ledger request so stale responses are dropped.
  const requestSeq = useRef(0);

  const stateParam = stateFilter === "all" ? undefined : stateFilter;

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchSalesTaxSummary();
      setSummary(data);
      setSummaryError(null);
    } catch (err) {
      setSummaryError(
        err instanceof ApiError ? err.message : "Could not load the sales tax summary."
      );
    }
  }, []);

  const loadLedger = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const page = await listTaxOrders({ state: stateParam });
      if (requestSeq.current !== seq) return;
      setOrders(page.items);
      setOrdersMeta(page.meta);
      setOrdersError(null);
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setOrders([]);
      setOrdersMeta(null);
      setOrdersError(err instanceof ApiError ? err.message : "Could not load the tax ledger.");
    }
  }, [stateParam]);

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await loadSummary();
    };
    void run();
  }, [loadSummary]);

  useEffect(() => {
    // Same shape as above — re-runs when the state filter changes the loader.
    const run = async () => {
      await loadLedger();
    };
    void run();
  }, [loadLedger]);

  /** Filter changes restart the ledger from page one — reset happens right here in the handler. */
  function handleStateFilterChange(value: string) {
    setStateFilter(value);
    setOrders(null);
    setOrdersMeta(null);
    setOrdersError(null);
  }

  async function loadMore() {
    if (loadingMore || !ordersMeta?.hasNext || !ordersMeta.nextCursor) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await listTaxOrders({ state: stateParam, cursor: ordersMeta.nextCursor });
      if (requestSeq.current !== seq) return;
      setOrders((prev) => [...(prev ?? []), ...page.items]);
      setOrdersMeta(page.meta);
    } catch (err) {
      toast({
        title: "Could not load more ledger rows",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  function handleExportCsv() {
    if (!summary || summary.states.length === 0) return;
    const header = ["State", "Orders", "Item subtotal", "Shipping", "Sales tax"];
    const lines = summary.states.map((row) =>
      [
        csvCell(row.state ?? "Unknown"),
        String(row.orders),
        csvDollars(row.amount),
        csvDollars(row.shipping),
        csvDollars(row.salesTax),
      ].join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pastel-sales-tax-summary.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast({
      title: "Summary exported",
      description: `${summary.states.length} state rows written to pastel-sales-tax-summary.csv.`,
      tone: "success",
    });
  }

  const stateOptions = useMemo(() => {
    const states = (summary?.states ?? [])
      .map((row) => row.state)
      .filter((s): s is string => s !== null)
      .sort((a, b) => a.localeCompare(b));
    return [
      { value: "all", label: "All states" },
      ...states.map((s) => ({ value: s, label: s })),
    ];
  }, [summary]);

  const stateRows = useMemo(
    () => (summary ? [...summary.states].sort((a, b) => b.salesTax - a.salesTax) : []),
    [summary]
  );

  const chartData = useMemo(
    () =>
      stateRows.slice(0, CHART_STATES).map((row) => ({
        label: row.state ?? "Unknown",
        value: row.salesTax / 100,
      })),
    [stateRows]
  );

  const stateColumns: Column<SalesTaxStateRow>[] = [
    {
      key: "state",
      header: "State",
      sortValue: (r) => r.state ?? "",
      render: (r) => <span className="font-medium text-ink">{r.state ?? "Unknown"}</span>,
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      sortValue: (r) => r.orders,
      render: (r) => formatNumber(r.orders),
    },
    {
      key: "amount",
      header: "Item subtotal",
      align: "right",
      sortValue: (r) => r.amount,
      render: (r) => <span className="text-ink-secondary">{formatCurrency(r.amount / 100)}</span>,
    },
    {
      key: "shipping",
      header: "Shipping",
      align: "right",
      sortValue: (r) => r.shipping,
      render: (r) => <span className="text-ink-secondary">{formatCurrency(r.shipping / 100)}</span>,
    },
    {
      key: "salesTax",
      header: "Sales tax",
      align: "right",
      sortValue: (r) => r.salesTax,
      render: (r) => (
        <span className="font-semibold text-ink">{formatCurrency(r.salesTax / 100)}</span>
      ),
    },
  ];

  const ledgerColumns: Column<TaxOrderRow>[] = [
    {
      key: "id",
      header: "Order",
      sortValue: (r) => r.id,
      render: (r) => <span className="font-mono text-xs text-ink">{r.id}</span>,
    },
    {
      key: "toState",
      header: "State",
      width: "w-28",
      sortValue: (r) => r.toState ?? "",
      render: (r) => (r.toState ? <Badge tone="neutral">{r.toState}</Badge> : "—"),
    },
    {
      key: "amount",
      header: "Item subtotal",
      align: "right",
      sortValue: (r) => r.amount,
      render: (r) => <span className="text-ink-secondary">{formatCurrency(r.amount / 100)}</span>,
    },
    {
      key: "shipping",
      header: "Shipping",
      align: "right",
      sortValue: (r) => r.shipping,
      render: (r) => <span className="text-ink-secondary">{formatCurrency(r.shipping / 100)}</span>,
    },
    {
      key: "salesTax",
      header: "Sales tax",
      align: "right",
      sortValue: (r) => r.salesTax,
      render: (r) => (
        <span className="font-semibold text-ink">{formatCurrency(r.salesTax / 100)}</span>
      ),
    },
    {
      key: "reportedAt",
      header: "Reported",
      width: "w-36",
      sortValue: (r) => r.reportedAt ?? "",
      render: (r) =>
        r.reportedAt ? (
          <span className="text-ink-secondary">{formatDate(r.reportedAt)}</span>
        ) : (
          <Badge tone="warning" dot>
            Pending
          </Badge>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales Tax"
        description="Tax collected at checkout, mirrored to the tax service — per-state totals for filing plus the order-level ledger behind them."
        actions={
          <>
            <Button variant="outline" icon={RefreshCw} onClick={() => {
              void loadSummary();
              void loadLedger();
            }}>
              Refresh
            </Button>
            <Button
              variant="outline"
              icon={Download}
              disabled={!summary || summary.states.length === 0}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
          </>
        }
      />

      {(summaryError ?? ordersError) && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {summaryError ?? ordersError}
        </Card>
      )}

      {summary === null ? (
        !summaryError && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} className="space-y-3 p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </Card>
              ))}
            </div>
            <Card className="mt-4 space-y-3 p-6">
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </Card>
          </>
        )
      ) : summary.states.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Landmark}
            title="No sales tax collected yet"
            description="Per-state totals appear here once taxed checkouts start settling and orders are mirrored to the tax service."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Tax collected"
              value={formatCurrency(summary.totalSalesTax / 100)}
              icon={Landmark}
              hint="gross, before refund adjustments"
            />
            <StatCard
              label="Tax orders"
              value={formatNumber(summary.totalOrders)}
              icon={Receipt}
              hint="checkouts mirrored to the tax service"
            />
            <StatCard
              label="Refund adjustments"
              value={formatNumber(summary.refundCount)}
              icon={Undo2}
              hint="refunds that reversed collected tax"
            />
            <StatCard
              label="Tax returned"
              value={formatCurrency(summary.refundedSalesTax / 100)}
              icon={RotateCcw}
              hint="tax handed back through refunds"
            />
          </div>

          <Card className="mt-4">
            <CardHeader
              title="By state"
              description={`Top ${Math.min(CHART_STATES, stateRows.length)} states by sales tax charted — the table alongside carries the complete per-state totals.`}
            />
            <CardBody className="grid gap-6 xl:grid-cols-5">
              <div className="xl:col-span-2">
                <BarChart data={chartData} horizontal formatValue={formatCurrency} />
              </div>
              <div className="xl:col-span-3">
                <DataTable
                  rows={stateRows}
                  columns={stateColumns}
                  rowKey={(r) => r.state ?? "unknown"}
                  pageSize={60}
                  emptyTitle="No state totals"
                  emptyDescription="Per-state totals appear once taxed checkouts settle."
                />
              </div>
            </CardBody>
          </Card>
        </>
      )}

      <Card className="mt-4">
        <CardHeader
          title="Ledger"
          description="Every taxed order as it was mirrored to the tax service, with the reporting status of each row."
          actions={
            <Select
              value={stateFilter}
              onChange={handleStateFilterChange}
              options={stateOptions}
              className="w-44"
            />
          }
        />
        {orders === null ? (
          !ordersError && (
            <CardBody className="space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardBody>
          )
        ) : orders.length === 0 && !ordersError ? (
          <CardBody>
            <EmptyState
              icon={ReceiptText}
              title={stateParam ? `No taxed orders for ${stateParam}` : "The ledger is empty"}
              description={
                stateParam
                  ? `Nothing has been recorded for ${stateParam} yet — the ledger fills in as checkouts complete. Switch back to all states to see everything on file.`
                  : "The ledger fills in as checkouts complete — each taxed order lands here and is reported onward to the tax service."
              }
            />
          </CardBody>
        ) : (
          <CardBody>
            <DataTable
              rows={orders}
              columns={ledgerColumns}
              rowKey={(r) => r.id}
              pageSize={200}
              emptyTitle="No ledger rows"
              emptyDescription="Taxed orders appear here as checkouts complete."
              footer={
                ordersMeta?.hasNext ? (
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
          </CardBody>
        )}
      </Card>
    </>
  );
}
