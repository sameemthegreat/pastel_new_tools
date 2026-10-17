"use client";

import { useState } from "react";
import { AlertTriangle, KeyRound, Play } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import {
  isMigrationTarget,
  MIGRATION_SOURCE_META,
  MIGRATION_TARGET_META,
  MIGRATION_TARGETS,
  type MigrationPreMode,
  type MigrationSource,
  type MigrationTarget,
  type TriggerRunInput,
} from "@/types/migration";

/**
 * The one-click full migration: pick the TARGET backend (whose database gets rewritten), pick the
 * Sharetribe SOURCE, then run the whole pipeline (extract → load → … → reconcile). The individual
 * stages still exist on the control plane but are deliberately not exposed here.
 */
export function FullMigrationCard({
  target,
  onTargetChange,
  disabled,
  canRun,
  onRun,
}: {
  target: MigrationTarget;
  onTargetChange: (next: MigrationTarget) => void;
  /** A run is already in progress — the single-flight slot is taken. */
  disabled: boolean;
  /** The operator holds migration.run (superAdmin). */
  canRun: boolean;
  onRun: (input: TriggerRunInput) => void;
}) {
  // No default source: overwriting a database with live vs dev data must be a conscious choice.
  const [source, setSource] = useState<MigrationSource | "">("");
  const [pre, setPre] = useState<MigrationPreMode>("discard");
  const [dryRun, setDryRun] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const blocked = disabled || !canRun || !source;
  const targetMeta = MIGRATION_TARGET_META[target];
  const sourceLabel = source ? MIGRATION_SOURCE_META[source].label : "";

  function build(): TriggerRunInput {
    return { stage: "migrate", source: source || undefined, pre, dryRun };
  }

  const confirmMessage =
    `Target: ${targetMeta.label}. Source: ${sourceLabel}. ` +
    (pre === "discard"
      ? `This EMPTIES ${targetMeta.dbLabel} (truncates all migration-owned tables) with NO backup, then runs the full migration.`
      : `This backs up ${targetMeta.dbLabel}, then EMPTIES it, then runs the full migration.`) +
    (dryRun ? " Dry run is on, so nothing is committed." : "");

  return (
    <Card className="mb-5 border-danger/30">
      <CardHeader
        title="Full migration (one click)"
        description="Choose where the data goes and where it comes from, then run the whole pipeline."
        actions={<Badge tone="error" dot>Destructive</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">1. Target backend</label>
            <Select
              value={target}
              onChange={(v) => {
                if (isMigrationTarget(v)) onTargetChange(v);
              }}
              options={MIGRATION_TARGETS.map((t) => ({ value: t, label: MIGRATION_TARGET_META[t].label }))}
              className="w-full"
            />
            <p className="mt-1 text-xs text-ink-muted">Writes to {targetMeta.dbLabel}.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">2. Sharetribe source</label>
            <Select
              value={source}
              onChange={(v) => setSource(v as MigrationSource | "")}
              options={[
                { value: "", label: "Select a source…" },
                { value: "live", label: MIGRATION_SOURCE_META.live.label },
                { value: "dev", label: MIGRATION_SOURCE_META.dev.label },
              ]}
              className="w-full"
            />
            <p className="mt-1 text-xs text-ink-muted">
              {source ? MIGRATION_SOURCE_META[source].description : "Pick live or dev before running."}
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-secondary">Current data</label>
          <Select
            value={pre}
            onChange={(v) => setPre(v as MigrationPreMode)}
            options={[
              { value: "discard", label: "Discard — empty the DB, NO backup" },
              { value: "backup", label: "Keep — back up first, then empty the DB" },
            ]}
            className="w-full"
          />
        </div>

        <Switch checked={dryRun} onChange={setDryRun} label="Dry run (roll back)" disabled={disabled} />

        <div className="flex items-center justify-between pt-1">
          {!canRun ? (
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <KeyRound size={13} aria-hidden /> superAdmin only
            </span>
          ) : disabled ? (
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <AlertTriangle size={13} aria-hidden /> A run is in progress on this target.
            </span>
          ) : (
            <span className="text-xs text-ink-muted">{dryRun ? "Dry run — nothing is committed" : " "}</span>
          )}
          <Button variant="danger" size="sm" icon={Play} disabled={blocked} onClick={() => setConfirmOpen(true)}>
            Run full migration
          </Button>
        </div>
      </CardBody>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          if (!blocked) onRun(build());
        }}
        title={`Migrate ${sourceLabel} → ${targetMeta.label}?`}
        message={confirmMessage}
        confirmLabel="Run migration"
        tone={pre === "discard" && !dryRun ? "danger" : "brand"}
      />
    </Card>
  );
}
