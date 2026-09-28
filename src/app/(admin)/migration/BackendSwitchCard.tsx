"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowRightLeft, KeyRound, RefreshCw, Rocket, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { getGatewayStatus, setGatewayTarget } from "@/lib/api/gateway";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, timeAgo } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import { GATEWAY_TARGET_LABELS, type GatewayStatus, type GatewayTarget } from "@/types/gateway";

/**
 * The cutover switch. Repoints EVERY installed app build (old ones included) between Sharetribe and
 * the v2 wrapper in one call — no store release, no rebuild. Rollback is the same switch flipped
 * back. Talks straight to the gateway via `/api/gateway/*` so a rollback works even when the backend
 * is unhealthy. superAdmin only; the server verifies before the gateway token is ever spent.
 */
export function BackendSwitchCard({ canRun }: { canRun: boolean }) {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<GatewayTarget | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<GatewayTarget | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await getGatewayStatus());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the API gateway.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function flip(target: GatewayTarget) {
    setPending(target);
    try {
      const result = await setGatewayTarget(target);
      toast({
        title: "Backend switched",
        description: `All apps now hit ${GATEWAY_TARGET_LABELS[result.target]}.`,
        tone: "success",
      });
      await load();
    } catch (err) {
      toast({
        title: "Switch failed",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setPending(null);
      setConfirmTarget(null);
    }
  }

  const current = status?.target ?? null;
  const onWrapper = current === "wrapper";
  const busy = pending !== null;

  return (
    <Card className="mb-5 border-brand-500/30">
      <CardHeader
        title="Backend switch"
        description="Repoints every installed app build between Sharetribe and the v2 wrapper. One click moves everyone at once; the same switch rolls back."
        actions={
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      <CardBody className="space-y-4">
        {error && (
          <p className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        {status === null && !error ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : status ? (
          <>
            {/* Live routing state */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <ArrowRightLeft size={15} aria-hidden />
                Traffic is going to
              </span>
              <Badge tone={onWrapper ? "success" : "gold"} dot>
                {GATEWAY_TARGET_LABELS[status.target]}
              </Badge>
              <span className="font-mono text-xs text-ink-muted">{status.upstream}</span>
            </div>
            <p className="text-xs text-ink-muted">
              {status.switchedAt
                ? `Last switched ${timeAgo(status.switchedAt)} · ${formatDateTime(status.switchedAt)}`
                : "Never switched — running on the deploy default."}
            </p>

            {/* Operational warnings */}
            {!status.runtimeFlipArmed && (
              <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 p-3 text-xs text-danger">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                The gateway has no admin token set, so flipping is disabled. Set{" "}
                <span className="font-mono">GATEWAY_ADMIN_TOKEN</span> on the gateway and restart it.
              </p>
            )}
            {status.targetHeaderEnabled && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-ink-secondary">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning-600" aria-hidden />
                The <span className="font-mono">X-Gateway-Target</span> test header is enabled — any
                caller can force their own target. Turn it off once cutover is stable.
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {!canRun ? (
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <KeyRound size={13} aria-hidden /> superAdmin only
                </span>
              ) : (
                <span className="text-xs text-ink-muted">
                  Affects all live apps immediately — confirm carefully.
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  icon={Undo2}
                  disabled={!canRun || onWrapper === false || busy || !status.runtimeFlipArmed}
                  loading={pending === "sharetribe"}
                  onClick={() => setConfirmTarget("sharetribe")}
                >
                  Roll back to Sharetribe
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Rocket}
                  disabled={!canRun || onWrapper === true || busy || !status.runtimeFlipArmed}
                  loading={pending === "wrapper"}
                  onClick={() => setConfirmTarget("wrapper")}
                >
                  Cut over to v2
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardBody>

      {confirmTarget && (
        <ConfirmDialog
          open={confirmTarget !== null}
          onClose={() => setConfirmTarget(null)}
          onConfirm={() => void flip(confirmTarget)}
          title={
            confirmTarget === "wrapper"
              ? "Cut all apps over to the v2 backend?"
              : "Roll all apps back to Sharetribe?"
          }
          message={
            confirmTarget === "wrapper"
              ? "Every installed app build — old ones included — will start hitting the v2 wrapper immediately. Make sure the wrapper is verified end-to-end. You can roll back from here at any time."
              : "Every installed app build will be sent back to Sharetribe immediately. Use this to abort a cutover that is misbehaving."
          }
          confirmLabel={confirmTarget === "wrapper" ? "Cut over to v2" : "Roll back to Sharetribe"}
          tone={confirmTarget === "wrapper" ? "brand" : "danger"}
        />
      )}
    </Card>
  );
}
