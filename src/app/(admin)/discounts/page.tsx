"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, TicketPercent } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  createDiscount,
  deactivateDiscount,
  listDiscounts,
  updateDiscount,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatNumber } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { Discount, DiscountInput } from "@/types/admin";

type FormState = {
  code: string;
  kind: "percentage" | "freeShipping";
  percentage: string;
  title: string;
  remainingUsage: string;
  expiresAt: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  kind: "percentage",
  percentage: "10",
  title: "",
  remainingUsage: "",
  expiresAt: "",
};

function toInput(form: FormState): DiscountInput {
  return {
    code: form.code.trim().toUpperCase(),
    kind: form.kind,
    ...(form.kind === "percentage" ? { percentage: Number(form.percentage) } : {}),
    ...(form.title.trim() ? { title: form.title.trim() } : {}),
    ...(form.remainingUsage !== "" ? { remainingUsage: Number(form.remainingUsage) } : {}),
    ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
  };
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deactivating, setDeactivating] = useState<Discount | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listDiscounts();
      setDiscounts(data);
      setError(null);
    } catch (err) {
      setDiscounts([]);
      setError(err instanceof ApiError ? err.message : "Could not load discounts.");
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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditorOpen(true);
  }

  function openEdit(discount: Discount) {
    setEditing(discount);
    setForm({
      code: discount.code,
      kind: discount.kind,
      percentage: String(discount.percentage ?? 10),
      title: discount.title ?? "",
      remainingUsage: discount.remainingUsage === null ? "" : String(discount.remainingUsage),
      expiresAt: discount.expiresAt ? discount.expiresAt.slice(0, 10) : "",
    });
    setFormError(null);
    setEditorOpen(true);
  }

  async function handleSave() {
    if (saving) return;
    setFormError(null);
    setSaving(true);
    try {
      if (editing) {
        await updateDiscount(editing.id, toInput(form));
        toast({ title: "Discount updated", description: form.code.toUpperCase(), tone: "success" });
      } else {
        await createDiscount(toInput(form));
        toast({ title: "Discount created", description: form.code.toUpperCase(), tone: "success" });
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save the discount.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivating) return;
    const target = deactivating;
    setDeactivating(null);
    try {
      await deactivateDiscount(target.id);
      toast({ title: "Discount deactivated", description: target.code, tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Could not deactivate",
        description: err instanceof ApiError ? err.message : target.code,
        tone: "error",
      });
    }
  }

  const columns: Column<Discount>[] = [
    {
      key: "code",
      header: "Code",
      sortValue: (d) => d.code,
      render: (d) => <span className="font-semibold tracking-wide text-ink">{d.code}</span>,
    },
    {
      key: "kind",
      header: "Type",
      render: (d) =>
        d.kind === "percentage" ? (
          <Badge tone="brand">{d.percentage}% off</Badge>
        ) : (
          <Badge tone="forest">Free shipping</Badge>
        ),
    },
    { key: "title", header: "Title", render: (d) => d.title ?? "—" },
    {
      key: "isActive",
      header: "Status",
      render: (d) =>
        d.isActive ? (
          <Badge tone="success" dot>
            Active
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Inactive
          </Badge>
        ),
    },
    {
      key: "usageCount",
      header: "Redemptions",
      align: "right",
      sortValue: (d) => d.usageCount,
      render: (d) => formatNumber(d.usageCount),
    },
    {
      key: "remainingUsage",
      header: "Remaining",
      align: "right",
      render: (d) => (d.remainingUsage === null ? "∞" : formatNumber(d.remainingUsage)),
    },
    {
      key: "expiresAt",
      header: "Expires",
      render: (d) => (d.expiresAt ? formatDate(d.expiresAt) : "Never"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) => (
        <span className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
            Edit
          </Button>
          {d.isActive && (
            <Button variant="ghost" size="sm" onClick={() => setDeactivating(d)}>
              Deactivate
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Pastel-funded promo codes redeemed at checkout — separate from seller-funded shop promotions."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw size={15} aria-hidden /> Refresh
            </Button>
            <Button onClick={openCreate}>
              <Plus size={15} aria-hidden /> New discount
            </Button>
          </>
        }
      />

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      {discounts === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : discounts.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={TicketPercent}
            title="No discount codes yet"
            description="Create the first platform promo code — it becomes redeemable at checkout immediately."
            action={<Button onClick={openCreate}>New discount</Button>}
          />
        </Card>
      ) : (
        <Card className="p-0">
          <DataTable
            rows={discounts}
            columns={columns}
            rowKey={(d) => d.id}
            pageSize={15}
            emptyTitle="No discounts"
          />
        </Card>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? `Edit ${editing.code}` : "New discount"}
        description="Codes are stored uppercase and must be globally unique."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void handleSave()}>
              {editing ? "Save changes" : "Create discount"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
              {formError}
            </p>
          )}
          <Input
            label="Code"
            required
            placeholder="WELCOME10"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={form.kind}
              onChange={(v) => setForm({ ...form, kind: v as FormState["kind"] })}
              options={[
                { value: "percentage", label: "Percentage off" },
                { value: "freeShipping", label: "Free shipping" },
              ]}
            />
            {form.kind === "percentage" && (
              <Input
                label="Percent off"
                type="number"
                min={1}
                max={100}
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: e.target.value })}
              />
            )}
          </div>
          <Input
            label="Title"
            hint="Shown to buyers where the code is surfaced."
            placeholder="Welcome offer"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Usage limit"
              type="number"
              min={0}
              hint="Leave empty for unlimited."
              value={form.remainingUsage}
              onChange={(e) => setForm({ ...form, remainingUsage: e.target.value })}
            />
            <Input
              label="Expires"
              type="date"
              hint="Leave empty for no expiry."
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() => void handleDeactivate()}
        title="Deactivate discount"
        message={`"${deactivating?.code ?? ""}" stops working at checkout immediately. Redemption history is kept.`}
        confirmLabel="Deactivate"
      />
    </>
  );
}
