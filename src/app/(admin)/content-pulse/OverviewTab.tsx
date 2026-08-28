"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Megaphone, TrendingUp, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { getCpEmployeeAnalytics, getCpOverview } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCompact, formatNumber } from "@/lib/format";
import type { CpEmployeeAnalytics, CpOverview } from "@/types/admin";

const DAY_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const DEFAULT_DAYS = "30";

/** "Aug 21" — short x-axis labels, pinned to UTC like the rest of the console. */
const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function shortDay(day: string): string {
  return shortDayFormatter.format(new Date(`${day.slice(0, 10)}T00:00:00.000Z`));
}

/** engagementRate is a ratio — 0.042 renders as "4.2%". */
function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function OverviewTab({
  refreshKey,
  onImportFile,
}: {
  refreshKey: number;
  onImportFile: () => void;
}) {
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [overview, setOverview] = useState<CpOverview | null>(null);
  const [employeeRows, setEmployeeRows] = useState<CpEmployeeAnalytics[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bumped on every request so a stale response never lands over a newer one.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const [nextOverview, nextEmployees] = await Promise.all([
        getCpOverview(Number(days)),
        getCpEmployeeAnalytics(),
      ]);
      if (requestSeq.current !== seq) return;
      setOverview(nextOverview);
      setEmployeeRows(nextEmployees);
      setError(null);
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setOverview(null);
      setEmployeeRows(null);
      setError(err instanceof ApiError ? err.message : "Could not load the overview.");
    }
  }, [days]);

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await load();
    };
    void run();
  }, [load, refreshKey]);

  // Changing the window resets to the skeleton in the event handler; the
  // effect above reloads because `load` closes over the new value.
  function handleDaysChange(value: string) {
    setDays(value);
    setOverview(null);
    setEmployeeRows(null);
    setError(null);
  }

  const chartLabels = useMemo(
    () => (overview === null ? [] : overview.series.map((d) => shortDay(d.day))),
    [overview]
  );

  const columns: Column<CpEmployeeAnalytics>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.name,
      render: (r) =>
        r.employeeId === null ? (
          <span className="text-ink-muted">Unassigned</span>
        ) : (
          <span className="block">
            <span className="block font-semibold text-ink">{r.name}</span>
            {r.handle && <span className="block text-xs text-ink-muted">{r.handle}</span>}
          </span>
        ),
    },
    {
      key: "posts",
      header: "Posts",
      align: "right",
      sortValue: (r) => r.posts,
      render: (r) => formatNumber(r.posts),
    },
    {
      key: "views",
      header: "Views",
      align: "right",
      sortValue: (r) => r.views,
      render: (r) => formatCompact(r.views),
    },
    {
      key: "reach",
      header: "Reach",
      align: "right",
      sortValue: (r) => r.reach,
      render: (r) => formatCompact(r.reach),
    },
    {
      key: "likes",
      header: "Likes",
      align: "right",
      sortValue: (r) => r.likes,
      render: (r) => formatCompact(r.likes),
    },
    {
      key: "saves",
      header: "Saves",
      align: "right",
      sortValue: (r) => r.saves,
      render: (r) => formatCompact(r.saves),
    },
    {
      key: "avgEngagementRate",
      header: "Avg engagement",
      align: "right",
      sortValue: (r) => r.avgEngagementRate,
      render: (r) => formatPercent(r.avgEngagementRate),
    },
  ];

  return (
    <>
      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      <div className="mb-4 flex justify-end">
        <div className="w-44">
          <Select value={days} onChange={handleDaysChange} options={DAY_OPTIONS} />
        </div>
      </div>

      {overview === null || employeeRows === null ? (
        !error ? (
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
        ) : null
      ) : overview.totals.posts === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Megaphone}
            title="No posts in this window"
            description="Nothing published in the selected range has been imported yet. Import a platform export file, or widen the window."
            action={
              <Button onClick={onImportFile}>
                <Upload size={15} aria-hidden /> Import file
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Posts"
              value={formatNumber(overview.totals.posts)}
              icon={Megaphone}
              hint={`last ${overview.days} days`}
            />
            <StatCard
              label="Views"
              value={formatCompact(overview.totals.views)}
              icon={Eye}
              spark={overview.series.map((d) => d.views)}
            />
            <StatCard
              label="Reach"
              value={formatCompact(overview.totals.reach)}
              icon={Users}
              spark={overview.series.map((d) => d.reach)}
            />
            <StatCard
              label="Avg engagement"
              value={formatPercent(overview.totals.avgEngagementRate)}
              icon={TrendingUp}
              hint="interactions per view"
            />
          </div>

          <Card>
            <CardHeader
              title="Views & reach"
              description={`${formatNumber(overview.totals.views)} views across ${formatNumber(
                overview.totals.reach
              )} accounts reached, day by day.`}
            />
            <CardBody>
              <LineChart
                series={[
                  {
                    name: "Views",
                    data: overview.series.map((d) => d.views),
                    color: "var(--color-brand-500)",
                  },
                  {
                    name: "Reach",
                    data: overview.series.map((d) => d.reach),
                    color: "var(--color-success-500)",
                  },
                ]}
                labels={chartLabels}
                height={240}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Interactions"
              description="How the audience engaged across every post in the selected window."
            />
            <CardBody>
              <BarChart
                horizontal
                data={[
                  { label: "Likes", value: overview.totals.likes },
                  { label: "Shares", value: overview.totals.shares },
                  { label: "Saves", value: overview.totals.saves },
                  { label: "Comments", value: overview.totals.comments },
                  { label: "Follows", value: overview.totals.follows },
                ]}
                formatValue={formatNumber}
              />
            </CardBody>
          </Card>

          <Card className="p-0">
            <CardHeader
              title="By teammate"
              description="All-time attribution totals — the exact numbers behind the charts, one row per teammate plus the unassigned bucket."
            />
            <DataTable
              rows={employeeRows}
              columns={columns}
              rowKey={(r) => r.employeeId ?? "unassigned"}
              pageSize={15}
              emptyTitle="No attribution yet"
              emptyDescription="Assign posts to teammates on the Posts tab to build this breakdown."
            />
          </Card>
        </div>
      )}
    </>
  );
}
