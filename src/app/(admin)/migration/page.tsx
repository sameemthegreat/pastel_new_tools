"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Database,
  DatabaseZap,
  History,
  ListChecks,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  getMigrationMapStats,
  getReconcile,
  listRuns,
  listStages,
  triggerRun,
} from "@/lib/api/migration";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type {
  MigrationMapStat,
  MigrationRun,
  MigrationRunStatus,
  MigrationStage,
  ReconcileRow,
  TriggerRunInput,
} from "@/types/migration";
import { LogViewer } from "./LogViewer";
import { RunCard } from "./RunCard";

const TERMINAL: MigrationRunStatus[] = ["succeeded", "failed", "interrupted"];

export default function MigrationPage() {
  const canRead = useAuthStore((s) => s.can("migration.read"));
  const canRun = useAuthStore((s) => s.can("migration.run"));

  const [stages, setStages] = useState<MigrationStage[] | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runs, setRuns] = useState<MigrationRun[] | null>(null);
  const [reconcile, setReconcile] = useState<ReconcileRow[] | null>(null);
  const [mapStats, setMapStats] = useState<MigrationMapStat[] | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStages = useCallback(async () => {
    const { stages: s, activeRunId: active } = await listStages();
    setStages(s);
    setActiveRunId(active);
    // Surface an already-running migration (started elsewhere) without stealing a
    // selection the operator made by clicking a history row.
    setSelectedRunId((cur) => cur ?? active);
  }, []);

  const loadRuns = useCallback(async () => setRuns(await listRuns({ limit: 25 })), []);
  const loadReconcile = useCallback(async () => setReconcile(await getReconcile()), []);
  const loadMapStats = useCallback(async () => setMapStats(await getMigrationMapStats()), []);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadStages(), loadRuns(), loadReconcile(), loadMapStats()]);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the migration service.");
    }
  }, [loadStages, loadRuns, loadReconcile, loadMapStats]);

  useEffect(() => {
    if (!canRead) return;
    void loadAll();
  }, [canRead, loadAll]);

  async function handleRun(input: TriggerRunInput) {
    try {
      const run = await triggerRun(input);
      setSelectedRunId(run.id);
      setActiveRunId(run.id);
      toast({ title: "Migration started", description: `Stage: ${run.stage}`, tone: "success" });
      void loadRuns();
    } catch (err) {
      toast({
        title: "Could not start the run",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    }
  }

  const handleStatusChange = useCallback(
    (status: MigrationRunStatus) => {
      if (TERMINAL.includes(status)) {
        // A run just finished — clear the slot and refresh the world.
        void loadStages();
        void loadRuns();
        void loadReconcile();
        void loadMapStats();
      }
    },
    [loadStages, loadRuns, loadReconcile, loadMapStats]
  );

  if (!canRead) {
    return (
      <>
        <PageHeader title="Migration" description="Control the Sharetribe/Firebase → Postgres migration." />
        <Card className="p-6">
          <EmptyState
            icon={DatabaseZap}
            title="superAdmin only"
            description="The migration control plane truncates and rewrites production data, so it is restricted to super admins. Ask a super admin if you need access."
          />
        </Card>
      </>
    );
  }

  const runColumns: Column<MigrationRun>[] = [
    {
      key: "created_at",
      header: "Started",
      width: "w-44",
      sortValue: (r) => r.created_at,
      render: (r) => (
        <span className="block">
          <span className="block text-ink">{formatDateTime(r.created_at)}</span>
          <span className="block text-xs text-ink-muted">{timeAgo(r.created_at)}</span>
        </span>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-ink">{r.stage}</span>
          {r.dry_run && <Badge tone="neutral">Dry</Badge>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-32",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "triggered_by_email",
      header: "By",
      render: (r) => <span className="text-ink-secondary">{r.triggered_by_email ?? "—"}</span>,
    },
    {
      key: "id",
      header: "",
      width: "w-28",
      render: (r) => (
        <Button variant="ghost" size="sm" icon={ScrollText} onClick={() => setSelectedRunId(r.id)}>
          Logs
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Migration"
        description="Drive and watch the Sharetribe + Firebase → Postgres migration. Every stage is idempotent; one run at a time."
        actions={
          <Button variant="outline" icon={RefreshCw} onClick={() => void loadAll()}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      <Card className="mb-5 border-warning/30 bg-warning/5 p-4">
        <p className="flex items-start gap-2 text-sm text-ink-secondary">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning-600" aria-hidden />
          <span>
            This writes directly to the <strong>production</strong> database. Re-runs are safe
            (idempotent via <span className="font-mono">migration_map</span>), but the{" "}
            <strong>Reset</strong> stage truncates every migration-owned table. Use{" "}
            <strong>Dry run</strong> to rehearse a stage without committing.
            {activeRunId && " A run is currently in progress — stages are locked until it finishes."}
          </span>
        </p>
      </Card>

      {/* Live output for the selected / active run */}
      {selectedRunId && (
        <Card className="mb-5">
          <CardHeader title="Run output" description="Streams live while a stage runs; history is kept per run." />
          <CardBody>
            <LogViewer runId={selectedRunId} onStatusChange={handleStatusChange} />
          </CardBody>
        </Card>
      )}

      {/* Stage run cards */}
      {stages === null ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stages.map((stage) => (
            <RunCard
              key={stage.key}
              stage={stage}
              disabled={!!activeRunId}
              canRun={canRun}
              onRun={handleRun}
            />
          ))}
        </div>
      )}

      {/* Reconcile + migration_map stats */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Reconcile" description="Row-count and dangling-FK sanity checks." />
          <CardBody>
            {reconcile === null ? (
              <Skeleton className="h-24 w-full" />
            ) : reconcile.length === 0 ? (
              <EmptyState icon={ListChecks} title="No data" description="Run a stage first, then reconcile." />
            ) : (
              <ul className="divide-y divide-hairline">
                {reconcile.map((row) => (
                  <li key={row.label} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink-secondary">{row.label}</span>
                    <span className="font-mono font-semibold text-ink">{row.count ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Migration map" description="Source records mapped to target ids, by type." />
          <CardBody>
            {mapStats === null ? (
              <Skeleton className="h-24 w-full" />
            ) : mapStats.length === 0 ? (
              <EmptyState icon={Database} title="Empty" description="Nothing has been migrated yet." />
            ) : (
              <ul className="divide-y divide-hairline">
                {mapStats.map((row) => (
                  <li key={row.source_type} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-mono text-ink-secondary">{row.source_type}</span>
                    <span className="font-mono font-semibold text-ink">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Run history */}
      <Card className="mt-5 p-0">
        <CardHeader title="Run history" description="The most recent migration runs and their outcomes." />
        {runs === null ? (
          <CardBody>
            <Skeleton className="h-40 w-full" />
          </CardBody>
        ) : runs.length === 0 ? (
          <CardBody>
            <EmptyState icon={History} title="No runs yet" description="Trigger a stage above to see it here." />
          </CardBody>
        ) : (
          <CardBody className="pt-0">
            <DataTable rows={runs} columns={runColumns} rowKey={(r) => r.id} pageSize={10} emptyTitle="No runs" />
          </CardBody>
        )}
      </Card>
    </>
  );
}
