"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Package,
  Pin,
  RefreshCw,
  ScrollText,
  Smartphone,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { fetchBundleAdoption, listNativeLogs, setStableVersion } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type {
  BundleAdoption,
  BundleAdoptionRow,
  NativeLogEntry,
  PageMeta,
} from "@/types/admin";

type TabKey = "adoption" | "telemetry";

const LEVEL_OPTIONS = [
  { value: "all", label: "All levels" },
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

const LEVEL_TONES: Record<string, BadgeTone> = {
  error: "error",
  warn: "warning",
  info: "neutral",
  debug: "neutral",
};

/** Longest details string shown inline; the full JSON lives in the title attribute. */
const DETAILS_LIMIT = 120;

function platformLabel(key: string): string {
  const lower = key.toLowerCase();
  if (lower === "ios") return "iOS";
  if (lower === "android") return "Android";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function levelLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function detailsText(data: unknown): string {
  if (data == null) return "";
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export default function AppVersionsPage() {
  // UI courtesy only — PUT /admin/app-versions/stable enforces appVersions.manage.
  const canPin = useAuthStore((s) => s.can("appVersions.manage"));
  const [tab, setTab] = useState<TabKey>("adoption");

  // ── Adoption ────────────────────────────────────────────────────────────
  const [adoption, setAdoption] = useState<BundleAdoption | null>(null);
  const [adoptionError, setAdoptionError] = useState<string | null>(null);

  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // ── Telemetry ───────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<NativeLogEntry[] | null>(null);
  const [logsMeta, setLogsMeta] = useState<PageMeta | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [level, setLevel] = useState("all");
  const [eventSearch, setEventSearch] = useState("");
  const [debouncedEvent, setDebouncedEvent] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  // Bumped on every fresh (non-append) telemetry request so stale responses are dropped.
  const logsSeq = useRef(0);

  // Debounce the event box so we query once typing pauses, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedEvent(eventSearch), 350);
    return () => clearTimeout(timer);
  }, [eventSearch]);

  const loadAdoption = useCallback(async () => {
    try {
      const data = await fetchBundleAdoption();
      setAdoption(data);
      setAdoptionError(null);
    } catch (err) {
      setAdoptionError(
        err instanceof ApiError ? err.message : "Could not load bundle adoption."
      );
    }
  }, []);

  const levelParam = level === "all" ? undefined : level;
  const eventParam = debouncedEvent.trim() || undefined;

  const loadLogs = useCallback(async () => {
    const seq = ++logsSeq.current;
    try {
      const page = await listNativeLogs({ level: levelParam, event: eventParam });
      if (logsSeq.current !== seq) return;
      setLogs(page.items);
      setLogsMeta(page.meta);
      setLogsError(null);
    } catch (err) {
      if (logsSeq.current !== seq) return;
      setLogs([]);
      setLogsMeta(null);
      setLogsError(err instanceof ApiError ? err.message : "Could not load native logs.");
    }
  }, [levelParam, eventParam]);

  // Changing the level or the (debounced) event filter starts the list over
  // from page one. Clearing during render (adjust-state-during-render, as
  // DataTable does) shows the skeleton on the very next paint; the effect
  // below only reloads — no setState ever runs inside an effect body.
  const filterKey = `${levelParam ?? ""}|${eventParam ?? ""}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setLogs(null);
    setLogsMeta(null);
    setLogsError(null);
  }

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await loadAdoption();
    };
    void run();
  }, [loadAdoption]);

  useEffect(() => {
    // Same inline-async-wrapper pattern as the adoption loader above.
    const run = async () => {
      await loadLogs();
    };
    void run();
  }, [loadLogs]);

  async function loadMore() {
    if (loadingMore || !logsMeta?.hasNext || !logsMeta.nextCursor) return;
    const seq = logsSeq.current;
    setLoadingMore(true);
    try {
      const page = await listNativeLogs({
        level: levelParam,
        event: eventParam,
        cursor: logsMeta.nextCursor,
      });
      if (logsSeq.current !== seq) return;
      setLogs((prev) => [...(prev ?? []), ...page.items]);
      setLogsMeta(page.meta);
    } catch (err) {
      toast({
        title: "Could not load more events",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  async function handlePin() {
    const version = pinValue.trim();
    if (!version || pinning) return;
    setPinError(null);
    setPinning(true);
    try {
      await setStableVersion(version);
      toast({ title: "Stable version pinned", description: version, tone: "success" });
      setPinValue("");
      await loadAdoption();
    } catch (err) {
      setPinError(err instanceof ApiError ? err.message : "Could not pin the stable version.");
    } finally {
      setPinning(false);
    }
  }

  async function handleClearPin() {
    setClearOpen(false);
    setPinError(null);
    setClearing(true);
    try {
      await setStableVersion(null);
      toast({
        title: "Stable pin cleared",
        description: "Devices now follow the latest release.",
        tone: "success",
      });
      await loadAdoption();
    } catch (err) {
      setPinError(err instanceof ApiError ? err.message : "Could not clear the stable pin.");
    } finally {
      setClearing(false);
    }
  }

  // ── Adoption derived data ───────────────────────────────────────────────
  const bundles = adoption?.bundles ?? [];
  const topBundles = [...bundles].sort((a, b) => b.devices - a.devices).slice(0, 10);

  const platformEntries = Object.entries(adoption?.platforms ?? {}).sort(
    (a, b) => b[1] - a[1]
  );
  const donutData: { label: string; value: number; color: string }[] = [];
  if (platformEntries.length >= 2) {
    const [first, second, ...rest] = platformEntries;
    donutData.push(
      { label: platformLabel(first[0]), value: first[1], color: "var(--color-brand-500)" },
      { label: platformLabel(second[0]), value: second[1], color: "var(--color-success-500)" }
    );
    const other = rest.reduce((sum, [, count]) => sum + count, 0);
    if (other > 0) {
      donutData.push({ label: "Other", value: other, color: "var(--color-ink-muted)" });
    }
  }

  const activePct =
    adoption && adoption.totalDevices > 0
      ? Math.round((adoption.activeLast7Days / adoption.totalDevices) * 100)
      : null;

  const bundleColumns: Column<BundleAdoptionRow>[] = [
    {
      key: "bundleVersion",
      header: "Bundle",
      sortValue: (b) => b.bundleVersion,
      render: (b) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono font-semibold text-ink">{b.bundleVersion}</span>
          {adoption?.stableVersion === b.bundleVersion && <Badge tone="brand">Stable</Badge>}
        </span>
      ),
    },
    {
      key: "devices",
      header: "Devices",
      align: "right",
      sortValue: (b) => b.devices,
      render: (b) => formatNumber(b.devices),
    },
    {
      key: "activeLast7Days",
      header: "Active 7d",
      align: "right",
      sortValue: (b) => b.activeLast7Days,
      render: (b) => {
        const pct = b.devices > 0 ? Math.round((b.activeLast7Days / b.devices) * 100) : 0;
        return (
          <span>
            {formatNumber(b.activeLast7Days)}{" "}
            <span className="text-ink-muted">({pct}%)</span>
          </span>
        );
      },
    },
    {
      key: "lastSeenAt",
      header: "Last seen",
      width: "w-32",
      sortValue: (b) => b.lastSeenAt ?? "",
      render: (b) => (
        <span className="text-ink-secondary">
          {b.lastSeenAt ? timeAgo(b.lastSeenAt) : "—"}
        </span>
      ),
    },
  ];

  const logColumns: Column<NativeLogEntry>[] = [
    {
      key: "createdAt",
      header: "Time",
      width: "w-48",
      sortValue: (l) => l.createdAt,
      render: (l) => (
        <span className="block">
          <span className="block text-ink">{formatDateTime(l.createdAt)}</span>
          <span className="block text-xs text-ink-muted">{timeAgo(l.createdAt)}</span>
        </span>
      ),
    },
    {
      key: "level",
      header: "Level",
      width: "w-24",
      sortValue: (l) => l.level,
      render: (l) => (
        <Badge tone={LEVEL_TONES[l.level] ?? "neutral"} dot>
          {levelLabel(l.level)}
        </Badge>
      ),
    },
    {
      key: "event",
      header: "Event",
      sortValue: (l) => l.event,
      render: (l) => <span className="font-mono text-xs text-ink">{l.event}</span>,
    },
    {
      key: "data",
      header: "Details",
      render: (l) => {
        const full = detailsText(l.data);
        if (!full) return <span className="text-ink-muted">—</span>;
        const shown =
          full.length > DETAILS_LIMIT ? `${full.slice(0, DETAILS_LIMIT)}…` : full;
        return (
          <span className="font-mono text-xs text-ink-secondary" title={full}>
            {shown}
          </span>
        );
      },
    },
    {
      key: "origin",
      header: "Origin",
      width: "w-40",
      render: (l) => <span className="text-ink-muted">{l.origin ?? "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="App Versions"
        description="OTA rollout health — which JS bundles the fleet is running, the pinned stable version, and the telemetry devices report back."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void loadAdoption();
              void loadLogs();
            }}
          >
            <RefreshCw size={15} aria-hidden /> Refresh
          </Button>
        }
      />

      <div className="mb-5">
        <Tabs
          tabs={[
            { key: "adoption", label: "Adoption" },
            { key: "telemetry", label: "Telemetry" },
          ]}
          active={tab}
          onChange={(key) => setTab(key as TabKey)}
        />
      </div>

      {tab === "adoption" && (
        <>
          {adoptionError && (
            <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
              {adoptionError}
            </Card>
          )}

          {adoption === null ? (
            !adoptionError && (
              <Card className="space-y-3 p-6">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </Card>
            )
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Devices total"
                  value={formatNumber(adoption.totalDevices)}
                  icon={Smartphone}
                  hint="Every install that has checked in for an update"
                />
                <StatCard
                  label="Active last 7 days"
                  value={formatNumber(adoption.activeLast7Days)}
                  icon={Activity}
                  hint={activePct !== null ? `${activePct}% of all devices` : undefined}
                />
                <StatCard
                  label="Bundles in the field"
                  value={formatNumber(adoption.bundles.length)}
                  icon={Package}
                  hint="Distinct bundle versions still checking in"
                />
                <StatCard
                  label="Stable pin"
                  value={adoption.stableVersion ?? "Not pinned"}
                  icon={Pin}
                  hint={
                    adoption.stableUpdatedAt
                      ? formatDateTime(adoption.stableUpdatedAt)
                      : "Devices follow the latest release"
                  }
                />
              </div>

              <Card className="mt-4">
                <CardHeader
                  title="Stable version"
                  description="Pin the bundle version the fleet should settle on; clearing the pin lets devices follow the latest release again."
                />
                <CardBody className="space-y-4">
                  {pinError && (
                    <p
                      role="alert"
                      className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
                    >
                      {pinError}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink-secondary">Current pin:</span>
                    {adoption.stableVersion ? (
                      <>
                        <span className="font-mono font-semibold text-ink">
                          {adoption.stableVersion}
                        </span>
                        {adoption.stableUpdatedAt && (
                          <span className="text-xs text-ink-muted">
                            pinned {timeAgo(adoption.stableUpdatedAt)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-ink">
                        Not pinned — devices follow the latest release.
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      aria-label="Version to pin"
                      placeholder="Version to pin, e.g. 1.42.0"
                      value={pinValue}
                      onChange={(e) => setPinValue(e.target.value)}
                      className="w-full sm:w-64"
                    />
                    <Button
                      loading={pinning}
                      disabled={!canPin || !pinValue.trim()}
                      onClick={() => void handlePin()}
                    >
                      Pin version
                    </Button>
                    <Button
                      variant="ghost"
                      loading={clearing}
                      disabled={!canPin || !adoption.stableVersion}
                      onClick={() => setClearOpen(true)}
                    >
                      Clear pin
                    </Button>
                  </div>
                </CardBody>
              </Card>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader
                    title="Adoption by bundle"
                    description="Where the fleet sits across bundle versions — the chart shows the top 10 by devices, the table has every bundle."
                  />
                  {bundles.length === 0 ? (
                    <CardBody>
                      <EmptyState
                        icon={Package}
                        title="No devices reporting yet"
                        description="Adoption fills in as installed apps check in with the bundle version they are currently running."
                      />
                    </CardBody>
                  ) : (
                    <>
                      <CardBody>
                        <BarChart
                          horizontal
                          data={topBundles.map((b) => ({
                            label: b.bundleVersion,
                            value: b.devices,
                          }))}
                          formatValue={formatNumber}
                        />
                      </CardBody>
                      <CardBody className="pt-0">
                        <DataTable
                          rows={bundles}
                          columns={bundleColumns}
                          rowKey={(b) => b.bundleVersion}
                          pageSize={10}
                          emptyTitle="No bundles"
                        />
                      </CardBody>
                    </>
                  )}
                </Card>

                <Card>
                  <CardHeader
                    title="Platforms"
                    description="Reporting devices by native platform."
                  />
                  <CardBody>
                    {platformEntries.length === 0 ? (
                      <EmptyState
                        icon={Smartphone}
                        title="No platform data"
                        description="Platform counts appear once devices report their native runtime alongside update checks."
                      />
                    ) : platformEntries.length === 1 ? (
                      <div className="flex items-center justify-between gap-4 rounded-xl bg-tile/50 px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                            <Smartphone size={18} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {platformLabel(platformEntries[0][0])}
                            </p>
                            <p className="text-xs text-ink-muted">
                              The only platform reporting right now
                            </p>
                          </div>
                        </div>
                        <p className="text-2xl font-bold tabular-nums text-ink">
                          {formatNumber(platformEntries[0][1])}
                        </p>
                      </div>
                    ) : (
                      <DonutChart data={donutData} size={176} />
                    )}
                  </CardBody>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {tab === "telemetry" && (
        <>
          {logsError && (
            <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
              {logsError}
            </Card>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={level}
              onChange={setLevel}
              options={LEVEL_OPTIONS}
              className="sm:w-44"
            />
            <SearchInput
              value={eventSearch}
              onChange={setEventSearch}
              placeholder="Filter by event name…"
              className="w-full sm:w-80"
            />
          </div>

          {logs === null ? (
            <Card className="space-y-3 p-6">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ) : logs.length === 0 && !logsError ? (
            <Card className="p-6">
              <EmptyState
                icon={ScrollText}
                title="No events match"
                description="The app reports OTA update and diagnostic events here as devices check in. Rows expire on a TTL, so an empty list usually means nothing recent matches the current filters."
              />
            </Card>
          ) : (
            <Card className="p-0">
              <DataTable
                rows={logs}
                columns={logColumns}
                rowKey={(l) => l.id}
                pageSize={200}
                emptyTitle="No events"
                footer={
                  logsMeta?.hasNext ? (
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
        </>
      )}

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => void handleClearPin()}
        title="Clear stable pin"
        message={`Removing the pin on "${adoption?.stableVersion ?? ""}" means devices follow the latest release on their next update check.`}
        confirmLabel="Clear pin"
        tone="brand"
      />
    </>
  );
}
