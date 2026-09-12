"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { getDispute } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatDate, formatDateTime, humanizeToken, timeAgo } from "@/lib/format";
import { OperatorActions } from "../orders/OperatorActions";
import type { AdminDispute, AdminDisputeDetail, DisputeStatus } from "@/types/admin";

/** Badge tone + label per dispute status — shared with the list page. */
export const disputeStatusMeta: Record<DisputeStatus, { label: string; tone: BadgeTone }> = {
  open: { label: "Open", tone: "warning" },
  underReview: { label: "Under review", tone: "brand" },
  offerMade: { label: "Offer made", tone: "gold" },
  escalated: { label: "Escalated", tone: "error" },
  resolved: { label: "Resolved", tone: "success" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

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

function NoteCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-tile/60 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap text-ink-secondary">{body}</p>
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
  const disputeId = dispute?.id ?? null;

  // ── Rich detail (offer note, internal note, evidence) ─────────────────────
  const [detail, setDetail] = useState<AdminDisputeDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  // Bumped to refetch the detail (retry button, after a successful action).
  const [fetchKey, setFetchKey] = useState(0);
  // Bumped on every fetch so a stale response for a previous dispute is dropped
  // even when the drawer just closed.
  const detailRequest = useRef(0);

  // A different dispute (or the drawer closing) clears the previous detail.
  // Resetting during render (adjust-state-during-render, as DataTable does)
  // means stale content never paints; the effect below only fetches.
  const [prevDisputeId, setPrevDisputeId] = useState<string | null>(disputeId);
  if (prevDisputeId !== disputeId) {
    setPrevDisputeId(disputeId);
    setDetail(null);
    setDetailError(null);
  }

  useEffect(() => {
    // Bump first so an in-flight response for a previous dispute is dropped.
    const requestId = ++detailRequest.current;
    if (!disputeId) return;
    // The fetch only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      try {
        const fetched = await getDispute(disputeId);
        if (detailRequest.current === requestId) setDetail(fetched);
      } catch (err) {
        if (detailRequest.current === requestId) {
          setDetailError(
            err instanceof ApiError ? err.message : "Could not load this dispute's details."
          );
        }
      }
    };
    void run();
  }, [disputeId, fetchKey]);

  // Starts a refetch of the open dispute without dropping the current detail;
  // called from event handlers, where the synchronous error-clear is fine.
  function refetchDetail() {
    setDetailError(null);
    setFetchKey((k) => k + 1);
  }

  const detailLoading = disputeId !== null && detail === null && detailError === null;

  /** "Buyer" or "Seller" by matching the uploader against the order's parties. */
  function uploaderLabel(uploadedByUserId: string): string {
    if (!dispute) return "Uploader";
    if (uploadedByUserId === dispute.order.customer.id) return "Buyer";
    if (uploadedByUserId === dispute.order.provider.id) return "Seller";
    return "Uploader";
  }

  const visibleEvidence = detail?.evidence.filter((e) => e.url != null) ?? [];

  return (
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
            {dispute.resolution && <Badge tone="neutral">{humanizeToken(dispute.resolution)}</Badge>}
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
            {detail?.offerExpiresAt && (
              <SummaryTile label="Offer expires" value={formatDateTime(detail.offerExpiresAt)} />
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

          {/* Richer detail arrives after the row: notes + evidence */}
          {detailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-20 w-2/3" />
            </div>
          ) : detailError ? (
            <div className="space-y-2">
              <p className={inlineErrorClasses}>{detailError}</p>
              <Button variant="outline" size="sm" onClick={refetchDetail}>
                Retry
              </Button>
            </div>
          ) : detail ? (
            <>
              {(detail.offerNote || detail.adminNote) && (
                <div className="space-y-3">
                  {detail.offerNote && <NoteCard label="Offer note" body={detail.offerNote} />}
                  {detail.adminNote && <NoteCard label="Internal note" body={detail.adminNote} />}
                </div>
              )}

              <section>
                <p className="mb-3 text-sm font-semibold text-ink">Evidence</p>
                {visibleEvidence.length === 0 ? (
                  <p className="rounded-xl border border-hairline bg-tile/50 p-4 text-sm text-ink-muted">
                    {detail.evidence.length === 0
                      ? "No evidence has been uploaded on this dispute."
                      : "Evidence was uploaded but its images are unavailable right now."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {visibleEvidence.map((item) => (
                      <figure key={item.assetId} className="w-[76px]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URLs; routing them through the image optimizer would break once they expire */}
                        <img
                          src={item.url!}
                          alt={`Evidence uploaded by the ${uploaderLabel(item.uploadedByUserId).toLowerCase()}`}
                          title={item.note ?? undefined}
                          className="h-[76px] w-[76px] rounded-xl border border-hairline object-cover"
                        />
                        <figcaption className="mt-1 text-center text-[11px] font-medium text-ink-muted">
                          {uploaderLabel(item.uploadedByUserId)}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}

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

          {/* Money levers — shared with the orders drawer */}
          <OperatorActions
            orderId={dispute.order.id}
            orderNumber={dispute.order.orderNumber}
            payinTotalAmount={dispute.order.payinTotalAmount}
            currency={dispute.order.currency}
            onChanged={async () => {
              refetchDetail();
              await onChanged();
            }}
          />
        </div>
      )}
    </Drawer>
  );
}
