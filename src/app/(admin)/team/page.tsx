"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { grantOperator, listTeam, revokeOperator, updateOperatorRole } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDate, timeAgo } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import type { AccountStatus, OperatorMember } from "@/types/admin";
import { ADMIN_ROLE_LABELS, type AdminRole } from "@/types/auth";

const ROLE_OPTIONS = (Object.keys(ADMIN_ROLE_LABELS) as AdminRole[]).map((role) => ({
  value: role,
  label: ADMIN_ROLE_LABELS[role],
}));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Account standing on the underlying marketplace account, not the grant itself. */
const STATUS_META: Record<AccountStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  restricted: { label: "Restricted", tone: "warning" },
  banned: { label: "Banned", tone: "error" },
  deleted: { label: "Deleted", tone: "error" },
};

function memberName(member: OperatorMember): string {
  return member.displayName ?? member.email;
}

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  // The backend reserves team.manage to superAdmin; read the capability rather than re-deriving
  // the rule from the role, so a policy change on the server carries the UI with it.
  const canManage = useAuthStore((s) => s.can("team.manage"));

  const [team, setTeam] = useState<OperatorMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<AdminRole>("opsAgent");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [revoking, setRevoking] = useState<OperatorMember | null>(null);

  const load = useCallback(async () => {
    try {
      const members = await listTeam();
      setTeam(members);
      setError(null);
    } catch (err) {
      setTeam([]);
      setError(err instanceof ApiError ? err.message : "Could not load the team.");
    }
  }, []);

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  function openAdd() {
    setAddEmail("");
    setAddRole("opsAgent");
    setAddError(null);
    setAddOpen(true);
  }

  async function handleAdd() {
    if (adding) return;
    const email = addEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setAddError("Enter a valid email address.");
      return;
    }
    setAddError(null);
    setAdding(true);
    try {
      await grantOperator(email, addRole);
      toast({ title: "Operator added", description: email, tone: "success" });
      setAddOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setAddError("No Pastel account exists for this email — they need to sign up first.");
      } else if (err instanceof ApiError) {
        setAddError(err.message);
      } else {
        setAddError("Could not add the operator.");
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(member: OperatorMember, role: AdminRole) {
    if (role === member.role) return;
    // Show the new role immediately; a failed call reloads and snaps the select back.
    setTeam((prev) =>
      prev ? prev.map((m) => (m.userId === member.userId ? { ...m, role } : m)) : prev
    );
    try {
      await updateOperatorRole(member.userId, role);
      toast({
        title: "Role updated",
        description: `${memberName(member)} is now ${ADMIN_ROLE_LABELS[role]}.`,
        tone: "success",
      });
      await load();
    } catch (err) {
      toast({
        title: "Could not change role",
        description: err instanceof ApiError ? err.message : memberName(member),
        tone: "error",
      });
      await load();
    }
  }

  async function handleRevoke() {
    if (!revoking) return;
    const target = revoking;
    setRevoking(null);
    try {
      await revokeOperator(target.userId);
      toast({ title: "Access revoked", description: memberName(target), tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Could not revoke access",
        description: err instanceof ApiError ? err.message : memberName(target),
        tone: "error",
      });
    }
  }

  const columns: Column<OperatorMember>[] = [
    {
      key: "operator",
      header: "Operator",
      sortValue: (m) => memberName(m).toLowerCase(),
      render: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={memberName(m)} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <span className="truncate">{memberName(m)}</span>
              {m.userId === user?.id && <Badge tone="brand">You</Badge>}
            </div>
            <div className="truncate text-xs text-ink-muted">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: "w-44",
      sortValue: (m) => m.role,
      render: (m) =>
        canManage && m.userId !== user?.id ? (
          <Select
            value={m.role}
            onChange={(v) => void handleRoleChange(m, v as AdminRole)}
            options={ROLE_OPTIONS}
            className="w-40"
          />
        ) : (
          <Badge tone={m.role === "superAdmin" ? "brand" : "neutral"}>
            {ADMIN_ROLE_LABELS[m.role]}
          </Badge>
        ),
    },
    {
      key: "accountStatus",
      header: "Account",
      width: "w-32",
      sortValue: (m) => m.accountStatus,
      render: (m) => (
        <Badge tone={STATUS_META[m.accountStatus].tone} dot>
          {STATUS_META[m.accountStatus].label}
        </Badge>
      ),
    },
    {
      key: "grantedAt",
      header: "Granted",
      width: "w-36",
      sortValue: (m) => m.grantedAt,
      render: (m) => (
        <span className="text-ink-secondary" title={formatDate(m.grantedAt)}>
          {timeAgo(m.grantedAt)}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right",
            width: "w-24",
            render: (m) =>
              m.userId === user?.id ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger/10"
                  onClick={() => setRevoking(m)}
                >
                  Revoke
                </Button>
              ),
          } satisfies Column<OperatorMember>,
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can sign in to the operator console. Operators use their own Pastel marketplace accounts — access is a grant on top, not a separate login."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw size={15} aria-hidden /> Refresh
            </Button>
            {canManage && (
              <Button icon={UserPlus} onClick={openAdd}>
                Add operator
              </Button>
            )}
          </>
        }
      />

      {!canManage && (
        <p className="mb-4 text-sm text-ink-muted">
          You can see the team here, but adding operators, changing roles, and revoking access
          need the team.manage capability — a super admin.
        </p>
      )}

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      {team === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : team.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={ShieldCheck}
            title="No operators yet"
            description="Grant console access to an existing Pastel account and they can sign in with their own credentials."
            action={
              canManage ? <Button onClick={openAdd}>Add operator</Button> : undefined
            }
          />
        </Card>
      ) : (
        <Card className="p-0">
          <DataTable
            rows={team}
            columns={columns}
            rowKey={(m) => m.userId}
            pageSize={15}
            emptyTitle="No operators"
          />
        </Card>
      )}

      <Modal
        open={addOpen}
        onClose={() => !adding && setAddOpen(false)}
        title="Add operator"
        description="Grants console access to an existing Pastel account — they sign in with their own marketplace credentials."
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button loading={adding} icon={UserPlus} onClick={() => void handleAdd()}>
              Grant access
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {addError && (
            <p
              role="alert"
              className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
            >
              {addError}
            </p>
          )}
          <Input
            label="Email"
            type="email"
            required
            placeholder="name@example.com"
            hint="Must match an existing Pastel account — there's nothing to invite; if they haven't signed up yet, that comes first."
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
          />
          <Select
            label="Role"
            value={addRole}
            onChange={(v) => setAddRole(v as AdminRole)}
            options={ROLE_OPTIONS}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => void handleRevoke()}
        title="Revoke console access"
        message={`${revoking ? memberName(revoking) : ""} loses console access on their next session refresh; the grant history is kept.`}
        confirmLabel="Revoke access"
      />
    </>
  );
}
