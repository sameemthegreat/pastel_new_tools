"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BadgeCheck, ExternalLink, MailPlus, Trash2 } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import {
  addApplicationNote,
  approveApplication,
  getApplication,
  rejectApplication,
  removeApplication,
  resendApplicationVerification,
  updateApplicationCrm,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDate, timeAgo } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type { ApplicationStatus, CrmStatus, SellerApplicationDetail } from "@/types/admin";

/**
 * A seller application carries two independent status axes: the lifecycle
 * (`status` — did they verify their email, were they approved) and the internal
 * CRM pipeline (`crmStatus` — where our conversation with them stands). The
 * badge helpers below are shared with the Requests table so both render the
 * axes identically.
 */

const STATUS_BADGES: Record<ApplicationStatus, { tone: BadgeTone; label: string }> = {
  pending_verification: { tone: "warning", label: "Pending verification" },
  verified: { tone: "brand", label: "Verified" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "error", label: "Rejected" },
  revoked: { tone: "neutral", label: "Revoked" },
  withdrawn: { tone: "neutral", label: "Withdrawn" },
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { tone, label } = STATUS_BADGES[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

const CRM_LABELS: Record<CrmStatus, string> = {
  contacted: "Contacted",
  under_discussion: "Under discussion",
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  on_hold: "On hold",
};

export function crmStatusLabel(status: CrmStatus): string {
  return CRM_LABELS[status];
}

const CRM_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "No pipeline status" },
  ...(Object.entries(CRM_LABELS) as [CrmStatus, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

const inlineErrorClass =
  "rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger";

const inlineInfoClass =
  "rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700";

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function decisionCopy(detail: SellerApplicationDetail): string {
  switch (detail.status) {
    case "pending_verification":
      return "The applicant has not confirmed their email address yet — only verified applications can be approved.";
    case "verified":
      return "Email confirmed. This application is ready for an approve or reject decision.";
    case "approved":
      return `Approved${detail.approvedAt ? ` on ${formatDate(detail.approvedAt)}` : ""}. The decision is on record; no further lifecycle actions apply.`;
    case "rejected":
      return `Rejected${detail.rejectedAt ? ` on ${formatDate(detail.rejectedAt)}` : ""}. The decision is on record; no further lifecycle actions apply.`;
    case "revoked":
      return "This application's verification was revoked, so it is closed for decisions.";
    case "withdrawn":
      return "The applicant withdrew, so this application is closed for decisions.";
  }
}

export function ApplicationDrawer({
  applicationId,
  onClose,
  onChanged,
}: {
  applicationId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  // UI courtesy only — the API enforces applications.annotate / applications.review on each route.
  const canAnnotate = useAuthStore((s) => s.can("applications.annotate"));
  const canReview = useAuthStore((s) => s.can("applications.review"));
  const [detail, setDetail] = useState<SellerApplicationDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // CRM pipeline form.
  const [crmValue, setCrmValue] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);

  // Internal notes.
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Approve modal.
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [approveSaving, setApproveSaving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Reject modal.
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSendEmail, setRejectSendEmail] = useState(true);
  const [rejectSaving, setRejectSaving] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Resend verification + remove.
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Tracks the id currently on display so a slow response for a previously
  // opened application cannot overwrite the one now open.
  const currentIdRef = useRef<string | null>(applicationId);

  const fetchDetail = useCallback(async () => {
    if (!applicationId) return;
    try {
      const next = await getApplication(applicationId);
      if (currentIdRef.current !== applicationId) return;
      setDetail(next);
      setCrmValue(next.crmStatus ?? "");
      setFollowUp(next.followUpAt ? next.followUpAt.slice(0, 10) : "");
      setLoadError(null);
    } catch (err) {
      if (currentIdRef.current !== applicationId) return;
      setLoadError(err instanceof ApiError ? err.message : "Could not load this application.");
    }
  }, [applicationId]);

  // Opening a different application resets everything to a blank slate. The
  // reset happens during render (adjust-state-during-render, as DataTable
  // does) so stale content never paints; the effect below only fetches.
  const [prevId, setPrevId] = useState<string | null>(applicationId);
  if (prevId !== applicationId) {
    setPrevId(applicationId);
    setDetail(null);
    setLoadError(null);
    setCrmValue("");
    setFollowUp("");
    setCrmError(null);
    setNoteBody("");
    setNoteError(null);
    setApproveOpen(false);
    setApproveNote("");
    setApproveError(null);
    setRejectOpen(false);
    setRejectReason("");
    setRejectSendEmail(true);
    setRejectError(null);
    setResendNote(null);
    setRemoveOpen(false);
    setRemoveError(null);
  }

  useEffect(() => {
    currentIdRef.current = applicationId;
    if (!applicationId) return;
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await fetchDetail();
    };
    void run();
  }, [applicationId, fetchDetail]);

  async function handleSaveCrm() {
    if (!detail || crmSaving) return;
    setCrmSaving(true);
    setCrmError(null);
    try {
      await updateApplicationCrm(detail.id, {
        crmStatus: crmValue === "" ? null : crmValue,
        followUpAt: followUp === "" ? null : new Date(followUp).toISOString(),
      });
      toast({ title: "Pipeline updated", description: detail.fullName, tone: "success" });
      await fetchDetail();
      onChanged();
    } catch (err) {
      setCrmError(err instanceof ApiError ? err.message : "Could not save the pipeline changes.");
    } finally {
      setCrmSaving(false);
    }
  }

  async function handleAddNote() {
    if (!detail || noteSaving || !noteBody.trim()) return;
    setNoteSaving(true);
    setNoteError(null);
    try {
      await addApplicationNote(detail.id, noteBody.trim());
      toast({ title: "Note added", description: detail.fullName, tone: "success" });
      setNoteBody("");
      await fetchDetail();
      onChanged();
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : "Could not add the note.");
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleApprove() {
    if (!detail || approveSaving) return;
    setApproveSaving(true);
    setApproveError(null);
    try {
      await approveApplication(detail.id, approveNote.trim() || undefined);
      toast({ title: "Application approved", description: detail.fullName, tone: "success" });
      setApproveOpen(false);
      await fetchDetail();
      onChanged();
    } catch (err) {
      setApproveError(
        err instanceof ApiError ? err.message : "Could not approve the application."
      );
    } finally {
      setApproveSaving(false);
    }
  }

  async function handleReject() {
    if (!detail || rejectSaving) return;
    setRejectSaving(true);
    setRejectError(null);
    try {
      await rejectApplication(detail.id, {
        reason: rejectReason.trim() || undefined,
        sendEmail: rejectSendEmail,
      });
      toast({ title: "Application rejected", description: detail.fullName, tone: "success" });
      setRejectOpen(false);
      await fetchDetail();
      onChanged();
    } catch (err) {
      setRejectError(err instanceof ApiError ? err.message : "Could not reject the application.");
    } finally {
      setRejectSaving(false);
    }
  }

  async function handleResend() {
    if (!detail || resending) return;
    setResending(true);
    setResendNote(null);
    try {
      await resendApplicationVerification(detail.id);
      toast({ title: "Verification email sent", description: detail.email, tone: "success" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // Rate-limited, not broken — surface the backend's wording as a note.
        setResendNote(err.message);
      } else {
        toast({
          title: "Could not resend the email",
          description: err instanceof ApiError ? err.message : detail.email,
          tone: "error",
        });
      }
    } finally {
      setResending(false);
    }
  }

  async function handleRemove() {
    if (!detail) return;
    setRemoveOpen(false);
    setRemoveError(null);
    try {
      await removeApplication(detail.id);
      toast({ title: "Removed from waitlist", description: detail.email, tone: "success" });
      onChanged();
      onClose();
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : "Could not remove the application.");
    }
  }

  const canReject =
    canReview &&
    detail !== null &&
    (detail.status === "pending_verification" || detail.status === "verified");

  return (
    <Drawer
      open={applicationId !== null}
      onClose={onClose}
      title="Seller application"
      description={detail ? detail.email : undefined}
      width="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {loadError ? (
        <div className="space-y-3">
          <p role="alert" className={inlineErrorClass}>
            {loadError}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setDetail(null);
              setLoadError(null);
              void fetchDetail();
            }}
          >
            Try again
          </Button>
        </div>
      ) : detail === null ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight text-ink">{detail.fullName}</h3>
              <ApplicationStatusBadge status={detail.status} />
              {detail.crmStatus && <Badge tone="neutral">{crmStatusLabel(detail.crmStatus)}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-ink-secondary">{detail.email}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Queue #{detail.priority} · Submitted {timeAgo(detail.submittedAt)}
            </p>
          </div>

          {/* Details */}
          <section>
            <h4 className="mb-3 text-sm font-semibold text-ink">Application details</h4>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {detail.phone && <Field label="Phone" value={detail.phone} />}
              {detail.sellerType && <Field label="Seller type" value={detail.sellerType} />}
              {detail.sellingPlatforms.length > 0 && (
                <Field label="Selling platforms" value={detail.sellingPlatforms.join(", ")} />
              )}
              {detail.collectionSize && (
                <Field label="Collection size" value={detail.collectionSize} />
              )}
              {detail.websiteOrSocialUrl && (
                <Field
                  label="Website / social"
                  value={
                    <a
                      href={detail.websiteOrSocialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all font-medium text-brand-600 hover:underline"
                    >
                      {detail.websiteOrSocialUrl}
                      <ExternalLink size={12} className="shrink-0" aria-hidden />
                    </a>
                  }
                />
              )}
              {detail.source && <Field label="Heard about us via" value={detail.source} />}
              {detail.addressText && <Field label="Address" value={detail.addressText} wide />}
              {detail.whatDoYouSell && (
                <Field label="What they sell" value={detail.whatDoYouSell} wide />
              )}
              {detail.biggestChallenge && (
                <Field label="Biggest challenge" value={detail.biggestChallenge} wide />
              )}
              <Field label="Signup attempts" value={String(detail.signupAttempts)} />
              <Field label="Referrals" value={String(detail.referralCount)} />
              {detail.emailOptOut && (
                <Field
                  label="Email preference"
                  value={
                    <Badge tone="warning" dot>
                      Opted out of emails
                    </Badge>
                  }
                />
              )}
              {detail.decisionNote && (
                <Field label="Decision note" value={detail.decisionNote} wide />
              )}
            </dl>
          </section>

          {/* CRM pipeline */}
          <section className="rounded-2xl border border-hairline p-4">
            <h4 className="text-sm font-semibold text-ink">Pipeline</h4>
            <p className="mt-0.5 text-xs text-ink-muted">
              Internal CRM tracking — invisible to the applicant and independent of the lifecycle
              status above.
            </p>
            {crmError && (
              <p role="alert" className={`mt-3 ${inlineErrorClass}`}>
                {crmError}
              </p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Select
                label="Pipeline status"
                value={crmValue}
                onChange={setCrmValue}
                options={CRM_OPTIONS}
              />
              <Input
                label="Follow-up date"
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                hint="Leave empty to clear the reminder."
              />
            </div>
            <div className="mt-4">
              <Button
                size="sm"
                disabled={!canAnnotate}
                loading={crmSaving}
                onClick={() => void handleSaveCrm()}
              >
                Save pipeline
              </Button>
            </div>
          </section>

          {/* Notes */}
          <section>
            <h4 className="mb-2 text-sm font-semibold text-ink">
              Internal notes ({detail.notes.length})
            </h4>
            {detail.notes.length === 0 ? (
              <p className="rounded-xl border border-hairline bg-tile/50 p-4 text-sm text-ink-muted">
                No notes yet — jot down calls, context, or anything the next reviewer should know.
              </p>
            ) : (
              <div className="space-y-2">
                {detail.notes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-hairline p-3">
                    <p className="text-sm text-ink">{note.body}</p>
                    <p className="mt-1.5 text-xs text-ink-muted">{timeAgo(note.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
            {noteError && (
              <p role="alert" className={`mt-3 ${inlineErrorClass}`}>
                {noteError}
              </p>
            )}
            <div className="mt-3 space-y-2">
              <Textarea
                label="Add a note"
                rows={3}
                placeholder="e.g. Spoke on the phone — wants to migrate about 300 listings from Etsy…"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!canAnnotate || !noteBody.trim()}
                loading={noteSaving}
                onClick={() => void handleAddNote()}
              >
                Add note
              </Button>
            </div>
          </section>

          {/* Decision actions */}
          <section className="rounded-2xl border border-hairline p-4">
            <h4 className="text-sm font-semibold text-ink">Decision</h4>
            <p className="mt-0.5 text-xs text-ink-muted">{decisionCopy(detail)}</p>

            {(detail.status === "pending_verification" || detail.status === "verified") && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {canAnnotate && detail.status === "pending_verification" && (
                  <Button
                    variant="outline"
                    icon={MailPlus}
                    loading={resending}
                    onClick={() => void handleResend()}
                  >
                    Resend verification
                  </Button>
                )}
                {canReview && detail.status === "verified" && (
                  <Button
                    icon={BadgeCheck}
                    onClick={() => {
                      setApproveNote("");
                      setApproveError(null);
                      setApproveOpen(true);
                    }}
                  >
                    Approve
                  </Button>
                )}
                {canReject && (
                  <Button
                    variant="outline"
                    className="border-danger/30 text-danger hover:bg-danger/5"
                    onClick={() => {
                      setRejectReason("");
                      setRejectSendEmail(true);
                      setRejectError(null);
                      setRejectOpen(true);
                    }}
                  >
                    Reject
                  </Button>
                )}
              </div>
            )}

            {resendNote && <p className={`mt-3 ${inlineInfoClass}`}>{resendNote}</p>}
            {removeError && (
              <p role="alert" className={`mt-3 ${inlineErrorClass}`}>
                {removeError}
              </p>
            )}

            <div className="mt-4 border-t border-hairline pt-3">
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                disabled={!canReview}
                className="text-danger hover:bg-danger/10"
                onClick={() => setRemoveOpen(true)}
              >
                Remove from waitlist
              </Button>
              <p className="mt-1 text-xs text-ink-muted">
                Soft-deletes the application — the standard route for GDPR erasure of waitlist data.
              </p>
            </div>
          </section>
        </div>
      )}

      {/* Approve modal */}
      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve application"
        description={
          detail
            ? `${detail.fullName} comes off the waitlist and can start selling on Pastel.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button loading={approveSaving} onClick={() => void handleApprove()}>
              Approve
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {approveError && (
            <p role="alert" className={inlineErrorClass}>
              {approveError}
            </p>
          )}
          <Textarea
            label="Decision note (optional)"
            rows={3}
            placeholder="e.g. Strong vintage inventory, verified store on two platforms…"
            hint="Stored on the application as the decision note."
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
          />
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject application"
        description={
          detail
            ? `${detail.fullName} stays on record with the decision — they cannot be approved afterwards.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={rejectSaving} onClick={() => void handleReject()}>
              Reject application
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {rejectError && (
            <p role="alert" className={inlineErrorClass}>
              {rejectError}
            </p>
          )}
          <Textarea
            label="Reason (optional)"
            rows={3}
            placeholder="e.g. Inventory does not fit the marketplace's categories right now…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <Switch
            checked={rejectSendEmail}
            onChange={setRejectSendEmail}
            label="Email the applicant"
          />
        </div>
      </Modal>

      {/* Remove confirmation */}
      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={() => void handleRemove()}
        title="Remove from waitlist"
        message={`This soft-deletes ${detail?.fullName ?? "this applicant"}'s application and takes it out of every queue view — the usual route for GDPR erasure requests and duplicate signups. The underlying record is retained for the audit trail.`}
        confirmLabel="Remove application"
      />
    </Drawer>
  );
}
