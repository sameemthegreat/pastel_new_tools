"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { deleteContentPulseImport, listContentPulseImports } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, formatNumber } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { CpImport } from "@/types/admin";

export function ImportsTab({
  refreshKey,
  onImportFile,
}: {
  refreshKey: number;
  onImportFile: () => void;
}) {
  const [imports, setImports] = useState<CpImport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CpImport | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listContentPulseImports();
      setImports(data);
      setError(null);
    } catch (err) {
      setImports([]);
      setError(err instanceof ApiError ? err.message : "Could not load imports.");
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

  async function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await deleteContentPulseImport(target.id);
      toast({ title: "Import deleted", description: target.filename, tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Could not delete the import",
        description: err instanceof ApiError ? err.message : target.filename,
        tone: "error",
      });
    }
  }

  const columns: Column<CpImport>[] = [
    {
      key: "createdAt",
      header: "When",
      sortValue: (i) => i.createdAt,
      render: (i) => (
        <span className="whitespace-nowrap text-ink">{formatDateTime(i.createdAt)}</span>
      ),
    },
    {
      key: "filename",
      header: "File",
      sortValue: (i) => i.filename,
      render: (i) => <span className="font-mono text-xs text-ink">{i.filename}</span>,
    },
    {
      key: "label",
      header: "Label",
      render: (i) => i.label ?? "—",
    },
    {
      key: "period",
      header: "Period",
      render: (i) => i.period ?? "—",
    },
    {
      key: "rowCount",
      header: "Rows",
      align: "right",
      sortValue: (i) => i.rowCount,
      render: (i) => formatNumber(i.rowCount),
    },
    {
      key: "newPosts",
      header: "New",
      align: "right",
      sortValue: (i) => i.newPosts,
      render: (i) => formatNumber(i.newPosts),
    },
    {
      key: "updatedPosts",
      header: "Updated",
      align: "right",
      sortValue: (i) => i.updatedPosts,
      render: (i) => formatNumber(i.updatedPosts),
    },
    {
      key: "importedBy",
      header: "Imported by",
      sortValue: (i) => i.importedBy,
      render: (i) => <span className="text-ink-secondary">{i.importedBy}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (i) => (
        <Button variant="ghost" size="sm" onClick={() => setDeleting(i)}>
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

      {imports === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : imports.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={FileSpreadsheet}
            title="No imports yet"
            description="Every metric on this page comes from platform export files. Import the first one to start tracking posts."
            action={
              <Button onClick={onImportFile}>
                <Upload size={15} aria-hidden /> Import file
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="p-0">
          <DataTable
            rows={imports}
            columns={columns}
            rowKey={(i) => i.id}
            pageSize={15}
            emptyTitle="No imports"
          />
        </Card>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title="Delete import"
        message={`"${deleting?.filename ?? ""}" and every metric snapshot it recorded disappear from post histories, and posts this import alone created are cleaned up. This cannot be undone.`}
        confirmLabel="Delete import"
      />
    </>
  );
}
