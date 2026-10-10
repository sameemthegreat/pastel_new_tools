"use client";

import { useState } from "react";
import { ExternalLink, ImageOff, ShieldAlert } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Textarea } from "@/components/ui/Textarea";
import { resolveReport } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, humanizeToken, timeAgo } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type { AdminContentReport, ReportDecision, ReportReason } from "@/types/admin";
import type { PublicListing } from "@/types/catalog";

/** The wording reporters picked from in the app's Report sheet, so the queue reads the same. */
const REASON_LABELS: Record<ReportReason, string> = {
  counterfeit: "Counterfeit or replica",
  copyright: "Copyright infringement (DMCA)",
  misleading: "Misleading or inaccurate listing",
  prohibited: "Prohibited item",
  offensive: "Offensive content",
  inappropriate: "Inappropriate content",
  spam: "Spam",
  other: "Something else",
};

/** Reason label — shared with the list page. Unknown codes fall back to their humanized form. */
export function reportReasonLabel(reason: string): string {
  return REASON_LABELS[reason as ReportReason] ?? humanizeToken(reason);
}

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  open: { label: "Open", tone: "warning" },
  actioned: { label: "Actioned", tone: "success" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

/** Badge tone + label per report status — shared with the list page. */
export function reportStatusMeta(status: string): { label: string; tone: BadgeTone } {
  return STATUS_META[status] ?? { label: humanizeToken(status), tone: "neutral" };
}

/** `sourceUrl` is reporter-typed text: only ever link it when it is a plain web address. */
function safeWebUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const sectionTitle = "mb-2 text-sm font-semibold text-ink";
const mutedBox = "rounded-xl border border-hairline bg-tile/50 p-4 text-sm text-ink-muted";

/**
 * The reported listing: `null` once it is known to be gone, `undefined` while unknown (lookup in
 * flight or failed) — then the id alone still tells the operator what was reported.
 */
function ListingCard({
  report,
  listing,
}: {
  report: AdminContentReport;
  listing: PublicListing | null | undefined;
}) {
  const cover = listing?.images.find((image) => image.url)?.url ?? null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN image of an arbitrary listing; no optimizer config for its host
        <img
          src={cover}
          alt=""
          className="h-14 w-14 shrink-0 rounded-lg border border-hairline object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-hairline bg-tile">
          <ImageOff className="h-5 w-5 text-ink-muted" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {listing ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink">{listing.title}</p>
            <Badge tone="neutral">{humanizeToken(listing.state)}</Badge>
          </div>
        ) : (
          <p className="text-sm font-semibold text-ink-muted">
            {listing === null
              ? "Listing removed or no longer public"
              : humanizeToken(report.contentType)}
          </p>
        )}
        <p className="mt-1 truncate font-mono text-xs text-ink-muted" title={report.contentId}>
          {report.contentId}
        </p>
      </div>
    </div>
  );
}

/**
 * The reporter's evidence. A screenshot's `evidenceUrl` is presigned for 10 minutes, so a drawer
 * left open goes stale: a failed image load offers a refresh, which re-reads the list and with it
 * mints fresh links.
 */
function Evidence({
  report,
  onRefresh,
}: {
  report: AdminContentReport;
  onRefresh: () => void | Promise<void>;
}) {
  // Keyed by URL, so a refreshed (new) link is retried automatically.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);

  if (report.evidenceType === "screenshot") {
    const url = report.evidenceUrl;
    if (!url || brokenUrl === url) {
      return (
        <div className={`${mutedBox} flex flex-wrap items-center justify-between gap-3`}>
          <span>
            {url
              ? "This screenshot's preview link has expired."
              : "The screenshot can't be shown right now."}
          </span>
          <Button variant="outline" size="sm" onClick={() => void onRefresh()}>
            Refresh
          </Button>
        </div>
      );
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="group block w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URL; the image optimizer would cache it past expiry */}
        <img
          src={url}
          alt="Screenshot attached by the reporter"
          onError={() => setBrokenUrl(url)}
          className="max-h-80 max-w-full rounded-xl border border-hairline object-contain"
        />
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-ink-muted group-hover:text-ink">
          Open full size <ExternalLink size={12} aria-hidden />
        </span>
      </a>
    );
  }

  if (report.evidenceType === "link" || report.sourceUrl) {
    const href = safeWebUrl(report.sourceUrl);
    return (
      <div className="rounded-xl border border-hairline bg-surface p-3.5 text-sm">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex max-w-full items-start gap-1.5 font-medium break-all text-brand-700 hover:underline"
          >
            {report.sourceUrl}
            <ExternalLink size={14} className="mt-0.5 shrink-0" aria-hidden />
          </a>
        ) : (
          <span className="break-all text-ink-secondary">{report.sourceUrl}</span>
        )}
      </div>
    );
  }

  return <p className={mutedBox}>The reporter didn&apos;t attach any evidence.</p>;
}

