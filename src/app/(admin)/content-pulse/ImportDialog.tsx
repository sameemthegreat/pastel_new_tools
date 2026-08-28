"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { confirmContentPulseImport, uploadContentPulseFile } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCompact, formatNumber } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { CpUploadPreview } from "@/types/admin";

const CAPTION_MAX = 60;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Compact labelled figures shown above the sample table once a file parses. */
function StatRow({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-hairline bg-tile/40 px-3.5 py-2.5">
          <dt className="text-xs font-medium text-ink-secondary">{stat.label}</dt>
          <dd className="mt-0.5 truncate text-lg font-semibold tabular-nums text-ink" title={stat.value}>
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<CpUploadPreview | null>(null);
  const [label, setLabel] = useState("");
  const [period, setPeriod] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumped when the dialog closes or a newer file is chosen, so a slow upload
  // that resolves afterwards never repopulates the preview.
  const uploadSeq = useRef(0);

  function handleClose() {
    uploadSeq.current += 1;
    setUploading(false);
    setPreview(null);
    setLabel("");
    setPeriod("");
    setError(null);
    onClose();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    // Clear the native value so re-choosing the same file fires onChange again.
    input.value = "";
    if (!file) return;

    const seq = ++uploadSeq.current;
    setUploading(true);
    setError(null);
    // A new file replaces the pending preview outright.
    setPreview(null);
    try {
      const parsed = await uploadContentPulseFile(file);
      if (uploadSeq.current !== seq) return;
      setPreview(parsed);
      setLabel("");
      setPeriod(parsed.dominantPeriod ?? "");
    } catch (err) {
      if (uploadSeq.current !== seq) return;
      setError(err instanceof ApiError ? err.message : "The upload failed. Try again.");
    } finally {
      if (uploadSeq.current === seq) setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!preview || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmContentPulseImport({
        token: preview.token,
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(period.trim() ? { period: period.trim() } : {}),
      });
      toast({
        title: "Import complete",
        description: `${formatNumber(result.newPosts)} new and ${formatNumber(result.updatedPosts)} updated posts from ${result.filename}.`,
        tone: "success",
      });
      handleClose();
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The import could not be confirmed.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import file"
      description="Upload a platform export, check the parsed preview, then confirm to record the snapshot."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            loading={confirming}
            disabled={!preview || uploading}
            onClick={() => void handleConfirm()}
          >
            Confirm import
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
          >
            {error}
          </p>
        )}

        <Input
          label="Export file"
          type="file"
          accept=".csv,.xlsx"
          disabled={uploading}
          onChange={(e) => void handleFileChange(e)}
          hint={
            uploading
              ? "Uploading and parsing the file…"
              : "Accepts .csv and .xlsx exports. Choosing a new file replaces the pending preview — nothing is imported until you confirm."
          }
        />

        {preview && (
          <div className="space-y-4">
            <StatRow
              stats={[
                { label: "Rows", value: formatNumber(preview.rowCount) },
                { label: "New posts", value: formatNumber(preview.newPosts) },
                { label: "Updated posts", value: formatNumber(preview.updatedPosts) },
                { label: "Detected period", value: preview.dominantPeriod ?? "—" },
              ]}
            />

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">
                Sample rows
                <span className="ml-2 font-mono text-xs font-normal text-ink-muted">
                  {preview.filename}
                </span>
              </p>
              <div className="overflow-x-auto rounded-xl border border-hairline">
                <table className="w-full min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-tile/60 text-xs font-medium uppercase tracking-wide text-ink-secondary">
                      <th scope="col" className="whitespace-nowrap px-3 py-2">Username</th>
                      <th scope="col" className="whitespace-nowrap px-3 py-2">Type</th>
                      <th scope="col" className="whitespace-nowrap px-3 py-2">Caption</th>
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-right">Views</th>
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-right">Likes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row) => (
                      <tr key={row.id} className="border-t border-hairline">
                        <td className="whitespace-nowrap px-3 py-2 text-ink">
                          {row.username ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-ink-secondary">
                          {row.postType ?? "—"}
                        </td>
                        <td
                          className="px-3 py-2 text-ink-secondary"
                          title={row.caption ?? undefined}
                        >
                          {row.caption ? truncate(row.caption, CAPTION_MAX) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink">
                          {formatCompact(row.views)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink">
                          {formatCompact(row.likes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Label"
                hint="Optional — shown on the imports list."
                placeholder="August weekly export"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <Input
                label="Period"
                hint="Prefilled with the file's dominant date period."
                placeholder="2026-08"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
