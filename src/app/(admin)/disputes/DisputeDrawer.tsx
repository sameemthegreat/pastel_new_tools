"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Package, ShieldCheck, Undo2, Wallet } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import {
  approveReplacement,
  getRefundEligibility,
  refundOrder,
  releaseOrder,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatDate, timeAgo } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type { AdminDispute, DisputeStatus, RefundEligibility } from "@/types/admin";

/** Badge tone + label per dispute status — shared with the list page. */
export const disputeStatusMeta: Record<DisputeStatus, { label: string; tone: BadgeTone }> = {
  open: { label: "Open", tone: "warning" },
  underReview: { label: "Under review", tone: "brand" },
  offerMade: { label: "Offer made", tone: "gold" },
  escalated: { label: "Escalated", tone: "error" },
  resolved: { label: "Resolved", tone: "success" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

/** "preparingShipment" -> "Preparing shipment"; "fullRefund" -> "Full refund". */
export function humanizeToken(value: string): string {
  const spaced = value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const inlineErrorClasses =
  "rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger";

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-tile/60 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export function DisputeDrawer({
  dispute,
  onClose,
  onChanged,
}: {
  dispute: AdminDispute | null;
  onClose: () => void;
  /** Called after every successful mutation so the page can reload its list. */
  onChanged: () => void | Promise<void>;
}) {
  const orderId = dispute?.order.id ?? null;

  // ── Refund eligibility (which operator resolutions the order FSM allows) ──
  const [eligibility, setEligibility] = useState<RefundEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const eligibilityRequest = useRef(0);

  const fetchEligibility = useCallback(async () => {
    // Bump first so an in-flight response for a previous order is dropped
    // even when the drawer just closed.
    const requestId = ++eligibilityRequest.current;
    if (!orderId) return;
    try {
      const result = await getRefundEligibility(orderId);
      if (eligibilityRequest.current === requestId) setEligibility(result);
    } catch (err) {
      if (eligibilityRequest.current === requestId) {
        setEligibilityError(
          err instanceof ApiError ? err.message : "Could not load the available actions."
        );
      }
    } finally {
      if (eligibilityRequest.current === requestId) setEligibilityLoading(false);
    }
  }, [orderId]);

  // Resets the panel back to its loading state and refetches. Only called
  // from event handlers (Retry, after a mutation), where the synchronous
  // setStates are fine.
  const loadEligibility = useCallback(async () => {
    setEligibility(null);
    setEligibilityError(null);
    setEligibilityLoading(orderId !== null);
    await fetchEligibility();
  }, [orderId, fetchEligibility]);

  // A different order (or the drawer closing) resets the eligibility panel
  // during render (adjust-state-during-render, as DataTable does), so stale
  // actions never paint; the effect below only fetches.
  const [prevOrderId, setPrevOrderId] = useState<string | null>(orderId);
  if (prevOrderId !== orderId) {
    setPrevOrderId(orderId);
    setEligibility(null);
    setEligibilityError(null);
    setEligibilityLoading(orderId !== null);
  }

  useEffect(() => {
    // The fetcher only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await fetchEligibility();
    };
    void run();
  }, [fetchEligibility]);

  // ── Action state ──────────────────────────────────────────────────────────
  const [fullRefundOpen, setFullRefundOpen] = useState(false);
  const [fullReason, setFullReason] = useState("");
  const [fullError, setFullError] = useState<string | null>(null);
  const [fullSaving, setFullSaving] = useState(false);

  const [partialOpen, setPartialOpen] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [partialReason, setPartialReason] = useState("");
  const [partialError, setPartialError] = useState<string | null>(null);
  const [partialSaving, setPartialSaving] = useState(false);

  const [confirming, setConfirming] = useState<"release" | "replacement" | null>(null);
  const [actionBusy, setActionBusy] = useState<"release" | "replacement" | null>(null);

  // A different dispute means a clean slate for every dialog. Resetting
  // during render (adjust-state-during-render, as DataTable does) means a
  // stale dialog never paints.
  const disputeId = dispute?.id ?? null;
  const [prevDisputeId, setPrevDisputeId] = useState<string | null>(disputeId);
  if (prevDisputeId !== disputeId) {
    setPrevDisputeId(disputeId);
    setFullRefundOpen(false);
    setFullReason("");
    setFullError(null);
    setPartialOpen(false);
    setPartialAmount("");
    setPartialReason("");
    setPartialError(null);
    setConfirming(null);
  }

  const afterMutation = useCallback(async () => {
    await Promise.all([loadEligibility(), Promise.resolve(onChanged())]);
  }, [loadEligibility, onChanged]);

  // ── Eligibility gating: substring match, unknown names stay visible below ──
  const resolutions = eligibility?.availableResolutions ?? [];
  // Two independent gates: what the ORDER allows, and what this operator may do. Both must hold —
  // orders.act is enforced on the request too, so this only avoids offering a button that 403s.
  const mayAct = useAuthStore((s) => s.can("orders.act"));
  const canRefund = mayAct && resolutions.some((r) => r.toLowerCase().includes("refund"));
  const canRelease = mayAct && resolutions.some((r) => r.toLowerCase().includes("release"));
  const canReplace = mayAct && resolutions.some((r) => r.toLowerCase().includes("replacement"));
  const hasRecognizedAction = canRefund || canRelease || canReplace;

  async function submitFullRefund() {
    if (!dispute || fullSaving) return;
    setFullError(null);
    setFullSaving(true);
    try {
      const reason = fullReason.trim();
      await refundOrder(
        dispute.order.id,
        { mode: "full", ...(reason ? { reason } : {}) },
        crypto.randomUUID()
      );
      toast({
        title: "Full refund issued",
        description: `${formatCurrency(dispute.order.payinTotalAmount / 100)} refunded on order ${dispute.order.orderNumber}.`,
        tone: "success",
      });
      setFullRefundOpen(false);
      await afterMutation();
    } catch (err) {
      setFullError(err instanceof ApiError ? err.message : "Could not issue the refund.");
    } finally {
      setFullSaving(false);
    }
  }

  async function submitPartialRefund() {
    if (!dispute || partialSaving) return;
    setPartialError(null);

    const dollars = Number(partialAmount);
    if (partialAmount.trim() === "" || !Number.isFinite(dollars)) {
      setPartialError("Enter the refund amount in dollars.");
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents <= 0) {
      setPartialError("The refund amount must be greater than zero.");
      return;
    }
    if (cents > dispute.order.payinTotalAmount) {
      setPartialError(
        `The refund cannot exceed the order total of ${formatCurrency(dispute.order.payinTotalAmount / 100)}.`
      );
      return;
    }

    setPartialSaving(true);
    try {
      const reason = partialReason.trim();
      await refundOrder(
        dispute.order.id,
        { mode: "partial", amount: cents, ...(reason ? { reason } : {}) },
        crypto.randomUUID()
      );
      toast({
        title: "Partial refund issued",
        description: `${formatCurrency(cents / 100)} refunded on order ${dispute.order.orderNumber}.`,
        tone: "success",
      });
      setPartialOpen(false);
      await afterMutation();
    } catch (err) {
      setPartialError(err instanceof ApiError ? err.message : "Could not issue the refund.");
    } finally {
      setPartialSaving(false);
    }
  }

  async function runConfirmedAction() {
    const action = confirming;
    if (!dispute || !action) return;
    setConfirming(null);
    setActionBusy(action);
    try {
      if (action === "release") {
        await releaseOrder(dispute.order.id);
        toast({
          title: "Escrow released",
          description: `The payout for order ${dispute.order.orderNumber} goes to the seller.`,
          tone: "success",
        });
      } else {
        await approveReplacement(dispute.order.id);
        toast({
          title: "Replacement approved",
          description: `The seller will ship a replacement for order ${dispute.order.orderNumber}.`,
          tone: "success",
        });
      }
      await afterMutation();
    } catch (err) {
      toast({
        title: action === "release" ? "Could not release escrow" : "Could not approve replacement",
        description: err instanceof ApiError ? err.message : `Order ${dispute.order.orderNumber}`,
        tone: "error",
      });
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <>
      <Drawer
        open={dispute != null}
        onClose={onClose}
        title={dispute ? `Dispute · ${dispute.order.orderNumber}` : "Dispute"}
        description={dispute ? `Opened ${timeAgo(dispute.createdAt)} by the buyer` : undefined}
        width="lg"
      >
        {dispute && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={disputeStatusMeta[dispute.status].tone} dot>
                {disputeStatusMeta[dispute.status].label}
              </Badge>
              {dispute.resolution && (
                <Badge tone="neutral">{humanizeToken(dispute.resolution)}</Badge>
              )}
              <span className="ml-auto text-xs text-ink-muted">
                Opened {timeAgo(dispute.createdAt)}
              </span>
            </div>

            <div className="rounded-xl border border-warning-100 bg-warning-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-600" />
                <p className="text-sm font-semibold text-warning-700">{dispute.reason}</p>
              </div>
              {dispute.description && (
                <p className="mt-1.5 text-sm text-ink-secondary">{dispute.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {dispute.offerAmount != null && (
                <SummaryTile
                  label="Offer"
                  value={`${formatCurrency(dispute.offerAmount / 100)}${
                    dispute.offerCurrency ? ` ${dispute.offerCurrency}` : ""
                  }`}
                />
              )}
              {dispute.escalatedAt && (
                <SummaryTile label="Escalated" value={formatDate(dispute.escalatedAt)} />
              )}
              {dispute.resolvedAt && (
                <SummaryTile label="Resolved" value={formatDate(dispute.resolvedAt)} />
              )}
              {dispute.resolution && (
                <SummaryTile label="Resolution" value={humanizeToken(dispute.resolution)} />
              )}
            </div>

            <div className="rounded-xl border border-hairline bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink">{dispute.order.orderNumber}</p>
                <Badge tone="neutral">{humanizeToken(dispute.order.statusBucket)}</Badge>
                <span className="ml-auto text-sm font-semibold tabular-nums text-ink">
                  {formatCurrency(dispute.order.payinTotalAmount / 100)}
                </span>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-ink-muted">Buyer</dt>
                  <dd className="truncate text-ink-secondary">{dispute.order.customer.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-ink-muted">Seller</dt>
                  <dd className="truncate text-ink-secondary">{dispute.order.provider.email}</dd>
                </div>
              </dl>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-ink">Operator actions</p>
              {eligibilityLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : eligibilityError ? (
                <div className="space-y-2">
                  <p className={inlineErrorClasses}>{eligibilityError}</p>
                  <Button variant="outline" size="sm" onClick={() => void loadEligibility()}>
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {hasRecognizedAction ? (
                    <div className="flex flex-wrap gap-2">
                      {canRefund && (
                        <>
                          <Button
                            icon={Undo2}
                            disabled={actionBusy != null}
                            onClick={() => {
                              setFullError(null);
                              setFullReason("");
                              setFullRefundOpen(true);
                            }}
                          >
                            Full refund
                          </Button>
                          <Button
                            variant="outline"
                            icon={Wallet}
                            disabled={actionBusy != null}
                            onClick={() => {
                              setPartialError(null);
                              setPartialAmount("");
                              setPartialReason("");
                              setPartialOpen(true);
                            }}
                          >
                            Partial refund
                          </Button>
                        </>
                      )}
                      {canRelease && (
                        <Button
                          variant="secondary"
                          icon={ShieldCheck}
                          disabled={actionBusy != null}
                          loading={actionBusy === "release"}
                          onClick={() => setConfirming("release")}
                        >
                          Release escrow
                        </Button>
                      )}
                      {canReplace && (
                        <Button
                          variant="outline"
                          icon={Package}
                          disabled={actionBusy != null}
                          loading={actionBusy === "replacement"}
                          onClick={() => setConfirming("replacement")}
                        >
                          Approve replacement
                        </Button>
                      )}
                    </div>
                  ) : !mayAct ? (
                    <p className="text-sm text-ink-muted">
                      Your operator role can review this dispute but not refund, release escrow, or
                      approve a replacement.
                    </p>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      No operator action is available in this order state.
                    </p>
                  )}
                  {eligibility && (
                    <p className="text-xs text-ink-muted">
                      Backend-reported resolutions:{" "}
                      {resolutions.length > 0 ? resolutions.join(", ") : "none"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={fullRefundOpen && dispute != null}
        onClose={() => setFullRefundOpen(false)}
        title="Issue a full refund"
        description={
          dispute
            ? `Refunds ${formatCurrency(dispute.order.payinTotalAmount / 100)} to ${dispute.order.customer.email} on order ${dispute.order.orderNumber}. This cannot be undone.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setFullRefundOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={fullSaving} onClick={() => void submitFullRefund()}>
              Refund in full
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {fullError && (
            <p role="alert" className={inlineErrorClasses}>
              {fullError}
            </p>
          )}
          <Textarea
            label="Reason (optional)"
            hint="Kept on the order's audit trail."
            rows={3}
            placeholder="Item arrived damaged; buyer provided photos."
            value={fullReason}
            onChange={(e) => setFullReason(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={partialOpen && dispute != null}
        onClose={() => setPartialOpen(false)}
        title="Issue a partial refund"
        description={
          dispute
            ? `Refunds part of the ${formatCurrency(dispute.order.payinTotalAmount / 100)} total to ${dispute.order.customer.email}.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPartialOpen(false)}>
              Cancel
            </Button>
            <Button loading={partialSaving} onClick={() => void submitPartialRefund()}>
              Refund amount
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {partialError && (
            <p role="alert" className={inlineErrorClasses}>
              {partialError}
            </p>
          )}
          <Input
            label="Amount (USD)"
            type="number"
            min={0.01}
            step={0.01}
            placeholder="25.00"
            hint={
              dispute
                ? `Up to ${formatCurrency(dispute.order.payinTotalAmount / 100)}.`
                : undefined
            }
            value={partialAmount}
            onChange={(e) => setPartialAmount(e.target.value)}
          />
          <Textarea
            label="Reason (optional)"
            rows={3}
            placeholder="Refunding the shipping cost after the delayed delivery."
            value={partialReason}
            onChange={(e) => setPartialReason(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirming === "release" && dispute != null}
        onClose={() => setConfirming(null)}
        onConfirm={() => void runConfirmedAction()}
        title="Release escrow to the seller"
        message={
          dispute
            ? `The held funds for order ${dispute.order.orderNumber} (${formatCurrency(dispute.order.payinTotalAmount / 100)}) are paid out to ${dispute.order.provider.email}, with no refund to the buyer. This cannot be undone.`
            : ""
        }
        confirmLabel="Release escrow"
        tone="brand"
      />

      <ConfirmDialog
        open={confirming === "replacement" && dispute != null}
        onClose={() => setConfirming(null)}
        onConfirm={() => void runConfirmedAction()}
        title="Approve a replacement"
        message={
          dispute
            ? `${dispute.order.provider.email} will be asked to ship a replacement for order ${dispute.order.orderNumber}. The payout stays held until the replacement is delivered.`
            : ""
        }
        confirmLabel="Approve replacement"
        tone="brand"
      />
    </>
  );
}
