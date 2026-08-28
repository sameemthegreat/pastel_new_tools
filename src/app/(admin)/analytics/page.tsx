"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Eye, RefreshCw, ShoppingBag, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { fetchDailyAnalytics } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCompact, formatDate, formatNumber } from "@/lib/format";
import type { AnalyticsDay } from "@/types/admin";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const DEFAULT_RANGE = "30";
const DAY_MS = 86_400_000;

/** "Aug 21" — short x-axis labels; pinned to UTC like the rest of the console. */
const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function shortDay(day: string): string {
  return shortDayFormatter.format(new Date(`${day}T00:00:00.000Z`));
}

/** First day of an N-day window ending today (UTC), as "YYYY-MM-DD". */
function fromForRange(range: string): string {
  const n = Number(range);
  return new Date(Date.now() - (n - 1) * DAY_MS).toISOString().slice(0, 10);
}

function zeroDay(day: string): AnalyticsDay {
  return {
    day,
    pageViews: 0,
    uniqueSessions: 0,
    signups: 0,
    emailVerifications: 0,
    cartAdds: 0,
    checkoutStarts: 0,
    paymentStepViews: 0,
    reviewStepViews: 0,
    checkoutCompletes: 0,
    shopVisits: {},
    referrals: {},
  };
}

/**
 * The endpoint skips days with no traffic entirely, so a charted range has to
 * be re-densified client-side: one row per calendar day, zeros where the
 * tracker recorded nothing, oldest first.
 */
function fillRange(rows: AnalyticsDay[], from: string, to: string): AnalyticsDay[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const filled: AnalyticsDay[] = [];
  const end = Date.parse(`${to}T00:00:00.000Z`);
  for (let t = Date.parse(`${from}T00:00:00.000Z`); t <= end; t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    filled.push(byDay.get(day) ?? zeroDay(day));
  }
  return filled;
}

type Totals = {
  pageViews: number;
  uniqueSessions: number;
  signups: number;
  emailVerifications: number;
  cartAdds: number;
  checkoutStarts: number;
  paymentStepViews: number;
  reviewStepViews: number;
  checkoutCompletes: number;
};

