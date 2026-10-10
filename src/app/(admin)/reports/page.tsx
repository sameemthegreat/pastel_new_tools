"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flag, ImageIcon, Link2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { listReports } from "@/lib/api/admin";
import { getListingsBatch } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { humanizeToken, timeAgo } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { AdminContentReport, PageMeta } from "@/types/admin";
import type { PublicListing } from "@/types/catalog";
import { ReportDrawer, reportReasonLabel, reportStatusMeta } from "./ReportDrawer";

const TABS = [
  { key: "open", label: "Open" },
  { key: "dmca", label: "DMCA" },
  { key: "actioned", label: "Actioned" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

/** List filters per tab. DMCA is the open takedown notices — they carry a legal response clock. */
const TAB_FILTER: Record<string, { status?: string; isDmca?: "true" }> = {
  open: { status: "open" },
  dmca: { status: "open", isDmca: "true" },
  actioned: { status: "actioned" },
  dismissed: { status: "dismissed" },
  all: {},
};

/** Reported listings by id: missing = still looking up, `null` = removed or no longer public. */
type ListingLookup = Record<string, PublicListing | null>;

/**
 * The reported listings for a page of reports, in one batch call. The batch silently omits removed
 * ids, so anything asked for but not returned is recorded as gone. A failed lookup only costs the
 * titles — the rows still render with the listing id.
 */
async function lookUpListings(reports: AdminContentReport[]): Promise<ListingLookup> {
  const ids = reports.filter((r) => r.contentType === "listing").map((r) => r.contentId);
  try {
    const found = await getListingsBatch(ids);
    const lookup: ListingLookup = Object.fromEntries(ids.map((id) => [id, null]));
    for (const listing of found) lookup[listing.id] = listing;
    return lookup;
  } catch {
    return {};
  }
}

function buildColumns(listings: ListingLookup): Column<AdminContentReport>[] {
  return [
    {
      key: "listing",
      header: "Reported listing",
      render: (r) => {
        const listing = listings[r.contentId];
        const cover = listing?.images.find((image) => image.url)?.url ?? null;
        return (
          <div className="flex min-w-0 items-center gap-3">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- CDN image of an arbitrary listing; no optimizer config for its host
              <img
                src={cover}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg border border-hairline object-cover"
              />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-lg border border-hairline bg-tile" />
            )}
            <div className="min-w-0">
              {listing === undefined ? (
                <p className="max-w-56 truncate font-mono text-xs text-ink-secondary" title={r.contentId}>
                  {r.contentId}
                </p>
              ) : (
                <p
                  className={
                    listing
                      ? "max-w-56 truncate font-semibold text-ink"
                      : "max-w-56 truncate font-medium text-ink-muted"
                  }
                  title={listing?.title}
                >
                  {listing ? listing.title : "Removed listing"}
                </p>
              )}
              <p className="mt-0.5 text-xs text-ink-muted">{timeAgo(r.createdAt)}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "reason",
      header: "Reason",
      sortValue: (r) => r.reason,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="block max-w-56 truncate text-ink-secondary">
            {reportReasonLabel(r.reason)}
          </span>
          {r.isDmca && <Badge tone="error">DMCA</Badge>}
        </div>
      ),
    },
    {
      key: "evidence",
      header: "Evidence",
      sortValue: (r) => r.evidenceType ?? "",
      render: (r) =>
        r.evidenceType === "screenshot" ? (
          <span className="inline-flex items-center gap-1.5 text-ink-secondary">
            <ImageIcon size={14} aria-hidden /> Screenshot
          </span>
        ) : r.evidenceType === "link" || r.sourceUrl ? (
          <span className="inline-flex items-center gap-1.5 text-ink-secondary">
            <Link2 size={14} aria-hidden /> Link
          </span>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: "reporter",
      header: "Reporter",
      sortValue: (r) => r.reporterEmail ?? "",
      render: (r) =>
        r.reporterEmail ? (
          <span className="block max-w-52 truncate text-ink-secondary" title={r.reporterEmail}>
            {r.reporterEmail}
          </span>
        ) : (
          <span className="text-ink-muted">
            {r.reporterUserId ? "Signed-in user" : "Anonymous"}
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => (
        <Badge tone={reportStatusMeta(r.status).tone} dot>
          {reportStatusMeta(r.status).label}
        </Badge>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortValue: (r) => r.contentType,
      render: (r) => <Badge tone="neutral">{humanizeToken(r.contentType)}</Badge>,
    },
  ];
}

export default function ReportsPage() {
  const [tab, setTab] = useState("open");
  const [reports, setReports] = useState<AdminContentReport[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [listings, setListings] = useState<ListingLookup>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<AdminContentReport | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await listReports(TAB_FILTER[tab]);
      setReports(page.items);
      setMeta(page.meta);
      setError(null);
      // Keep an open drawer on the freshest copy — it carries a newly minted evidence link.
      setSelected((prev) => (prev ? (page.items.find((r) => r.id === prev.id) ?? prev) : null));
      const found = await lookUpListings(page.items);
      setListings((prev) => ({ ...prev, ...found }));
    } catch (err) {
      setReports([]);
      setMeta(null);
      setError(err instanceof ApiError ? err.message : "Could not load reports.");
    }
  }, [tab]);

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  function changeTab(key: string) {
    if (key === tab) return;
    setTab(key);
    // Back to the skeleton while the new tab's first page loads; cursor resets with it.
    setReports(null);
    setMeta(null);
    setError(null);
  }

  const loadMore = useCallback(async () => {
    if (loadingMore || !meta?.hasNext || !meta.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await listReports({ ...TAB_FILTER[tab], cursor: meta.nextCursor });
      setReports((prev) => [...(prev ?? []), ...page.items]);
      setMeta(page.meta);
      const found = await lookUpListings(page.items);
      setListings((prev) => ({ ...prev, ...found }));
    } catch (err) {
      toast({
        title: "Could not load more reports",
        description: err instanceof ApiError ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, meta, tab]);

  const columns = useMemo(() => buildColumns(listings), [listings]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Listings reported by buyers and visitors. Review the evidence, act on the listing or seller if needed, then record a decision."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden /> Refresh
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs tabs={TABS} active={tab} onChange={changeTab} />
      </div>

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      {reports === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : reports.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={Flag}
            title="No reports here"
            description={
              tab === "open" || tab === "dmca"
                ? "Nothing is waiting for review. New reports appear here the moment they are filed."
                : "Nothing matches this status right now. Check the other tabs or refresh."
            }
          />
        </Card>
      ) : (
        <DataTable
          rows={reports}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelected(r)}
          pageSize={200}
          emptyTitle="No reports"
          footer={
            meta?.hasNext ? (
              <Button
                variant="outline"
                size="sm"
                loading={loadingMore}
                onClick={() => void loadMore()}
              >
                Load more
              </Button>
            ) : undefined
          }
        />
      )}

      <ReportDrawer
        report={selected}
        listing={selected ? listings[selected.contentId] : undefined}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </>
  );
}