export function ReportDrawer({
  report,
  listing,
  onClose,
  onChanged,
}: {
  report: AdminContentReport | null;
  /** The reported listing as looked up by the page (see `ListingCard`). */
  listing: PublicListing | null | undefined;
  onClose: () => void;
  /** Reloads the page's list — after a decision, and to mint fresh evidence links. */
  onChanged: () => void | Promise<void>;
}) {
  const canAct = useAuthStore((s) => s.can("moderation.act"));
  const reportId = report?.id ?? null;

  const [note, setNote] = useState("");
  const [pending, setPending] = useState<ReportDecision | null>(null);

  // A different report (or the drawer closing) clears the draft note — reset during render, as the
  // dispute drawer does, so a previous report's note never paints.
  const [prevReportId, setPrevReportId] = useState<string | null>(reportId);
  if (prevReportId !== reportId) {
    setPrevReportId(reportId);
    setNote("");
  }

  async function decide(status: ReportDecision) {
    if (!report) return;
    setPending(status);
    try {
      await resolveReport(report.id, { status, note: note.trim() || undefined });
      toast({
        title: status === "actioned" ? "Report marked as actioned" : "Report dismissed",
        tone: "success",
      });
      // A decided report leaves the Open queue, so move on rather than show a stale "open" copy.
      onClose();
      await onChanged();
    } catch (err) {
      toast({
        title: "Could not resolve this report",
        description: err instanceof ApiError ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setPending(null);
    }
  }

  const status = report ? reportStatusMeta(report.status) : null;

  return (
    <Drawer
      open={report != null}
      onClose={onClose}
      title="Report"
      description={report ? `Filed ${timeAgo(report.createdAt)}` : undefined}
      width="lg"
    >
      {report && status && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {report.isDmca && <Badge tone="error">DMCA</Badge>}
            <span className="ml-auto text-xs text-ink-muted">{formatDateTime(report.createdAt)}</span>
          </div>

          <section>
            <p className={sectionTitle}>Reported listing</p>
            <ListingCard report={report} listing={listing} />
          </section>

          <div
            className={
              report.isDmca
                ? "rounded-xl border border-error-100 bg-error-50 p-4"
                : "rounded-xl border border-warning-100 bg-warning-50 p-4"
            }
          >
            <div className="flex items-center gap-2">
              <ShieldAlert
                className={report.isDmca ? "h-4 w-4 text-error-600" : "h-4 w-4 text-warning-600"}
                aria-hidden
              />
              <p
                className={
                  report.isDmca
                    ? "text-sm font-semibold text-error-700"
                    : "text-sm font-semibold text-warning-700"
                }
              >
                {reportReasonLabel(report.reason)}
              </p>
            </div>
            <p className="mt-1.5 text-sm whitespace-pre-wrap text-ink-secondary">
              {report.details ?? "No details given."}
            </p>
            {report.isDmca && (
              <p className="mt-2 text-xs font-medium text-error-700">
                DMCA takedown notice: it carries a legal response clock, so handle it first.
              </p>
            )}
          </div>

          <section>
            <p className={sectionTitle}>Evidence</p>
            <Evidence report={report} onRefresh={onChanged} />
          </section>

          <section>
            <p className={sectionTitle}>Reporter</p>
            <dl className="space-y-1.5 rounded-xl border border-hairline bg-surface p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-muted">Email</dt>
                <dd className="truncate text-ink-secondary">
                  {report.reporterEmail ? (
                    <a href={`mailto:${report.reporterEmail}`} className="hover:underline">
                      {report.reporterEmail}
                    </a>
                  ) : (
                    "Not given"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-muted">Account</dt>
                <dd
                  className="truncate font-mono text-xs text-ink-secondary"
                  title={report.reporterUserId ?? undefined}
                >
                  {report.reporterUserId ?? <span className="font-sans text-sm">Not signed in</span>}
                </dd>
              </div>
            </dl>
          </section>

          {report.status === "open" && canAct && (
            <section className="rounded-xl border border-hairline bg-surface p-4">
              <p className="text-sm font-semibold text-ink">Decision</p>
              <p className="mt-1 text-xs text-ink-muted">
                Recording a decision closes the report. It doesn&apos;t remove the listing or
                restrict the seller; do that separately.
              </p>
              <Textarea
                className="mt-3"
                label="Note (optional)"
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What you checked and why. Kept in the audit log."
              />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  loading={pending === "dismissed"}
                  disabled={pending !== null}
                  onClick={() => void decide("dismissed")}
                >
                  Dismiss
                </Button>
                <Button
                  loading={pending === "actioned"}
                  disabled={pending !== null}
                  onClick={() => void decide("actioned")}
                >
                  Mark as actioned
                </Button>
              </div>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
