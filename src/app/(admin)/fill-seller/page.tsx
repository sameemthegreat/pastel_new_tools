"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ClipboardPaste, Link2, RefreshCw, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import {
  getFillSellerStatus,
  importFillSellerDrafts,
  previewFillSellerUrl,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/stores/uiStore";
import type { FillSellerImportResult, FillSellerStatus, NormalizedDraft } from "@/types/admin";
import { DraftCard } from "./DraftCard";

const MAX_DRAFTS = 10;

/**
 * Each queued draft gets its own key, minted per fetch. Replacing a duplicate
 * mints a fresh key so the card remounts and its local price/quantity text
 * resets to the newly fetched values instead of keeping stale edits.
 */
type DraftEntry = { key: string; draft: NormalizedDraft };

/** Incrementing module counter — deterministic ids, no Math.random. */
let entryCounter = 0;

function nextEntryKey(): string {
  entryCounter += 1;
  return `draft-${entryCounter}`;
}

type UrlNote = { tone: "info" | "error"; message: string };

export default function FillSellerPage() {
  const [status, setStatus] = useState<FillSellerStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [urlNote, setUrlNote] = useState<UrlNote | null>(null);

  const [entries, setEntries] = useState<DraftEntry[]>([]);

  const [sellerEmail, setSellerEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [publish, setPublish] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<FillSellerImportResult | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getFillSellerStatus();
      setStatus(data);
      setStatusError(null);
    } catch (err) {
      setStatusError(
        err instanceof ApiError ? err.message : "Could not load the importer status."
      );
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

  async function handleFetch() {
    const target = url.trim();
    if (!target || fetching) return;
    setUrlNote(null);
    setFetching(true);
    try {
      const draft = await previewFillSellerUrl(target);
      const duplicateIndex = entries.findIndex(
        (e) => e.draft.sourceListingId === draft.sourceListingId
      );
      if (duplicateIndex >= 0) {
        const next = [...entries];
        next[duplicateIndex] = { key: nextEntryKey(), draft };
        setEntries(next);
        setUrl("");
        toast({
          title: "Draft replaced",
          description: `"${draft.title}" was already queued — refreshed with the latest fetch.`,
          tone: "info",
        });
      } else if (entries.length >= MAX_DRAFTS) {
        setUrlNote({
          tone: "error",
          message: `The batch already holds ${MAX_DRAFTS} drafts — the import cap. Import the batch or remove a draft, then fetch this listing again.`,
        });
      } else {
        setEntries([...entries, { key: nextEntryKey(), draft }]);
        setUrl("");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        // 501 means eBay import is deliberately switched off — an FYI, not a failure.
        setUrlNote({ tone: err.status === 501 ? "info" : "error", message: err.message });
      } else {
        setUrlNote({ tone: "error", message: "Could not fetch that listing. Try again." });
      }
    } finally {
      setFetching(false);
    }
  }

  async function handleImport() {
    const email = sellerEmail.trim();
    if (importing || !email || entries.length === 0) return;
    setEmailError(null);
    setImporting(true);
    try {
      const outcome = await importFillSellerDrafts({
        sellerEmail: email,
        drafts: entries.map((e) => e.draft),
        publish,
      });
      setResult(outcome);
      const createdTitles = new Set(outcome.created.map((row) => row.title));
      setEntries((prev) => prev.filter((e) => !createdTitles.has(e.draft.title)));
      toast({
        title: "Import finished",
        description: `${outcome.created.length} created, ${outcome.failed.length} failed`,
        tone:
          outcome.failed.length === 0
            ? "success"
            : outcome.created.length === 0
              ? "error"
              : "info",
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
        setEmailError(err.message);
      } else {
        toast({
          title: "Import failed",
          description:
            err instanceof ApiError ? err.message : "Could not import the drafts. Try again.",
          tone: "error",
        });
      }
    } finally {
      setImporting(false);
    }
  }

  function updateEntry(key: string, draft: NormalizedDraft) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, draft } : e)));
  }

  function removeEntry(key: string) {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  }

  const importDisabled = entries.length === 0 || sellerEmail.trim() === "";

  return (
    <>
      <PageHeader
        title="Fill Seller"
        description="Import listings from Etsy into a seller's shop — images are copied into Pastel storage on import."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden /> Refresh
          </Button>
        }
      />

      {statusError && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {statusError}
        </Card>
      )}

      {status === null && statusError === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : (
        <div className="space-y-4">
          {status !== null && !status.etsyConfigured && (
            <Card className="border-warning-500/40 bg-warning-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-warning-700">
                    Etsy import is not configured
                  </p>
                  <p className="mt-0.5 text-sm text-warning-700">
                    The backend is missing an ETSY_API_KEY, so fetching listings will fail until
                    it is set. You can still review this page and any drafts already queued.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {!status?.ebayEnabled && (
            <p className="text-xs text-ink-muted">
              eBay import is not enabled yet — it is waiting on the scraping-stack decision. Etsy
              listings are the only supported source for now.
            </p>
          )}

          <Card className="p-0">
            <CardHeader
              title="Add from URL"
              description="Paste an Etsy listing URL and Pastel normalizes it into an editable draft below."
            />
            <CardBody className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  label="Listing URL"
                  placeholder="https://www.etsy.com/listing/123456789/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleFetch();
                    }
                  }}
                />
                <Button
                  className="shrink-0"
                  loading={fetching}
                  disabled={url.trim() === ""}
                  onClick={() => void handleFetch()}
                >
                  <Link2 size={15} aria-hidden /> Fetch listing
                </Button>
              </div>
              {urlNote && (
                <p
                  role={urlNote.tone === "info" ? "status" : "alert"}
                  className={
                    urlNote.tone === "info"
                      ? "rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm font-medium text-brand-700"
                      : "rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
                  }
                >
                  {urlNote.message}
                </p>
              )}
            </CardBody>
          </Card>

          {entries.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                icon={ClipboardPaste}
                title="No drafts queued"
                description="Paste an Etsy listing URL above and fetch it — each listing becomes an editable draft here. Queue up to ten, then import the whole batch into the seller's shop."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink">
                Drafts ({entries.length}/{MAX_DRAFTS})
              </h2>
              {entries.map((entry) => (
                <DraftCard
                  key={entry.key}
                  draft={entry.draft}
                  onChange={(draft) => updateEntry(entry.key, draft)}
                  onRemove={() => removeEntry(entry.key)}
                />
              ))}
            </div>
          )}

          <Card className="p-0">
            <CardHeader
              title="Import"
              description="Create the queued drafts as listings in the seller's shop."
            />
            <CardBody className="space-y-4">
              <Input
                label="Seller email"
                type="email"
                placeholder="seller@example.com"
                value={sellerEmail}
                error={emailError ?? undefined}
                onChange={(e) => {
                  setSellerEmail(e.target.value);
                  setEmailError(null);
                }}
              />
              <div>
                <Switch checked={publish} onChange={setPublish} label="Publish immediately" />
                <p className="mt-1.5 text-xs text-ink-muted">
                  Off means the imported listings land in the seller&apos;s drafts for a final
                  review before going live.
                </p>
              </div>
              <Button loading={importing} disabled={importDisabled} onClick={() => void handleImport()}>
                <UploadCloud size={15} aria-hidden /> Import {entries.length}{" "}
                {entries.length === 1 ? "listing" : "listings"}
              </Button>

              {result && (
                <div className="space-y-2 border-t border-hairline pt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    Last import
                  </h3>
                  {result.created.map((row) => (
                    <div key={row.listingId} className="flex items-center gap-2 text-sm">
                      <Badge tone="success" dot>
                        Created
                      </Badge>
                      <span className="truncate text-ink">{row.title}</span>
                    </div>
                  ))}
                  {result.failed.map((row, index) => (
                    <div
                      key={`${row.title}-${index}`}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <Badge tone="error" dot>
                        Failed
                      </Badge>
                      <span className="truncate text-ink">{row.title}</span>
                      <span className="text-xs text-danger">{row.reason}</span>
                    </div>
                  ))}
                  {result.created.length === 0 && result.failed.length === 0 && (
                    <p className="text-sm text-ink-secondary">
                      The import returned no results.
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
