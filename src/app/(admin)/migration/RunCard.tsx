"use client";

import { useState } from "react";
import { AlertTriangle, KeyRound, Play } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import type { MigrationStage, TriggerRunInput } from "@/types/migration";

/** Stages that never write get no dry-run toggle (it would be meaningless). */
const READ_ONLY = new Set(["validate", "reconcile"]);

export function RunCard({
  stage,
  disabled,
  canRun,
  onRun,
}: {
  stage: MigrationStage;
  /** A run is already in progress — the single-flight slot is taken. */
  disabled: boolean;
  /** The operator holds migration.run (superAdmin). */
  canRun: boolean;
  onRun: (input: TriggerRunInput) => void;
}) {
  const [seller, setSeller] = useState("");
  const [force, setForce] = useState(false);
  const [limit, setLimit] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const writes = !READ_ONLY.has(stage.key);
  const confirmed = !stage.destructive || confirmText === stage.confirmPhrase;
  const blocked = disabled || !canRun || !confirmed;

  function build(): TriggerRunInput {
    return {
      stage: stage.key,
      seller: stage.params.includes("seller") && seller.trim() ? seller.trim() : undefined,
      force: stage.params.includes("force") ? force : undefined,
      limit: stage.params.includes("limit") && limit.trim() ? Number(limit) : undefined,
      dryRun: writes ? dryRun : undefined,
      confirm: stage.destructive ? stage.confirmPhrase ?? undefined : undefined,
    };
  }

  function handleRun() {
    if (blocked) return;
    if (stage.destructive) {
      setConfirmOpen(true);
      return;
    }
    onRun(build());
  }

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
              A full pg_dump backup is taken first.
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
              {dryRun && writes ? "Dry run — nothing is committed" : " "}
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

      {stage.destructive && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            onRun(build());
            setConfirmText("");
          }}
          title={`Run "${stage.label}"?`}
          message={
            `This TRUNCATES every migration-owned table (incl. migration_map)` +
            `${dryRun ? ", but Dry run is on so it will roll back after the backup." : ". A full pg_dump backup is taken first, then the truncation is committed."}`
          }
          confirmLabel="Run destructive stage"
          tone="danger"
        />
      )}
    </Card>
  );
}
