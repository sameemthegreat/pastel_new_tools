"use client";

import { useState } from "react";
import { AlertTriangle, KeyRound, Play } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import type {
  BackupFile,
  MigrationPreMode,
  MigrationSource,
  MigrationStage,
  TriggerRunInput,
} from "@/types/migration";

/** Stages that never write get no dry-run toggle (it would be meaningless). */
const READ_ONLY = new Set(["validate", "reconcile"]);

function formatBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(0)}${units[i]}`;
}

export function RunCard({
  stage,
  disabled,
  canRun,
  onRun,
  backups = [],
}: {
  stage: MigrationStage;
  /** A run is already in progress — the single-flight slot is taken. */
  disabled: boolean;
  /** The operator holds migration.run (superAdmin). */
  canRun: boolean;
  onRun: (input: TriggerRunInput) => void;
  /** Available backup files — only used by the restore card (params includes "backupFile"). */
  backups?: BackupFile[];
}) {
  const [seller, setSeller] = useState("");
  const [force, setForce] = useState(false);
  const [limit, setLimit] = useState("");
  const [source, setSource] = useState<MigrationSource>("dev");
  const [pre, setPre] = useState<MigrationPreMode>("discard");
  const [backupFile, setBackupFile] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const wantsBackupFile = stage.params.includes("backupFile");
  const wantsPreMode = stage.params.includes("preMode");
  const writes = !READ_ONLY.has(stage.key);
  const confirmed = !stage.destructive || confirmText === stage.confirmPhrase;
  const backupChosen = !wantsBackupFile || !!backupFile;
  const blocked = disabled || !canRun || !confirmed || !backupChosen;
  // The one-click migrate also gets a confirmation dialog (it can reset), but no typed phrase.
  const needsDialog = stage.destructive || stage.key === "migrate";

  function build(): TriggerRunInput {
    return {
      stage: stage.key,
      seller: stage.params.includes("seller") && seller.trim() ? seller.trim() : undefined,
      force: stage.params.includes("force") ? force : undefined,
      limit: stage.params.includes("limit") && limit.trim() ? Number(limit) : undefined,
      source: stage.params.includes("source") ? source : undefined,
      pre: wantsPreMode ? pre : undefined,
      backupFile: wantsBackupFile ? backupFile : undefined,
      dryRun: writes ? dryRun : undefined,
      confirm: stage.destructive ? stage.confirmPhrase ?? undefined : undefined,
    };
  }

  function handleRun() {
    if (blocked) return;
    if (needsDialog) {
      setConfirmOpen(true);
      return;
    }
    onRun(build());
  }

  const confirmMessage =
    stage.key === "migrate"
      ? pre === "discard"
        ? "This EMPTIES the database (truncates all migration-owned tables) with NO backup, then runs the full migration from the selected source."
        : "This backs up the current database, then EMPTIES it, then runs the full migration from the selected source."
      : stage.key === "restore"
        ? `This RESTORES the database from "${backupFile}", overwriting current data.` +
          (dryRun
            ? " Dry run is on, so a safety backup is taken and the restore is skipped."
            : " A safety backup of the current database is taken first, then the restore is applied.")
        : `This TRUNCATES every migration-owned table (incl. migration_map).` +
          (dryRun
            ? " Dry run is on, so it rolls back after the backup."
            : " A full backup is taken first, then the truncation is committed.");

  return (
    <Card className={stage.destructive ? "border-danger/30" : undefined}>
      <CardHeader
        title={stage.label}
        description={stage.description}
        actions={
          <div className="flex flex-col items-end gap-1">
            {stage.destructive && <Badge tone="error" dot>Destructive</Badge>}
            {stage.needsCreds && <Badge tone="warning">Needs creds</Badge>}
          </div>
        }
      />
      <CardBody className="space-y-3">
        {stage.params.includes("source") && (
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">Source</label>
            <Select
              value={source}
              onChange={(v) => setSource(v as MigrationSource)}
              options={[
                { value: "dev", label: "Dev Sharetribe" },
                { value: "live", label: "Live Sharetribe" },
              ]}
              className="w-full sm:w-56"
            />
          </div>
        )}

        {wantsPreMode && (
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
        )}

        {wantsBackupFile && (
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">Backup to restore</label>
            {backups.length === 0 ? (
              <p className="rounded-lg border border-hairline bg-tile/50 px-3 py-2 text-xs text-ink-muted">
                No backups yet — run <span className="font-medium">Backup database</span> first.
              </p>
            ) : (
              <Select
                value={backupFile}
                onChange={setBackupFile}
                options={[
                  { value: "", label: "Select a backup…" },
                  ...backups.map((b) => ({
                    value: b.name,
                    label: `${b.name} · ${formatBytes(b.sizeBytes)}`,
                  })),
                ]}
                className="w-full"
              />
            )}
          </div>
        )}

        {stage.params.includes("seller") && (
          <Input
            aria-label="Seller source id"
            placeholder="Seller source id (optional — all sellers if blank)"
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
          />
        )}
        {stage.params.includes("limit") && (
          <Input
            aria-label="Image limit"
            placeholder="Limit images (optional smoke test)"
            inputMode="numeric"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
          />
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {stage.params.includes("force") && (
            <Switch checked={force} onChange={setForce} label="Force (ignore checksum)" disabled={disabled} />
          )}
          {writes && (
            <Switch checked={dryRun} onChange={setDryRun} label="Dry run (roll back)" disabled={disabled} />
          )}
        </div>

        {stage.destructive && (
          <div className="rounded-xl border border-danger/25 bg-danger/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-danger">
              <AlertTriangle size={14} aria-hidden /> Type{" "}
              <span className="font-mono font-semibold">{stage.confirmPhrase}</span> to enable.
              A safety backup is taken first.
            </p>
            <Input
              aria-label={`Type ${stage.confirmPhrase} to confirm`}
              placeholder={stage.confirmPhrase ?? ""}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          {!canRun ? (
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <KeyRound size={13} aria-hidden /> superAdmin only
            </span>
          ) : (
            <span className="text-xs text-ink-muted">
              {dryRun && writes ? "Dry run — nothing is committed" : " "}
            </span>
          )}
          <Button
            variant={stage.destructive ? "danger" : "primary"}
            size="sm"
            icon={Play}
            disabled={blocked}
            onClick={handleRun}
          >
            Run
          </Button>
        </div>
      </CardBody>

      {needsDialog && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            onRun(build());
            setConfirmText("");
          }}
          title={`Run "${stage.label}"?`}
          message={confirmMessage}
          confirmLabel={stage.destructive ? "Run destructive stage" : "Run migration"}
          tone={stage.destructive || (stage.key === "migrate" && pre === "discard") ? "danger" : "brand"}
        />
      )}
    </Card>
  );
}
