"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Package, ShieldCheck, Undo2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type { RefundEligibility } from "@/types/admin";

const inlineErrorClasses =
  "rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger";

/**
 * The money levers on one order: full/partial refund, escrow release, and replacement
 * approval, gated by the order FSM's refund-eligibility and the operator's `orders.act`
 * capability. Shared by the Orders drawer and the Disputes drawer — same behavior in both.
 */
export function OperatorActions({
  orderId,
  orderNumber,
  payinTotalAmount,
  currency,
  onChanged,
}: {
  orderId: string;
  orderNumber: string;
  /** Integer cents (the backend's money unit). */
  payinTotalAmount: number;
  currency: string;
  /** Called after every successful mutation so the host view can reload. */
  onChanged: () => void | Promise<void>;
}) {
  // ── Refund eligibility (which operator resolutions the order FSM allows) ──
  const [eligibility, setEligibility] = useState<RefundEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const eligibilityRequest = useRef(0);

  const fetchEligibility = useCallback(async () => {
    // Bump first so an in-flight response for a previous order is dropped
    // even when the host drawer just closed.
    const requestId = ++eligibilityRequest.current;
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
    setEligibilityLoading(true);
    await fetchEligibility();
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

  // A different order means a clean slate: the eligibility panel and every
  // dialog reset. Resetting during render (adjust-state-during-render, as
  // DataTable does) means stale actions and dialogs never paint; the effect
  // below only fetches.
  const [prevOrderId, setPrevOrderId] = useState(orderId);
  if (prevOrderId !== orderId) {
    setPrevOrderId(orderId);
    setEligibility(null);
    setEligibilityError(null);
    setEligibilityLoading(true);
    setFullRefundOpen(false);
    setFullReason("");
    setFullError(null);
    setPartialOpen(false);
    setPartialAmount("");
    setPartialReason("");
    setPartialError(null);
    setConfirming(null);
  }

  useEffect(() => {
    // The fetcher only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await fetchEligibility();
    };
    void run();
  }, [fetchEligibility]);

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
    if (fullSaving) return;
    setFullError(null);
    setFullSaving(true);
    try {
      const reason = fullReason.trim();
      await refundOrder(orderId, { mode: "full", ...(reason ? { reason } : {}) }, crypto.randomUUID());
      toast({
        title: "Full refund issued",
        description: `${formatCurrency(payinTotalAmount / 100)} refunded on order ${orderNumber}.`,
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
    if (partialSaving) return;
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
    if (cents > payinTotalAmount) {
      setPartialError(
        `The refund cannot exceed the order total of ${formatCurrency(payinTotalAmount / 100)}.`
      );
      return;
    }

    setPartialSaving(true);
    try {
      const reason = partialReason.trim();
      await refundOrder(
        orderId,
        { mode: "partial", amount: cents, ...(reason ? { reason } : {}) },
        crypto.randomUUID()
      );
      toast({
        title: "Partial refund issued",
        description: `${formatCurrency(cents / 100)} refunded on order ${orderNumber}.`,
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
    if (!action) return;
    setConfirming(null);
    setActionBusy(action);
    try {
      if (action === "release") {
        await releaseOrder(orderId);
        toast({
          title: "Escrow released",
          description: `The payout for order ${orderNumber} goes to the seller.`,
          tone: "success",
        });
      } else {
        await approveReplacement(orderId);
        toast({
          title: "Replacement approved",
          description: `The seller will ship a replacement for order ${orderNumber}.`,
          tone: "success",
        });
      }
      await afterMutation();
    } catch (err) {
      toast({
        title: action === "release" ? "Could not release escrow" : "Could not approve replacement",
        description: err instanceof ApiError ? err.message : `Order ${orderNumber}`,
        tone: "error",
      });
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <>
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
                Your operator role can review this order but not refund, release escrow, or approve
                a replacement.
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

      <Modal
        open={fullRefundOpen}
        onClose={() => setFullRefundOpen(false)}
        title="Issue a full refund"
        description={`Refunds ${formatCurrency(payinTotalAmount / 100)} to the buyer on order ${orderNumber}. This cannot be undone.`}
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
        open={partialOpen}
        onClose={() => setPartialOpen(false)}
        title="Issue a partial refund"
        description={`Refunds part of the ${formatCurrency(payinTotalAmount / 100)} total to the buyer on order ${orderNumber}.`}
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
            label={`Amount (${currency.toUpperCase()})`}
            type="number"
            min={0.01}
            step={0.01}
            placeholder="25.00"
            hint={`Up to ${formatCurrency(payinTotalAmount / 100)}.`}
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
        open={confirming === "release"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void runConfirmedAction()}
        title="Release escrow to the seller"
        message={`The held funds for order ${orderNumber} (${formatCurrency(payinTotalAmount / 100)}) are paid out to the seller, with no refund to the buyer. This cannot be undone.`}
        confirmLabel="Release escrow"
        tone="brand"
      />

      <ConfirmDialog
        open={confirming === "replacement"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void runConfirmedAction()}
        title="Approve a replacement"
        message={`The seller will be asked to ship a replacement for order ${orderNumber}. The payout stays held until the replacement is delivered.`}
        confirmLabel="Approve replacement"
        tone="brand"
      />
    </>
  );
}