function sumTotals(rows: AnalyticsDay[]): Totals {
  const totals: Totals = {
    pageViews: 0,
    uniqueSessions: 0,
    signups: 0,
    emailVerifications: 0,
    cartAdds: 0,
    checkoutStarts: 0,
    paymentStepViews: 0,
    reviewStepViews: 0,
    checkoutCompletes: 0,
  };
  for (const row of rows) {
    totals.pageViews += row.pageViews;
    totals.uniqueSessions += row.uniqueSessions;
    totals.signups += row.signups;
    totals.emailVerifications += row.emailVerifications;
    totals.cartAdds += row.cartAdds;
    totals.checkoutStarts += row.checkoutStarts;
    totals.paymentStepViews += row.paymentStepViews;
    totals.reviewStepViews += row.reviewStepViews;
    totals.checkoutCompletes += row.checkoutCompletes;
  }
  return totals;
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<AnalyticsDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(DEFAULT_RANGE);

  const load = useCallback(async (rangeValue: string) => {
    try {
      const data = await fetchDailyAnalytics({ from: fromForRange(rangeValue) });
      setDays(data);
      setError(null);
    } catch (err) {
      setDays([]);
      setError(err instanceof ApiError ? err.message : "Could not load analytics.");
    }
  }, []);

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await load(DEFAULT_RANGE);
    };
    void run();
  }, [load]);

  function handleRangeChange(value: string) {
    setRange(value);
    setDays(null);
    setError(null);
    void load(value);
  }

  // Continuous daily series for the charts — one entry per calendar day in the
  // selected window, zero-filled where the tracker has no row.
  const filled = useMemo(
    () => (days === null ? [] : fillRange(days, fromForRange(range), new Date().toISOString().slice(0, 10))),
    [days, range],
  );

  const totals = useMemo(() => sumTotals(days ?? []), [days]);

  const newestFirst = useMemo(() => (days === null ? [] : [...days].reverse()), [days]);

  const chartLabels = useMemo(() => filled.map((d) => shortDay(d.day)), [filled]);

  const columns: Column<AnalyticsDay>[] = [
    {
      key: "day",
      header: "Day",
      sortValue: (d) => d.day,
      render: (d) => <span className="font-medium text-ink">{formatDate(d.day)}</span>,
    },
    {
      key: "pageViews",
      header: "Page views",
      align: "right",
      sortValue: (d) => d.pageViews,
      render: (d) => formatNumber(d.pageViews),
    },
    {
      key: "uniqueSessions",
      header: "Sessions",
      align: "right",
      sortValue: (d) => d.uniqueSessions,
      render: (d) => formatNumber(d.uniqueSessions),
    },
    {
      key: "signups",
      header: "Signups",
      align: "right",
      sortValue: (d) => d.signups,
      render: (d) => formatNumber(d.signups),
    },
    {
      key: "emailVerifications",
      header: "Verifications",
      align: "right",
      sortValue: (d) => d.emailVerifications,
      render: (d) => formatNumber(d.emailVerifications),
    },
    {
      key: "cartAdds",
      header: "Cart adds",
      align: "right",
      sortValue: (d) => d.cartAdds,
      render: (d) => formatNumber(d.cartAdds),
    },
    {
      key: "checkoutStarts",
      header: "Checkout starts",
      align: "right",
      sortValue: (d) => d.checkoutStarts,
      render: (d) => formatNumber(d.checkoutStarts),
    },
    {
      key: "checkoutCompletes",
      header: "Completed",
      align: "right",
      sortValue: (d) => d.checkoutCompletes,
      render: (d) => formatNumber(d.checkoutCompletes),
    },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="The marketplace funnel from first page view to completed checkout, one day at a time."
        actions={
          <>
            <div className="w-44">
              <Select
                value={range}
                onChange={handleRangeChange}
                options={RANGE_OPTIONS}
              />
            </div>
            <Button variant="outline" onClick={() => void load(range)}>
              <RefreshCw size={15} aria-hidden /> Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      {days === null ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="space-y-3 p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </Card>
            ))}
          </div>
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-44 w-full" />
          </Card>
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </div>
      ) : days.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={BarChart3}
            title="No traffic recorded in this range"
            description="The tracker hasn't logged a single page view for these days yet. Try a wider range, or check back once the storefront starts seeing visitors."
            action={
              <Button variant="outline" onClick={() => void load(range)}>
                <RefreshCw size={15} aria-hidden /> Refresh
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Page views"
              value={formatCompact(totals.pageViews)}
              icon={Eye}
              spark={filled.map((d) => d.pageViews)}
            />
            <StatCard
              label="Unique sessions"
              value={formatCompact(totals.uniqueSessions)}
              icon={Users}
              spark={filled.map((d) => d.uniqueSessions)}
            />
            <StatCard
              label="Signups"
              value={formatCompact(totals.signups)}
              icon={UserPlus}
              spark={filled.map((d) => d.signups)}
            />
            <StatCard
              label="Orders completed"
              value={formatCompact(totals.checkoutCompletes)}
              icon={ShoppingBag}
              spark={filled.map((d) => d.checkoutCompletes)}
            />
          </div>

          <Card>
            <CardHeader
              title="Traffic"
              description={`${formatNumber(totals.pageViews)} page views across ${formatNumber(totals.uniqueSessions)} sessions in the selected range.`}
            />
            <CardBody>
              <LineChart
                series={[
                  {
                    name: "Page views",
                    data: filled.map((d) => d.pageViews),
                    color: "var(--color-brand-500)",
                  },
                  {
                    name: "Sessions",
                    data: filled.map((d) => d.uniqueSessions),
                    color: "var(--color-success-500)",
                  },
                ]}
                labels={chartLabels}
                height={240}
              />
            </CardBody>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Checkout funnel"
                description="Where buyers drop off between adding to cart and finishing payment."
              />
              <CardBody>
                <BarChart
                  horizontal
                  data={[
                    { label: "Cart adds", value: totals.cartAdds },
                    { label: "Checkout starts", value: totals.checkoutStarts },
                    { label: "Payment step", value: totals.paymentStepViews },
                    { label: "Review step", value: totals.reviewStepViews },
                    { label: "Completed", value: totals.checkoutCompletes },
                  ]}
                  formatValue={formatNumber}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Signups & verifications"
                description={`${formatNumber(totals.signups)} accounts created, ${formatNumber(totals.emailVerifications)} emails verified.`}
              />
              <CardBody>
                <LineChart
                  series={[
                    {
                      name: "Signups",
                      data: filled.map((d) => d.signups),
                      color: "var(--color-brand-500)",
                    },
                    {
                      name: "Email verifications",
                      data: filled.map((d) => d.emailVerifications),
                      color: "var(--color-success-500)",
                    },
                  ]}
                  labels={chartLabels}
                  height={200}
                />
              </CardBody>
            </Card>
          </div>

          <Card className="p-0">
            <CardHeader
              title="Daily breakdown"
              description="Every day the tracker recorded traffic, newest first — the exact numbers behind the charts above."
            />
            <DataTable
              rows={newestFirst}
              columns={columns}
              rowKey={(d) => d.day}
              pageSize={15}
              emptyTitle="No days recorded"
              emptyDescription="The tracker has no rows for this range."
            />
          </Card>
        </div>
      )}
    </>
  );
}
