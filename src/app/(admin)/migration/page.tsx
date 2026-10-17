"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Database, DatabaseZap, History, RefreshCw, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getMigrationMapStats, listRuns, listStages, triggerRun } from "@/lib/api/migration";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { useMigrationTargetStore } from "@/stores/migrationTargetStore";
import { toast } from "@/stores/uiStore";
import {
  MIGRATION_TARGET_META,
  type MigrationMapStat,
  type MigrationRun,
  type MigrationRunStatus,
  type TriggerRunInput,
  type MigrationTarget,
} from "@/types/migration";
import { BackendSwitchCard } from "./BackendSwitchCard";
import { FullMigrationCard } from "./FullMigrationCard";
import { LogViewer } from "./LogViewer";

const TERMINAL: MigrationRunStatus[] = ["succeeded", "failed", "interrupted"];

export default function MigrationPage() {
  const canRead = useAuthStore((s) => s.can("migration.read"));
  const canRun = useAuthStore((s) => s.can("migration.run"));
  const target = useMigrationTargetStore((s) => s.target);
  const setTarget = useMigrationTargetStore((s) => s.setTarget);
  const targetMeta = MIGRATION_TARGET_META[target];

  const [stagesLoaded, setStagesLoaded] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runs, setRuns] = useState<MigrationRun[] | null>(null);
  const [mapStats, setMapStats] = useState<MigrationMapStat[] | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStages = useCallback(async () => {
    // Only the active-run slot matters here; the single-step stages are not exposed in this UI.
    const { activeRunId: active } = await listStages();
    setStagesLoaded(true);
    setActiveRunId(active);
    // Surface an already-running migration (started elsewhere) without stealing a
    // selection the operator made by clicking a history row.
    setSelectedRunId((cur) => cur ?? active);
  }, []);

  const loadRuns = useCallback(async () => setRuns(await listRuns({ limit: 25 })), []);
  const loadMapStats = useCallback(async () => setMapStats(await getMigrationMapStats()), []);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadStages(), loadRuns(), loadMapStats()]);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the migration service.");
    }
  }, [loadStages, loadRuns, loadMapStats]);

  // Re-fetch whenever the TARGET environment changes (the API client reads the selection from
  // the store, so the same loaders now hit the other control plane).
  useEffect(() => {
    if (!canRead) return;
    void loadAll();
  }, [canRead, loadAll, target]);

  // Switching target: drop every panel first so stale rows from the other control plane never
  // linger (a run id from dev means nothing to staging), then let the effect above refill them.
  function switchTarget(next: MigrationTarget) {
    if (next === target) return;
    setStagesLoaded(false);
    setActiveRunId(null);
    setRuns(null);
    setMapStats(null);
    setSelectedRunId(null);
    setError(null);
    setTarget(next);
  }

  async function handleRun(input: TriggerRunInput) {
    try {
      const run = await triggerRun(input);
      setSelectedRunId(run.id);
      setActiveRunId(run.id);
      toast({
        title: "Migration started",
        description: `Target: ${MIGRATION_TARGET_META[target].label}`,
        tone: "success",
      });
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
        void loadMapStats();
      }
    },
    [loadStages, loadRuns, loadMapStats]
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
        description="Run the full Sharetribe + Firebase → Postgres migration into Preview prod or Preview staging. One run at a time per target."
        actions={
          <Button variant="outline" icon={RefreshCw} onClick={() => void loadAll()}>
            Refresh
          </Button>
        }
      />

      {/* Cutover switches — one gateway per environment, each repointing that environment's app
          builds between Sharetribe and the v2 wrapper. Production and staging flip independently. */}
      <BackendSwitchCard env="production" canRun={canRun} />
      <BackendSwitchCard env="staging" canRun={canRun} />

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      <Card className="mb-5 border-warning/30 bg-warning/5 p-4">
        <p className="flex items-start gap-2 text-sm text-ink-secondary">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning-600" aria-hidden />
          <span>
            Target: <strong>{targetMeta.label}</strong> — a full migration empties and rewrites{" "}
            {targetMeta.dbLabel}. Record ids stay stable across re-runs (via{" "}
            <span className="font-mono">migration_map</span>). Use <strong>Dry run</strong> to rehearse
            without committing.
            {activeRunId && " A run is currently in progress — the migration is locked until it finishes."}
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

      {/* The one-click full migration — the only runnable action on this page */}
      {!stagesLoaded ? (
        <Card className="mb-5 space-y-3 p-5">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </Card>
      ) : (
        <FullMigrationCard
          key={target}
          target={target}
          onTargetChange={switchTarget}
          disabled={!!activeRunId}
          canRun={canRun}
          onRun={handleRun}
        />
      )}

      {/* migration_map stats */}
      <Card className="mb-5">
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

      {/* Run history */}
      <Card className="p-0">
        <CardHeader title="Run history" description="The most recent migration runs and their outcomes." />
        {runs === null ? (
          <CardBody>
            <Skeleton className="h-40 w-full" />
          </CardBody>
        ) : runs.length === 0 ? (
          <CardBody>
            <EmptyState icon={History} title="No runs yet" description="Run a full migration above to see it here." />
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
