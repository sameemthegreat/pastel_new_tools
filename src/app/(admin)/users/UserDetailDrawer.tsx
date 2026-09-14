"use client";

import { useEffect, useState } from "react";
import { Ban, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import {
  banUser,
  getUser,
  restrictUser,
  setFoundersBadge,
  unrestrictUser,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type { AccountStatus, AdminUserDetail } from "@/types/admin";

type ModAction = "restrict" | "ban";

const STATUS_TONES: Record<AccountStatus, BadgeTone> = {
  active: "success",
  restricted: "warning",
  banned: "error",
  deleted: "neutral",
};

function statusLabel(status: AccountStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * "restrict" → warning, "unrestrict" → success, "ban" → error, a Founder badge grant → brand;
 * anything else neutral.
 */
function historyTone(action: string): BadgeTone {
  const a = action.toLowerCase();
  if (a === "grant-founders-badge") return "brand";
  if (a === "revoke-founders-badge") return "neutral";
  if (a.includes("unrestrict")) return "success";
  if (a.includes("ban")) return "error";
  if (a.includes("restrict")) return "warning";
  return "neutral";
}

/** The Founder badge rows read as sentences; everything else is the action token humanized. */
const HISTORY_LABELS: Record<string, string> = {
  "grant-founders-badge": "Founder badge granted",
  "revoke-founders-badge": "Founder badge revoked",
};

function historyLabel(action: string): string {
  const known = HISTORY_LABELS[action.toLowerCase()];
  if (known) return known;
  const label = action.replace(/[_-]/g, " ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** 'seller' and 'provider' are the same class of account — only they can hold the Founder badge. */
function isSellerType(userType: string): boolean {
  return userType === "seller" || userType === "provider";
}

export function UserDetailDrawer({
  userId,
  onClose,
  onChanged,
}: {
  userId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  // UI courtesy only — /admin/users/:id/{restrict,unrestrict,ban} enforce users.moderate themselves.
  const canModerate = useAuthStore((s) => s.can("users.moderate"));
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped to refetch the detail (retry button, after a successful action).
  const [fetchKey, setFetchKey] = useState(0);

  const [action, setAction] = useState<ModAction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [unrestrictOpen, setUnrestrictOpen] = useState(false);
  const [founderSaving, setFounderSaving] = useState(false);

  // Opening a different user (or closing the drawer) clears the previous
  // detail and any in-progress moderation form. Resetting during render
  // (adjust-state-during-render, as DataTable does) means stale content never
  // paints; a same-user refetch keeps the current detail visible. The effect
  // below only fetches.
  const [prevUserId, setPrevUserId] = useState<string | null>(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setDetail(null);
    setLoadError(null);
    setAction(null);
    setReason("");
    setReasonError(null);
    setActionError(null);
    setUnrestrictOpen(false);
    setFounderSaving(false);
  }

  // Fetch the detail whenever a user is opened (or a refetch is requested).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const fetched = await getUser(userId);
        if (!cancelled) setDetail(fetched);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiError ? err.message : "Could not load this user's details."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, fetchKey]);

  // Starts a refetch of the open user; called from event handlers, where the
  // synchronous error-clear is fine.
  function refetchDetail() {
    setLoadError(null);
    setFetchKey((k) => k + 1);
  }

  function openAction(kind: ModAction) {
    setAction(kind);
    setReason("");
    setReasonError(null);
    setActionError(null);
  }

  function closeAction() {
    if (submitting) return;
    setAction(null);
    setReason("");
    setReasonError(null);
    setActionError(null);
  }

  async function submitAction() {
    if (!detail || !action || submitting) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError(
        action === "ban"
          ? "A reason is required before the account can be banned."
          : "A reason is required before the account can be restricted."
      );
      return;
    }
    setReasonError(null);
    setActionError(null);
    setSubmitting(true);
    try {
      if (action === "ban") {
        await banUser(detail.id, trimmed);
        toast({ title: "Account banned", description: detail.email, tone: "success" });
      } else {
        await restrictUser(detail.id, trimmed);
        toast({ title: "Account restricted", description: detail.email, tone: "success" });
      }
      setAction(null);
      setReason("");
      refetchDetail();
      onChanged();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "The action could not be completed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnrestrict() {
    if (!detail) return;
    setUnrestrictOpen(false);
    try {
      await unrestrictUser(detail.id);
      toast({ title: "Restriction lifted", description: detail.email, tone: "success" });
      refetchDetail();
      onChanged();
    } catch (err) {
      toast({
        title: "Could not lift the restriction",
        description: err instanceof ApiError ? err.message : detail.email,
        tone: "error",
      });
    }
  }

  // Grant/revoke the Founder badge. The switch flips optimistically and is put back if the
  // backend refuses (e.g. 409 for a non-seller); on success the detail is refetched so the new
  // history row and grant date show, and the list is told to reload its row.
  async function handleFounderToggle(next: boolean) {
    if (!detail || founderSaving) return;
    const previous = detail;
    setFounderSaving(true);
    setDetail({ ...detail, foundersBadge: next });
    try {
      await setFoundersBadge(detail.id, next);
      toast({
        title: next ? "Founder badge granted" : "Founder badge removed",
        description: detail.email,
        tone: "success",
      });
      refetchDetail();
      onChanged();
    } catch (err) {
      setDetail(previous);
      toast({
        title: "Founder badge update failed",
        description: err instanceof ApiError ? err.message : detail.email,
        tone: "error",
      });
    } finally {
      setFounderSaving(false);
    }
  }

  const loading = userId !== null && detail === null && loadError === null;
  // The badge can only be GRANTED to a seller; a badge left on a demoted account can still be revoked.
  const canHoldFounder = detail ? isSellerType(detail.userType) || detail.foundersBadge : false;

  return (
    <Drawer
      open={userId !== null}
      onClose={onClose}
      title="User detail"
      description={detail?.email}
      width="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
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
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={refetchDetail}
          >
            Try again
          </Button>
        </div>
      )}

      {detail && (
        <div className="space-y-6">
          {/* Identity */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight text-ink">{detail.email}</h3>
              <Badge tone={STATUS_TONES[detail.accountStatus]} dot>
                {statusLabel(detail.accountStatus)}
              </Badge>
              {detail.foundersBadge && (
                <Badge tone="brand">
                  <Sparkles size={12} aria-hidden /> Founder Seller
                </Badge>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-ink-muted">{detail.id}</p>
          </div>

          {/* Account facts */}
          <div className="rounded-2xl border border-hairline bg-tile/50 p-4">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Account type</dt>
                <dd className="capitalize text-ink">{detail.userType}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Restricted at</dt>
                <dd className="text-ink">
                  {detail.restrictedAt ? formatDateTime(detail.restrictedAt) : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Founder badge</dt>
                <dd className="text-ink">
                  {detail.foundersBadge
                    ? detail.foundersBadgeGrantedAt
                      ? `Granted ${formatDateTime(detail.foundersBadgeGrantedAt)}`
                      : "Granted"
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Seller badge — the admin-granted Founder Seller badge (sellers only) */}
          {canHoldFounder && (
            <section className="rounded-2xl border border-hairline bg-surface p-4 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Sparkles size={15} className="text-brand-500" aria-hidden /> Founder badge
                  </h4>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Shows on top of the New/Active Seller badges on their shop profile and on the
                    Top Sellers cards. Recorded in the restriction history with your operator
                    identity.
                  </p>
                  {!canModerate && (
                    <p className="mt-2 text-xs text-ink-muted">
                      Your operator role can see the badge but not grant or revoke it.
                    </p>
                  )}
                </div>
                <Switch
                  checked={detail.foundersBadge}
                  onChange={(next) => void handleFounderToggle(next)}
                  disabled={!canModerate || founderSaving}
                  label={detail.foundersBadge ? "Granted" : "Off"}
                />
              </div>
            </section>
          )}

          {/* Restriction history */}
          <section>
            <h4 className="mb-2 text-sm font-semibold text-ink">Restriction history</h4>
            {detail.restrictionHistory.length === 0 ? (
              <p className="rounded-xl border border-hairline bg-tile/50 p-4 text-sm text-ink-muted">
                No moderation actions have been recorded for this account.
              </p>
            ) : (
              <div className="space-y-2">
                {detail.restrictionHistory.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-hairline p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={historyTone(entry.action)}>{historyLabel(entry.action)}</Badge>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {timeAgo(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-secondary">{entry.reason}</p>
                    <p className="mt-1 text-xs text-ink-muted">by {entry.adminActor}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Moderation actions */}
          <section className="rounded-2xl border border-hairline bg-surface p-4 shadow-xs">
            <h4 className="text-sm font-semibold text-ink">Moderation</h4>
            <p className="mt-0.5 text-xs text-ink-muted">
              Every action is recorded in the restriction history with your operator identity.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!canModerate && (
                <p className="text-sm text-ink-muted">
                  Your operator role can open this account but not restrict or ban it.
                </p>
              )}
              {canModerate && detail.accountStatus === "active" && (
                <>
                  <Button variant="outline" onClick={() => openAction("restrict")}>
                    <ShieldAlert size={16} className="text-warning-500" aria-hidden /> Restrict
                    account
                  </Button>
                  <Button variant="danger" icon={Ban} onClick={() => openAction("ban")}>
                    Ban account
                  </Button>
                </>
              )}
              {canModerate && detail.accountStatus === "restricted" && (
                <>
                  <Button variant="primary" icon={ShieldCheck} onClick={() => setUnrestrictOpen(true)}>
                    Unrestrict account
                  </Button>
                  <Button variant="danger" icon={Ban} onClick={() => openAction("ban")}>
                    Ban account
                  </Button>
                </>
              )}
              {canModerate && detail.accountStatus === "banned" && (
                <p className="text-sm text-ink-muted">
                  Banned accounts stay banned — no further moderation actions are available.
                </p>
              )}
              {canModerate && detail.accountStatus === "deleted" && (
                <p className="text-sm text-ink-muted">
                  This account has been deleted, so moderation actions are no longer available.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Restrict / Ban — reason is required by the backend */}
      <Modal
        open={action !== null}
        onClose={closeAction}
        title={action === "ban" ? "Ban this account" : "Restrict this account"}
        description={
          action === "ban"
            ? "The account is locked out permanently. Bans cannot be lifted from the console."
            : "The account loses buying and selling access until an operator lifts the restriction."
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeAction} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={action === "ban" ? "danger" : "primary"}
              loading={submitting}
              onClick={() => void submitAction()}
            >
              {action === "ban" ? "Ban account" : "Restrict account"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <p
              role="alert"
              className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
            >
              {actionError}
            </p>
          )}
          <Textarea
            label={action === "ban" ? "Reason for ban" : "Reason for restriction"}
            required
            rows={4}
            maxLength={2000}
            placeholder={
              action === "ban"
                ? "e.g. Fraudulent storefront confirmed by the payments team…"
                : "e.g. Repeated authenticity complaints on listed items…"
            }
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
            error={reasonError ?? undefined}
            hint="Required — stored in the restriction history. Up to 2,000 characters."
          />
        </div>
      </Modal>

      {/* Unrestrict */}
      <ConfirmDialog
        open={unrestrictOpen}
        onClose={() => setUnrestrictOpen(false)}
        onConfirm={() => void handleUnrestrict()}
        title="Lift this restriction?"
        message={`${detail?.email ?? "This account"} regains full access to buying and selling immediately. The decision is recorded in the restriction history.`}
        confirmLabel="Unrestrict account"
        tone="brand"
      />
    </Drawer>
  );
}
