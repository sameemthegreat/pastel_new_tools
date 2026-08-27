"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { formatCurrency, formatDate, timeAgo } from "@/lib/format";
import { useUsersStore } from "@/stores/usersStore";
import type { MarketUser, UserType } from "@/types/users";

type ModForm = "restrict" | "unrestrict" | "delete";

function UserStatusBadge({ user }: { user: MarketUser }) {
  if (user.status === "banned") {
    return (
      <Badge tone="error" dot>
        Banned
      </Badge>
    );
  }
  return <StatusBadge status={user.status} />;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-tile px-3 py-2.5">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-ink-muted">{label}</span>
      <span className="text-right text-sm text-ink">{value}</span>
    </div>
  );
}

export function UserDetailDrawer({
  userId,
  open,
  onClose,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const users = useUsersStore((s) => s.users);
  const pending = useUsersStore((s) => s.pending);
  const restrict = useUsersStore((s) => s.restrict);
  const unrestrict = useUsersStore((s) => s.unrestrict);
  const changeRole = useUsersStore((s) => s.changeRole);
  const deleteAccount = useUsersStore((s) => s.deleteAccount);

  const user = userId ? users.find((u) => u.id === userId) ?? null : null;

  const [modForm, setModForm] = useState<ModForm | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Reset the moderation form whenever a different user is opened.
  useEffect(() => {
    setModForm(null);
    setReason("");
    setReasonError("");
    setConfirmOpen(false);
  }, [userId]);

  // If the open user disappears (account deleted), close the drawer.
  useEffect(() => {
    if (open && userId && !user) onClose();
  }, [open, userId, user, onClose]);

  const isPending = user !== null && pending?.userId === user.id;

  const beginForm = (kind: ModForm) => {
    setModForm(kind);
    setReason("");
    setReasonError("");
  };

  const cancelForm = () => {
    setModForm(null);
    setReason("");
    setReasonError("");
  };

  const handleContinue = () => {
    if (modForm !== "unrestrict" && reason.trim().length < 10) {
      setReasonError(
        "Please give a reason (at least 10 characters) — it is stored in the audit trail."
      );
      return;
    }
    setReasonError("");
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!user || !modForm) return;
    setConfirmOpen(false);
    const trimmed = reason.trim();
    if (modForm === "restrict") restrict(user.id, trimmed);
    if (modForm === "unrestrict")
      unrestrict(user.id, trimmed || "Restriction lifted after review.");
    if (modForm === "delete") deleteAccount(user.id, trimmed);
    setModForm(null);
    setReason("");
  };

  const confirmCopy =
    user && modForm === "restrict"
      ? {
          title: "Restrict this account?",
          message: `${user.displayName} will be blocked from selling and purchasing, and any published listings will be closed. Reason: "${reason.trim()}"`,
          confirmLabel: "Restrict account",
          tone: "danger" as const,
        }
      : user && modForm === "unrestrict"
        ? {
            title: "Lift this restriction?",
            message: `${user.displayName} will regain full access to buying${user.userType === "seller" ? " and selling" : ""}. The decision is recorded in the restriction history.`,
            confirmLabel: "Unrestrict account",
            tone: "brand" as const,
          }
        : user && modForm === "delete"
          ? {
              title: "Delete this account?",
              message: `This permanently removes ${user.displayName}'s profile, listings, and history, and appends an entry to the deletion log. This cannot be undone. Reason: "${reason.trim()}"`,
              confirmLabel: "Delete account",
              tone: "danger" as const,
            }
          : null;

  const published =
    user?.listings.filter((l) => l.state === "published").length ?? 0;
  const closed = user?.listings.filter((l) => l.state === "closed").length ?? 0;
  const restrictions =
    user?.restrictionHistory.filter((h) => h.action === "restrict").length ?? 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="User detail"
      description={user ? `@${user.handle} · ${user.email}` : undefined}
      width="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {user && (
        <div className="space-y-6">
          {/* Profile block */}
          <div className="flex items-start gap-4">
            <Avatar name={user.displayName} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-ink">
                  {user.displayName}
                </h3>
                <Badge tone={user.userType === "seller" ? "forest" : "neutral"}>
                  {user.userType === "seller" ? "Seller" : "Buyer"}
                </Badge>
                <UserStatusBadge user={user} />
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-secondary">
                {user.email}
              </p>
              {user.userType === "seller" && user.businessName && (
                <p className="mt-1 flex items-center gap-2 text-sm text-ink">
                  <span className="font-medium">{user.businessName}</span>
                  <a
                    href={`https://mypastel.com/${user.handle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    View store <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </p>
              )}
              {user.bio && (
                <p className="mt-2 text-sm text-ink-secondary">{user.bio}</p>
              )}
            </div>
          </div>

          {/* Status banners */}
          {user.status === "restricted" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning-100 bg-warning-50 p-3.5">
              <ShieldAlert
                size={16}
                className="mt-0.5 shrink-0 text-warning-700"
                aria-hidden="true"
              />
              <p className="text-sm text-warning-700">
                <span className="font-semibold">
                  Restricted{" "}
                  {user.restrictedAt ? `on ${formatDate(user.restrictedAt)}` : ""}
                  .
                </span>{" "}
                {user.restrictionReason}
              </p>
            </div>
          )}
          {user.status === "banned" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-error-100 bg-error-50 p-3.5">
              <Ban
                size={16}
                className="mt-0.5 shrink-0 text-error-700"
                aria-hidden="true"
              />
              <p className="text-sm text-error-700">
                <span className="font-semibold">
                  Banned{" "}
                  {user.restrictedAt ? `on ${formatDate(user.restrictedAt)}` : ""}
                  .
                </span>{" "}
                {user.restrictionReason}
              </p>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Listings" value={String(user.listings.length)} />
            <StatTile label="Published" value={String(published)} />
            <StatTile label="Closed" value={String(closed)} />
            <StatTile label="Restrictions" value={String(restrictions)} />
          </div>

          {/* Meta */}
          <div className="rounded-xl border border-hairline px-4 py-2">
            <MetaRow label="Location" value={user.location} />
            <MetaRow label="Phone" value={user.phone} />
            <MetaRow label="Joined" value={formatDate(user.createdAt)} />
            <MetaRow label="Last seen" value={timeAgo(user.lastSeenAt)} />
          </div>

          {/* Seller listings mini-table */}
          {user.userType === "seller" && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-ink">
                Listings ({user.listings.length})
              </h4>
              {user.listings.length === 0 ? (
                <p className="rounded-xl border border-hairline bg-tile/50 p-4 text-sm text-ink-muted">
                  This seller has no listings yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-hairline">
                  <table className="w-full min-w-[440px] text-sm">
                    <thead>
                      <tr className="bg-tile/60 text-left text-xs font-medium uppercase tracking-wide text-ink-secondary">
                        <th className="px-3.5 py-2.5">Title</th>
                        <th className="px-3.5 py-2.5 text-right">Price</th>
                        <th className="px-3.5 py-2.5">State</th>
                        <th className="px-3.5 py-2.5">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.listings.map((l) => (
                        <tr key={l.id} className="border-t border-hairline">
                          <td className="max-w-[220px] truncate px-3.5 py-2.5 text-ink">
                            {l.title}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-medium tabular-nums text-price">
                            {formatCurrency(l.priceCents / 100)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <StatusBadge status={l.state} />
                          </td>
                          <td className="px-3.5 py-2.5 text-ink-secondary">
                            {formatDate(l.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Restriction history */}
          {user.restrictionHistory.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-ink">
                Restriction history
              </h4>
              <div className="space-y-2">
                {[...user.restrictionHistory].reverse().map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-hairline p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone={h.action === "restrict" ? "error" : "success"}>
                        {h.action === "restrict" ? "Restricted" : "Unrestricted"}
                      </Badge>
                      <span className="text-xs text-ink-muted">
                        by {h.actor} · {formatDate(h.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-secondary">
                      {h.reason}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Moderation actions */}
          <section className="rounded-2xl border border-hairline bg-surface p-4 shadow-xs">
            <h4 className="text-sm font-semibold text-ink">Moderation</h4>
            <p className="mt-0.5 text-xs text-ink-muted">
              Every action is recorded in the audit trail.
            </p>

            <div className={isPending ? "pointer-events-none opacity-60" : ""}>
              <div className="mt-4 max-w-xs">
                <Select
                  label="Account role"
                  value={user.userType}
                  onChange={(v) => changeRole(user.id, v as UserType)}
                  options={[
                    { value: "seller", label: "Seller" },
                    { value: "buyer", label: "Buyer" },
                  ]}
                />
                <p className="mt-1.5 text-xs text-ink-muted">
                  Demoting a seller to buyer closes their published listings.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {user.status === "active" && (
                <Button
                  variant="outline"
                  icon={ShieldAlert}
                  loading={isPending && pending?.kind === "restrict"}
                  disabled={isPending}
                  onClick={() => beginForm("restrict")}
                >
                  Restrict account
                </Button>
              )}
              {user.status === "restricted" && (
                <Button
                  variant="secondary"
                  icon={ShieldCheck}
                  loading={isPending && pending?.kind === "unrestrict"}
                  disabled={isPending}
                  onClick={() => beginForm("unrestrict")}
                >
                  Unrestrict account
                </Button>
              )}
              {user.status === "banned" && (
                <p className="text-sm text-ink-muted">
                  Banned accounts are read-only. Deleting removes the account
                  permanently.
                </p>
              )}
              <Button
                variant="danger"
                icon={Trash2}
                loading={isPending && pending?.kind === "delete"}
                disabled={isPending}
                onClick={() => beginForm("delete")}
              >
                Delete account
              </Button>
            </div>

            {modForm && (
              <div className="mt-4 space-y-3 rounded-xl border border-hairline bg-cream/60 p-4">
                <Textarea
                  label={
                    modForm === "restrict"
                      ? "Reason for restriction"
                      : modForm === "unrestrict"
                        ? "Reason for lifting (optional)"
                        : "Reason for deletion"
                  }
                  placeholder={
                    modForm === "restrict"
                      ? "e.g. Repeated authenticity complaints on listed items…"
                      : modForm === "unrestrict"
                        ? "e.g. Appeal reviewed — evidence verified…"
                        : "e.g. Fraudulent storefront confirmed by payments team…"
                  }
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  error={reasonError || undefined}
                  hint={
                    modForm === "delete"
                      ? "The reason is appended to the deletion log."
                      : undefined
                  }
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={modForm === "unrestrict" ? "primary" : "danger"}
                    onClick={handleContinue}
                  >
                    Continue
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelForm}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {confirmCopy && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel={confirmCopy.confirmLabel}
          tone={confirmCopy.tone}
        />
      )}
    </Drawer>
  );
}
