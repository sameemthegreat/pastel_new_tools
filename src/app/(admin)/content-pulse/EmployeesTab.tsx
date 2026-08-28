"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { createCpEmployee, deleteCpEmployee, listCpEmployees, updateCpEmployee } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { CpEmployee } from "@/types/admin";

export function EmployeesTab({ refreshKey }: { refreshKey: number }) {
  const [employees, setEmployees] = useState<CpEmployee[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<CpEmployee | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listCpEmployees();
      setEmployees(data);
      setError(null);
    } catch (err) {
      setEmployees([]);
      setError(err instanceof ApiError ? err.message : "Could not load employees.");
    }
  }, []);

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await load();
    };
    void run();
  }, [load, refreshKey]);

  function openAdd() {
    setName("");
    setHandle("");
    setFormError(null);
    setAddOpen(true);
  }

  async function handleCreate() {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("A name is required.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await createCpEmployee({
        name: trimmedName,
        ...(handle.trim() ? { handle: handle.trim() } : {}),
      });
      toast({ title: "Employee added", description: trimmedName, tone: "success" });
      setAddOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(`"${trimmedName}" already exists — employee names must be unique.`);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Could not add the employee.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(employee: CpEmployee, active: boolean) {
    // Optimistic: flip the switch in place, and fall back to a reload on failure.
    setEmployees((prev) =>
      prev === null ? prev : prev.map((e) => (e.id === employee.id ? { ...e, active } : e))
    );
    try {
      await updateCpEmployee(employee.id, { active });
    } catch (err) {
      toast({
        title: "Could not update the employee",
        description: err instanceof ApiError ? err.message : employee.name,
        tone: "error",
      });
      await load();
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await deleteCpEmployee(target.id);
      toast({ title: "Employee deleted", description: target.name, tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Could not delete",
        description: err instanceof ApiError ? err.message : target.name,
        tone: "error",
      });
    }
  }

  const columns: Column<CpEmployee>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (e) => e.name,
      render: (e) => <span className="font-semibold text-ink">{e.name}</span>,
    },
    {
      key: "handle",
      header: "Handle",
      sortValue: (e) => e.handle ?? "",
      render: (e) =>
        e.handle ? <span className="font-mono text-xs text-ink-secondary">{e.handle}</span> : "—",
    },
    {
      key: "active",
      header: "Active",
      sortValue: (e) => (e.active ? 1 : 0),
      render: (e) => (
        <Switch checked={e.active} onChange={(v) => void handleToggleActive(e, v)} />
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortValue: (e) => e.createdAt,
      render: (e) => formatDate(e.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <Button variant="ghost" size="sm" onClick={() => setDeleting(e)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <>
      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      <div className="mb-4 flex justify-end">
        <Button onClick={openAdd}>
          <UserPlus size={15} aria-hidden /> Add employee
        </Button>
      </div>

      {employees === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : employees.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={Users}
            title="No employees yet"
            description="Add the teammates who run the social accounts, then attribute posts to them on the Posts tab."
            action={
              <Button onClick={openAdd}>
                <UserPlus size={15} aria-hidden /> Add employee
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="p-0">
          <DataTable
            rows={employees}
            columns={columns}
            rowKey={(e) => e.id}
            pageSize={15}
            emptyTitle="No employees"
          />
        </Card>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add employee"
        description="Inactive employees keep their attributions but stop appearing in owner pickers."
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void handleCreate()}>
              Add employee
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
            >
              {formError}
            </p>
          )}
          <Input
            label="Name"
            required
            placeholder="Maya Chen"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Handle"
            hint="Optional — the account handle they usually post from."
            placeholder="@maya.creates"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title="Delete employee"
        message={`"${deleting?.name ?? ""}" is removed and every post attributed to them becomes unassigned. Imported metrics are kept.`}
        confirmLabel="Delete employee"
      />
    </>
  );
}
