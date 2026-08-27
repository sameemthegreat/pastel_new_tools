"use client";

import { useMemo, useState } from "react";
import {
  KeyRound,
  Loader2,
  Mail,
  MailPlus,
  MoreHorizontal,
  Pencil,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { SELF_MEMBER_ID } from "@/data/team";
import { formatDate, formatDateTime, formatNumber, NOW, timeAgo } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { useTeamStore } from "@/stores/teamStore";
import type { InviteEmailType, TeamMember, TeamRole } from "@/types/team";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._-]{2,24}$/i;

const CURRENT_MONTH = NOW.slice(0, 7); // "2026-08"

const INVITE_TYPE_META: Record<InviteEmailType, { label: string; tone: BadgeTone }> = {
  welcome: { label: "Welcome", tone: "brand" },
  resend: { label: "Welcome resend", tone: "gold" },
  reset: { label: "Password reset", tone: "warning" },
};

type ConfirmKind = "reset" | "resend" | "remove";

type MemberFormErrors = {
  name?: string;
  username?: string;
  email?: string;
};

export default function TeamPage() {
  const members = useTeamStore((s) => s.members);
  const invites = useTeamStore((s) => s.invites);
  const addingMember = useTeamStore((s) => s.addingMember);
  const savingMember = useTeamStore((s) => s.savingMember);
  const sendingTest = useTeamStore((s) => s.sendingTest);
  const busyMemberId = useTeamStore((s) => s.busyMemberId);
  const addMember = useTeamStore((s) => s.addMember);
  const updateMember = useTeamStore((s) => s.updateMember);
  const setRole = useTeamStore((s) => s.setRole);
  const removeMember = useTeamStore((s) => s.removeMember);
  const resetPassword = useTeamStore((s) => s.resetPassword);
  const resendWelcome = useTeamStore((s) => s.resendWelcome);
  const sendTestEmail = useTeamStore((s) => s.sendTestEmail);

  const authUser = useAuthStore((s) => s.user);
  const selfMember = members.find((m) => m.id === SELF_MEMBER_ID) ?? null;
  const actorName = authUser?.name ?? selfMember?.name ?? "Admin";
  const testEmailTarget = authUser?.email ?? selfMember?.email ?? "admin@mypastel.com";

  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", username: "", email: "", role: "member" });
  const [addErrors, setAddErrors] = useState<MemberFormErrors>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [editErrors, setEditErrors] = useState<MemberFormErrors>({});

  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; member: TeamMember } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const editingMember = editingId ? members.find((m) => m.id === editingId) ?? null : null;
  const detailMember = detailId ? members.find((m) => m.id === detailId) ?? null : null;

  const adminCount = members.filter((m) => m.role === "admin").length;
  const invitesThisMonth = invites.filter((i) => i.sentAt.startsWith(CURRENT_MONTH)).length;
  const joinedThisMonth = members.filter((m) => m.joinedAt.startsWith(CURRENT_MONTH)).length;

  const normalizedQuery = query.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (tab === "admin" && m.role !== "admin") return false;
      if (tab === "member" && m.role !== "member") return false;
      if (!normalizedQuery) return true;
      return (
        m.name.toLowerCase().includes(normalizedQuery) ||
        m.username.toLowerCase().includes(normalizedQuery) ||
        m.email.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [members, tab, normalizedQuery]);

  const activityRows = useMemo(() => {
    const sorted = [...invites].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    if (!normalizedQuery) return sorted;
    return sorted.filter(
      (i) =>
        i.recipientName.toLowerCase().includes(normalizedQuery) ||
        i.recipientEmail.toLowerCase().includes(normalizedQuery) ||
        i.sentBy.toLowerCase().includes(normalizedQuery)
    );
  }, [invites, normalizedQuery]);

  const detailInvites = useMemo(() => {
    if (!detailMember) return [];
    return invites
      .filter((i) => i.memberId === detailMember.id)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }, [invites, detailMember]);

  function openAdd() {
    setAddForm({ name: "", username: "", email: "", role: "member" });
    setAddErrors({});
    setAddOpen(true);
  }

  function openEdit(member: TeamMember) {
    setEditForm({ name: member.name, email: member.email });
    setEditErrors({});
    setEditingId(member.id);
  }

  function validateAdd(): boolean {
    const errors: MemberFormErrors = {};
    if (!addForm.name.trim()) errors.name = "Name is required.";
    const username = addForm.username.trim();
    if (!username) {
      errors.username = "Username is required.";
    } else if (!USERNAME_RE.test(username)) {
      errors.username = "2–24 characters: letters, numbers, dots, dashes.";
    } else if (members.some((m) => m.username.toLowerCase() === username.toLowerCase())) {
      errors.username = "That username is already taken.";
    }
    const email = addForm.email.trim();
    if (!email) {
      errors.email = "Email is required.";
    } else if (!EMAIL_RE.test(email)) {
      errors.email = "Enter a valid email address.";
    } else if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
      errors.email = "A member with this email already exists.";
    }
    setAddErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submitAdd() {
    if (!validateAdd()) return;
    addMember(
      {
        name: addForm.name,
        username: addForm.username,
        email: addForm.email,
        role: addForm.role as TeamRole,
      },
      actorName,
      () => setAddOpen(false)
    );
  }

  function validateEdit(): boolean {
    const errors: MemberFormErrors = {};
    if (!editForm.name.trim()) errors.name = "Name is required.";
    const email = editForm.email.trim();
    if (!email) {
      errors.email = "Email is required.";
    } else if (!EMAIL_RE.test(email)) {
      errors.email = "Enter a valid email address.";
    } else if (
      members.some((m) => m.id !== editingId && m.email.toLowerCase() === email.toLowerCase())
    ) {
      errors.email = "Another member already uses this email.";
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submitEdit() {
    if (!editingId || !validateEdit()) return;
    updateMember(editingId, { name: editForm.name, email: editForm.email }, () =>
      setEditingId(null)
    );
  }

  function handleConfirm() {
    if (!confirm) return;
    const { kind, member } = confirm;
    if (kind === "reset") resetPassword(member.id, actorName);
    if (kind === "resend") resendWelcome(member.id, actorName);
    if (kind === "remove") {
      removeMember(member.id);
      if (detailId === member.id) setDetailId(null);
    }
    setConfirm(null);
  }

  const memberColumns: Column<TeamMember>[] = [
    {
      key: "member",
      header: "Member",
      sortValue: (m) => m.name.toLowerCase(),
      render: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={m.name} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <span className="truncate">{m.name}</span>
              {m.id === SELF_MEMBER_ID && <Badge tone="brand">You</Badge>}
            </div>
            <div className="truncate text-xs text-ink-muted">@{m.username}</div>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortValue: (m) => m.email,
      render: (m) => <span className="text-ink-secondary">{m.email}</span>,
    },
    {
      key: "role",
      header: "Role",
      width: "w-36",
      sortValue: (m) => m.role,
      render: (m) =>
        m.id === SELF_MEMBER_ID ? (
          <Badge tone={m.role === "admin" ? "brand" : "neutral"}>
            {m.role === "admin" ? "Admin" : "Member"}
          </Badge>
        ) : (
          <div className="w-32" onClick={(e) => e.stopPropagation()}>
            <Select
              value={m.role}
              onChange={(v) => setRole(m.id, v as TeamRole)}
              options={ROLE_OPTIONS}
            />
          </div>
        ),
    },
    {
      key: "joined",
      header: "Joined",
      width: "w-32",
      sortValue: (m) => m.joinedAt,
      render: (m) => <span className="text-ink-secondary">{formatDate(m.joinedAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-16",
      render: (m) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          {m.id === SELF_MEMBER_ID ? (
            <span className="text-xs font-medium text-ink-muted">You</span>
          ) : busyMemberId === m.id ? (
            <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
          ) : (
            <Dropdown
              trigger={
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-tile">
                  <MoreHorizontal className="h-4 w-4" />
                </span>
              }
              items={[
                { label: "Edit member", icon: Pencil, onClick: () => openEdit(m) },
                {
                  label: "Reset password",
                  icon: KeyRound,
                  onClick: () => setConfirm({ kind: "reset", member: m }),
                },
                {
                  label: "Resend welcome email",
                  icon: MailPlus,
                  onClick: () => setConfirm({ kind: "resend", member: m }),
                },
                {
                  label: "Remove member",
                  icon: Trash2,
                  tone: "danger",
                  separatorAbove: true,
                  onClick: () => setConfirm({ kind: "remove", member: m }),
                },
              ]}
            />
          )}
        </div>
      ),
    },
  ];

  const activityColumns: Column<(typeof activityRows)[number]>[] = [
    {
      key: "recipient",
      header: "Recipient",
      sortValue: (i) => i.recipientName.toLowerCase(),
      render: (i) => (
        <div className="flex items-center gap-3">
          <Avatar name={i.recipientName} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{i.recipientName}</div>
            <div className="truncate text-xs text-ink-muted">{i.recipientEmail}</div>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Email",
      width: "w-40",
      sortValue: (i) => i.type,
      render: (i) => (
        <Badge tone={INVITE_TYPE_META[i.type].tone}>{INVITE_TYPE_META[i.type].label}</Badge>
      ),
    },
    {
      key: "sentBy",
      header: "Sent by",
      width: "w-40",
      sortValue: (i) => i.sentBy.toLowerCase(),
      render: (i) => <span className="text-ink-secondary">{i.sentBy}</span>,
    },
    {
      key: "sentAt",
      header: "Sent",
      width: "w-56",
      sortValue: (i) => i.sentAt,
      render: (i) => (
        <div>
          <div className="text-ink-secondary">{formatDateTime(i.sentAt)}</div>
          <div className="text-xs text-ink-muted">{timeAgo(i.sentAt)}</div>
        </div>
      ),
    },
  ];

  const confirmCopy: Record<ConfirmKind, { title: string; message: string; label: string; tone: "danger" | "brand" }> =
    {
      reset: {
        title: "Reset password?",
        message: confirm
          ? `Send a password reset email to ${confirm.member.email}? Their current password keeps working until they choose a new one.`
          : "",
        label: "Send reset email",
        tone: "brand",
      },
      resend: {
        title: "Resend welcome email?",
        message: confirm
          ? `Send ${confirm.member.name} a fresh welcome email with new login details at ${confirm.member.email}?`
          : "",
        label: "Resend email",
        tone: "brand",
      },
      remove: {
        title: "Remove member?",
        message: confirm
          ? `This permanently removes ${confirm.member.name} (@${confirm.member.username}) from the team and revokes console access. This cannot be undone.`
          : "",
        label: "Remove member",
        tone: "danger",
      },
    };

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage console accounts, roles, and welcome emails for the Pastel admin team."
        actions={
          <>
            <Button
              variant="outline"
              icon={Mail}
              loading={sendingTest}
              onClick={() => sendTestEmail(testEmailTarget)}
            >
              Send test email
            </Button>
            <Button icon={UserPlus} onClick={openAdd}>
              Add member
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total members"
          value={formatNumber(members.length)}
          icon={Users}
          hint={`${joinedThisMonth} joined in August`}
        />
        <StatCard
          label="Admins"
          value={formatNumber(adminCount)}
          icon={ShieldCheck}
          hint={
            members.length > 0
              ? `${Math.round((adminCount / members.length) * 100)}% of the team`
              : "No members yet"
          }
        />
        <StatCard
          label="Invites sent this month"
          value={formatNumber(invitesThisMonth)}
          icon={Send}
          hint="Welcome, resend & reset emails"
        />
      </div>

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: "all", label: "All members", count: members.length },
            { key: "admin", label: "Admins", count: adminCount },
            { key: "member", label: "Members", count: members.length - adminCount },
            { key: "activity", label: "Email activity", count: invites.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={
            tab === "activity" ? "Search recipient, email, or sender…" : "Search name, username, or email…"
          }
          className="w-full sm:w-80"
        />
        <span className="text-sm text-ink-muted">
          {tab === "activity"
            ? `${formatNumber(activityRows.length)} emails logged`
            : `${formatNumber(filteredMembers.length)} of ${formatNumber(members.length)} members`}
        </span>
      </div>

      {tab === "activity" ? (
        <DataTable
          rows={activityRows}
          columns={activityColumns}
          rowKey={(i) => i.id}
          pageSize={10}
          emptyTitle="No email activity"
          emptyDescription="Welcome, resend, and password reset emails will show up here."
        />
      ) : (
        <DataTable
          rows={filteredMembers}
          columns={memberColumns}
          rowKey={(m) => m.id}
          onRowClick={(m) => setDetailId(m.id)}
          pageSize={10}
          emptyTitle="No members found"
          emptyDescription="Try a different search, or add a new team member."
        />
      )}

      {/* Add member */}
      <Modal
        open={addOpen}
        onClose={() => !addingMember && setAddOpen(false)}
        title="Add team member"
        description="They'll receive a welcome email with their login details."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={addingMember}>
              Cancel
            </Button>
            <Button loading={addingMember} icon={Send} onClick={submitAdd}>
              Add &amp; send welcome email
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Full name"
            placeholder="e.g. Nadia Rahman"
            value={addForm.name}
            error={addErrors.name}
            onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Username"
            placeholder="e.g. nadiar"
            value={addForm.username}
            error={addErrors.username}
            hint="Used for @mentions and attribution across the console."
            onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            placeholder="name@mypastel.com"
            value={addForm.email}
            error={addErrors.email}
            hint="Login details will be sent here."
            onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Select
            label="Role"
            value={addForm.role}
            onChange={(v) => setAddForm((f) => ({ ...f, role: v }))}
            options={ROLE_OPTIONS}
          />
        </div>
      </Modal>

      {/* Edit member */}
      <Modal
        open={!!editingMember}
        onClose={() => !savingMember && setEditingId(null)}
        title={editingMember ? `Edit ${editingMember.name}` : "Edit member"}
        description={editingMember ? `@${editingMember.username}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingId(null)} disabled={savingMember}>
              Cancel
            </Button>
            <Button loading={savingMember} onClick={submitEdit}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Full name"
            value={editForm.name}
            error={editErrors.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={editForm.email}
            error={editErrors.email}
            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Confirmations */}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title={confirm ? confirmCopy[confirm.kind].title : ""}
        message={confirm ? confirmCopy[confirm.kind].message : ""}
        confirmLabel={confirm ? confirmCopy[confirm.kind].label : "Confirm"}
        tone={confirm ? confirmCopy[confirm.kind].tone : "danger"}
      />

      {/* Member detail */}
      <Drawer
        open={!!detailMember}
        onClose={() => setDetailId(null)}
        title={detailMember?.name ?? "Member"}
        description={detailMember ? `@${detailMember.username}` : undefined}
        footer={
          detailMember && detailMember.id !== SELF_MEMBER_ID ? (
            <>
              <Button
                variant="outline"
                icon={Pencil}
                onClick={() => {
                  setDetailId(null);
                  openEdit(detailMember);
                }}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => setConfirm({ kind: "remove", member: detailMember })}
              >
                Remove
              </Button>
            </>
          ) : undefined
        }
      >
        {detailMember && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={detailMember.name} size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-ink">{detailMember.name}</span>
                  {detailMember.id === SELF_MEMBER_ID && <Badge tone="brand">You</Badge>}
                </div>
                <div className="mt-1">
                  <Badge tone={detailMember.role === "admin" ? "brand" : "neutral"}>
                    {detailMember.role === "admin" ? "Admin" : "Member"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-hairline bg-tile/50 p-4">
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-muted">Email</dt>
                  <dd className="truncate text-ink">{detailMember.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-muted">Username</dt>
                  <dd className="text-ink">@{detailMember.username}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-muted">Joined</dt>
                  <dd className="text-ink">{formatDate(detailMember.joinedAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-muted">Last active</dt>
                  <dd className="text-ink">{timeAgo(detailMember.lastActiveAt)}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">Email history</h3>
              {detailInvites.length === 0 ? (
                <p className="text-sm text-ink-muted">No emails have been sent to this member yet.</p>
              ) : (
                <ul className="space-y-2">
                  {detailInvites.map((invite) => (
                    <li
                      key={invite.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        {invite.type === "reset" ? (
                          <KeyRound className="h-4 w-4 text-warning-500" />
                        ) : invite.type === "resend" ? (
                          <MailPlus className="h-4 w-4 text-gold" />
                        ) : (
                          <Mail className="h-4 w-4 text-brand-500" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-ink">
                            {INVITE_TYPE_META[invite.type].label}
                          </div>
                          <div className="text-xs text-ink-muted">by {invite.sentBy}</div>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-ink-muted">{timeAgo(invite.sentAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
