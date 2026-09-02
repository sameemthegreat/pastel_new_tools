"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Scale, ShieldOff } from "lucide-react";
import { Badge, StatusBadge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { getOrder, unblockPayout } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatDateTime, humanizeToken, timeAgoLive } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type { AdminOrder, AdminOrderDetail } from "@/types/admin";
import { OperatorActions } from "./OperatorActions";

const REFUND_STATUS_META: Record<
  AdminOrderDetail["refundStatus"],
  { label: string; tone: BadgeTone } | null
> = {
  none: null,
  requested: { label: "Refund requested", tone: "warning" },
  partial: { label: "Partially refunded", tone: "gold" },
  full: { label: "Fully refunded", tone: "gold" },
};

function payoutBadge(detail: AdminOrderDetail): { label: string; tone: BadgeTone } {
  if (detail.payoutBlockedAt) return { label: "Payout blocked", tone: "error" };
  if (detail.payoutReleased) return { label: "Payout released", tone: "success" };
  return { label: "Payout held", tone: "neutral" };
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{value}</dd>
    </div>
  );
}

export function OrderDrawer({
  order,
  onClose,
  onChanged,
}: {
  order: AdminOrder | null;
  onClose: () => void;
  /** Called after every successful mutation so the page can reload its list. */
  onChanged: () => void | Promise<void>;
}) {
  const orderId = order?.id ?? null;

  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped to refetch the detail (retry button, after a successful action).
  const [fetchKey, setFetchKey] = useState(0);
  // Bumped on every fetch so a stale response for a previous order is dropped
  // even when the drawer just closed (same request-id idiom as DisputeDrawer).
  const detailRequest = useRef(0);

  const [unblockOpen, setUnblockOpen] = useState(false);
  const [unblocking, setUnblocking] = useState(false);

  // Opening a different order (or closing the drawer) clears the previous
  // detail and the unblock dialog. Resetting during render
  // (adjust-state-during-render, as DataTable does) means stale content never
  // paints; the effect below only fetches.
  const [prevOrderId, setPrevOrderId] = useState<string | null>(orderId);
  if (prevOrderId !== orderId) {
    setPrevOrderId(orderId);
    setDetail(null);
    setLoadError(null);
    setUnblockOpen(false);
  }

  useEffect(() => {
    // Bump first so an in-flight response for a previous order is dropped.
    const requestId = ++detailRequest.current;
    if (!orderId) return;
    // The fetch only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      try {
        const fetched = await getOrder(orderId);
        if (detailRequest.current === requestId) setDetail(fetched);
      } catch (err) {
        if (detailRequest.current === requestId) {
          setLoadError(
            err instanceof ApiError ? err.message : "Could not load this order's details."
          );
        }
      }
    };
    void run();
  }, [orderId, fetchKey]);

  // Starts a refetch of the open order without dropping the current detail;
  // called from event handlers, where the synchronous error-clear is fine.
  function refetchDetail() {
    setLoadError(null);
    setFetchKey((k) => k + 1);
  }

  // UI courtesy only — POST /admin/orders/:id/unblock-payout enforces orders.act itself.
  const canAct = useAuthStore((s) => s.can("orders.act"));

  async function handleUnblock() {
    if (!detail || unblocking) return;
    setUnblockOpen(false);
    setUnblocking(true);
    try {
      await unblockPayout(detail.id);
      toast({
        title: "Payout unblocked",
        description: `The parked payout timers on order ${detail.orderNumber} are re-armed.`,
        tone: "success",
      });
      refetchDetail();
      await onChanged();
    } catch (err) {
      toast({
        title: "Could not unblock the payout",
        description: err instanceof ApiError ? err.message : `Order ${detail.orderNumber}`,
        tone: "error",
      });
    } finally {
      setUnblocking(false);
    }
  }

  const loading = orderId !== null && detail === null && loadError === null;
  const refundBadge = detail ? REFUND_STATUS_META[detail.refundStatus] : null;

  return (
    <Drawer
      open={order != null}
      onClose={onClose}
      title={order ? `Order · ${order.orderNumber}` : "Order"}
      description={order ? `Placed ${timeAgoLive(order.createdAt)}` : undefined}
      width="lg"
    >
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-danger/25 bg-danger/5 p-4">
          <p className="text-sm font-medium text-danger">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refetchDetail}>
            Try again
          </Button>
        </div>
      )}

      {detail && (
        <div className="space-y-6">
          {/* Lifecycle at a glance */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={humanizeToken(detail.statusBucket)} />
            {refundBadge && (
              <Badge tone={refundBadge.tone} dot>
                {refundBadge.label}
              </Badge>
            )}
            <Badge tone={payoutBadge(detail).tone} dot>
              {payoutBadge(detail).label}
            </Badge>
            <span className="ml-auto text-xs text-ink-muted">
              Placed {timeAgoLive(detail.createdAt)}
            </span>
          </div>

          {/* Chargeback payout freeze */}
          {detail.payoutBlockedAt && (
            <div className="rounded-xl border border-danger/25 bg-danger/10 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
                <p className="text-sm font-semibold text-danger">
                  Payout blocked {timeAgoLive(detail.payoutBlockedAt)}
                </p>
              </div>
              <p className="mt-1.5 text-sm text-ink-secondary">
                {detail.payoutBlockReason ?? "No reason was recorded for this block."}
              </p>
              {canAct && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={ShieldOff}
                  className="mt-3"
                  loading={unblocking}
                  onClick={() => setUnblockOpen(true)}
                >
                  Unblock payout
                </Button>
              )}
            </div>
          )}

          {/* Order facts */}
          <div className="rounded-2xl border border-hairline bg-tile/50 p-4">
            <dl className="space-y-3 text-sm">
              <Fact label="Order number" value={<span className="font-semibold">{detail.orderNumber}</span>} />
              <Fact label="State" value={humanizeToken(detail.state)} />
              <Fact
                label="Total paid (pay-in)"
                value={<span className="font-semibold tabular-nums">{formatCurrency(detail.payinTotalAmount / 100)}</span>}
              />
              <Fact
                label="Seller payout"
                value={<span className="tabular-nums">{formatCurrency(detail.payoutTotalAmount / 100)}</span>}
              />
              <Fact label="Buyer" value={<span className="block truncate" title={detail.customer.email}>{detail.customer.email}</span>} />
              <Fact label="Seller" value={<span className="block truncate" title={detail.provider.email}>{detail.provider.email}</span>} />
              <Fact label="Listing" value={detail.listingTitle ?? "—"} />
              {detail.buyerNote && <Fact label="Buyer note" value={detail.buyerNote} />}
              <Fact label="Created" value={formatDateTime(detail.createdAt)} />
              {detail.payoutReleasedAt && (
                <Fact label="Payout released" value={formatDateTime(detail.payoutReleasedAt)} />
              )}
            </dl>
          </div>

          {/* Dispute pointer */}
          {detail.dispute && (
            <div className="flex items-center gap-2 rounded-xl border border-warning-100 bg-warning-50 px-3.5 py-2.5">
              <Scale className="h-4 w-4 shrink-0 text-warning-600" aria-hidden />
              <p className="text-sm font-medium text-warning-700">
                Dispute {humanizeToken(detail.dispute.status).toLowerCase()} — resolve from the
                Disputes queue.
              </p>
            </div>
          )}

          {/* Timeline */}
          <section>
            <p className="mb-3 text-sm font-semibold text-ink">Timeline</p>
            {detail.transitions.length === 0 ? (
              <p className="rounded-xl border border-hairline bg-tile/50 p-4 text-sm text-ink-muted">
                No transitions have been recorded on this order yet.
              </p>
            ) : (
              <ol className="space-y-2">
                {detail.transitions.map((t, index) => (
                  <li
                    key={`${t.name}-${t.at}-${index}`}
                    className="flex items-baseline justify-between gap-3 rounded-xl border border-hairline px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {humanizeToken(t.name)}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">by {t.actor}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                      {formatDateTime(t.at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Refunds */}
          <section>
            <p className="mb-3 text-sm font-semibold text-ink">Refunds</p>
            {detail.refunds.length === 0 ? (
              <p className="rounded-xl border border-hairline bg-tile/50 p-4 text-sm text-ink-muted">
                No refunds have been issued on this order.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-hairline">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline bg-tile/50 text-left text-xs font-medium uppercase tracking-wider text-ink-muted">
                      <th className="px-3 py-2 font-medium">Mode</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Actor</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Stripe ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.refunds.map((refund) => (
                      <tr key={refund.id} className="border-b border-hairline last:border-b-0">
                        <td className="px-3 py-2">
                          <Badge tone={refund.mode === "full" ? "gold" : "neutral"}>
                            {humanizeToken(refund.mode)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">
                          {formatCurrency(refund.amount / 100)}
                        </td>
                        <td className="px-3 py-2 text-ink-secondary">{refund.actor ?? "—"}</td>
                        <td className="max-w-40 truncate px-3 py-2 text-ink-secondary" title={refund.reason ?? undefined}>
                          {refund.reason ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-ink-secondary">
                          {timeAgoLive(refund.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          {refund.stripeRefundId ? (
                            <span
                              className="block max-w-24 truncate font-mono text-xs text-ink-muted"
                              title={refund.stripeRefundId}
                            >
                              {refund.stripeRefundId}
                            </span>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Money levers — shared with the dispute drawer */}
          <OperatorActions
            orderId={detail.id}
            orderNumber={detail.orderNumber}
            payinTotalAmount={detail.payinTotalAmount}
            currency={detail.currency}
            onChanged={async () => {
              refetchDetail();
              await onChanged();
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={unblockOpen}
        onClose={() => setUnblockOpen(false)}
        onConfirm={() => void handleUnblock()}
        title="Unblock this payout?"
        message={`The chargeback freeze on order ${detail?.orderNumber ?? ""} is cleared and the parked payout timers re-arm. The call is idempotent — running it twice is safe.`}
        confirmLabel="Unblock payout"
        tone="brand"
      />
    </Drawer>
  );
}
