"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarPlus,
  ClipboardList,
  Hourglass,
  Inbox,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import {
  completeDeletionRequest,
  getApplicationStats,
  listApplications,
  listDeletionRequests,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatNumber } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type {
  DeletionRequest,
  PageMeta,
  SellerApplication,
  SellerApplicationStats,
} from "@/types/admin";
import { ApplicationStatusBadge, ApplicationDrawer, crmStatusLabel } from "./ApplicationDrawer";

type TabKey =
  | "all"
  | "pending_verification"
  | "verified"
  | "approved"
  | "rejected"
  | "deletion";

type ApplicationTab = Exclude<TabKey, "deletion">;

const APP_EMPTY: Record<ApplicationTab, { title: string; description: string }> = {
  all: {
    title: "The waitlist is empty",
    description:
      "Seller applications appear here the moment someone joins the waitlist — with their queue position, verification state, and pipeline stage.",
  },
  pending_verification: {
    title: "No unverified applications",
    description:
      "Everyone currently on the waitlist has confirmed their email address. New signups sit here until they click the verification link.",
  },
  verified: {
    title: "Nothing ready to approve",
    description:
      "Applicants land here once they confirm their email — that is the moment an application becomes approvable.",
  },
  approved: {
    title: "No approved applications",
    description:
      "Applications you approve stay listed here as the record of who came off the waitlist and when.",
  },
  rejected: {
    title: "No rejected applications",
    description:
      "Applications you turn down are kept here together with the decision note, so the reasoning is never lost.",
  },
};

export default function RequestsPage() {
  const [tab, setTab] = useState<TabKey>("all");

  const [stats, setStats] = useState<SellerApplicationStats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);

  const [apps, setApps] = useState<SellerApplication[] | null>(null);
  const [appsMeta, setAppsMeta] = useState<PageMeta | null>(null);

  const [deletions, setDeletions] = useState<DeletionRequest[] | null>(null);
  const [deletionsMeta, setDeletionsMeta] = useState<PageMeta | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);

  // "Mark completed" flow for a pending deletion request.
  const [completing, setCompleting] = useState<DeletionRequest | null>(null);
  const [resolution, setResolution] = useState("");
  const [completeSaving, setCompleteSaving] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Bumped on every fresh (non-append) request so stale responses are dropped.
  const requestSeq = useRef(0);

  const statusParam = tab === "all" || tab === "deletion" ? undefined : tab;

  const loadStats = useCallback(async () => {
    try {
      const next = await getApplicationStats();
      setStats(next);
      setStatsFailed(false);
    } catch {
      // The stat cards degrade to em dashes; the list error card covers the rest.
      setStatsFailed(true);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const page = await listApplications({ status: statusParam });
      if (requestSeq.current !== seq) return;
      setApps(page.items);
      setAppsMeta(page.meta);
      setError(null);
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setApps([]);
      setAppsMeta(null);
      setError(err instanceof ApiError ? err.message : "Could not load seller applications.");
    }
  }, [statusParam]);

  const loadDeletions = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const page = await listDeletionRequests({});
      if (requestSeq.current !== seq) return;
      setDeletions(page.items);
      setDeletionsMeta(page.meta);
      setError(null);
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setDeletions([]);
      setDeletionsMeta(null);
      setError(err instanceof ApiError ? err.message : "Could not load deletion requests.");
    }
  }, []);

  // Switching tab starts the visible list over from page one. Clearing during
  // render (adjust-state-during-render, as DataTable does) shows the skeleton
  // on the very next paint instead of one frame later.
  const [prevTab, setPrevTab] = useState<TabKey>(tab);
  if (prevTab !== tab) {
    setPrevTab(tab);
    setError(null);
    if (tab === "deletion") {
      setDeletions(null);
      setDeletionsMeta(null);
    } else {
      setApps(null);
      setAppsMeta(null);
    }
  }

  // The loaders only touch state after their awaits; awaiting them from an
  // inline async function keeps the effect bodies themselves free of setState.
  useEffect(() => {
    const run = async () => {
      await loadStats();
    };
    void run();
  }, [loadStats]);

  useEffect(() => {
    const run = async () => {
      if (tab === "deletion") {
        await loadDeletions();
      } else {
        await loadApplications();
      }
    };
    void run();
  }, [tab, loadApplications, loadDeletions]);

  function refresh() {
    void loadStats();
    if (tab === "deletion") {
      void loadDeletions();
    } else {
      void loadApplications();
    }
  }

  async function loadMoreApplications() {
    if (loadingMore || !appsMeta?.hasNext || !appsMeta.nextCursor) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await listApplications({ status: statusParam, cursor: appsMeta.nextCursor });
      if (requestSeq.current !== seq) return;
      setApps((prev) => [...(prev ?? []), ...page.items]);
      setAppsMeta(page.meta);
    } catch (err) {
      toast({
        title: "Could not load more applications",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadMoreDeletions() {
    if (loadingMore || !deletionsMeta?.hasNext || !deletionsMeta.nextCursor) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await listDeletionRequests({ cursor: deletionsMeta.nextCursor });
      if (requestSeq.current !== seq) return;
      setDeletions((prev) => [...(prev ?? []), ...page.items]);
      setDeletionsMeta(page.meta);
    } catch (err) {
      toast({
        title: "Could not load more requests",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  function openComplete(request: DeletionRequest) {
    setCompleting(request);
    setResolution("");
    setCompleteError(null);
  }

  async function handleComplete() {
    if (!completing || completeSaving) return;
    setCompleteSaving(true);
    setCompleteError(null);
    try {
      await completeDeletionRequest(completing.id, resolution.trim() || undefined);
      toast({
        title: "Deletion request completed",
        description: completing.email,
        tone: "success",
      });
      setCompleting(null);
      await loadDeletions();
    } catch (err) {
      setCompleteError(
        err instanceof ApiError ? err.message : "Could not complete the request."
      );
    } finally {
      setCompleteSaving(false);
    }
  }

  const applicationColumns: Column<SellerApplication>[] = [
    {
      key: "fullName",
      header: "Name",
      sortValue: (a) => a.fullName,
      render: (a) => (
        <span className="block">
          <span className="block font-semibold text-ink">{a.fullName}</span>
          <span className="block text-xs text-ink-muted">{a.email}</span>
        </span>
      ),
    },
    {
      key: "priority",
      header: "Queue #",
      align: "right",
      width: "w-24",
      sortValue: (a) => a.priority,
      render: (a) => formatNumber(a.priority),
    },
    {
      key: "status",
      header: "Status",
      width: "w-44",
      sortValue: (a) => a.status,
      render: (a) => <ApplicationStatusBadge status={a.status} />,
    },
    {
      key: "crmStatus",
      header: "CRM",
      width: "w-40",
      render: (a) =>
        a.crmStatus ? <Badge tone="neutral">{crmStatusLabel(a.crmStatus)}</Badge> : "—",
    },
    {
      key: "referralCount",
      header: "Referrals",
      align: "right",
      width: "w-24",
      sortValue: (a) => a.referralCount,
      render: (a) => formatNumber(a.referralCount),
    },
    {
      key: "submittedAt",
      header: "Submitted",
      width: "w-36",
      sortValue: (a) => a.submittedAt,
      render: (a) => <span className="text-ink-secondary">{formatDate(a.submittedAt)}</span>,
    },
  ];

  const deletionColumns: Column<DeletionRequest>[] = [
    {
      key: "email",
      header: "Email",
      sortValue: (r) => r.email,
      render: (r) => <span className="font-semibold text-ink">{r.email}</span>,
    },
    {
      key: "userType",
      header: "Type",
      width: "w-32",
      render: (r) => <span className="capitalize text-ink-secondary">{r.userType ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "w-36",
      sortValue: (r) => r.status,
      render: (r) =>
        r.status === "pending" ? (
          <Badge tone="warning" dot>
            Pending
          </Badge>
        ) : (
          <Badge tone="success" dot>
            Completed
          </Badge>
        ),
    },
    {
      key: "requestedAt",
      header: "Requested",
      width: "w-36",
      sortValue: (r) => r.requestedAt,
      render: (r) => <span className="text-ink-secondary">{formatDate(r.requestedAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-40",
      render: (r) =>
        r.status === "pending" ? (
          <Button variant="outline" size="sm" onClick={() => openComplete(r)}>
            Mark completed
          </Button>
        ) : null,
    },
  ];

  const statCards = [
    { label: "Total applications", value: stats?.total, icon: Inbox },
    { label: "Ready to approve", value: stats?.byStatus.verified ?? 0, icon: BadgeCheck },
    {
      label: "Awaiting verification",
      value: stats?.byStatus.pending_verification ?? 0,
      icon: Hourglass,
    },
    { label: "New this week", value: stats?.last7Days, icon: CalendarPlus },
  ];

  const tabs = [
    { key: "all", label: "All", count: stats?.total },
    {
      key: "pending_verification",
      label: "Pending verification",
      count: stats ? stats.byStatus.pending_verification ?? 0 : undefined,
    },
    { key: "verified", label: "Verified", count: stats ? stats.byStatus.verified ?? 0 : undefined },
    { key: "approved", label: "Approved", count: stats ? stats.byStatus.approved ?? 0 : undefined },
    { key: "rejected", label: "Rejected", count: stats ? stats.byStatus.rejected ?? 0 : undefined },
    { key: "deletion", label: "Deletion requests" },
  ];

  const appEmpty = tab === "deletion" ? APP_EMPTY.all : APP_EMPTY[tab];

  return (
    <>
      <PageHeader
        title="Requests"
        description="The seller waitlist — every application, its verification state, and your pipeline — plus GDPR deletion requests."
        actions={
          <Button variant="outline" onClick={refresh}>
            <RefreshCw size={15} aria-hidden /> Refresh
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats === null && !statsFailed
          ? statCards.map((card) => (
              <Card key={card.label} className="p-5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-3 h-8 w-16" />
              </Card>
            ))
          : statCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value === undefined ? "—" : formatNumber(card.value)}
                icon={card.icon}
              />
            ))}
      </div>

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      <div className="mb-4">
        <Tabs tabs={tabs} active={tab} onChange={(key) => setTab(key as TabKey)} />
      </div>

      {tab !== "deletion" ? (
        apps === null ? (
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ) : apps.length === 0 && !error ? (
          <Card className="p-6">
            <EmptyState
              icon={ClipboardList}
              title={appEmpty.title}
              description={appEmpty.description}
            />
          </Card>
        ) : (
          <Card className="p-0">
            <DataTable
              rows={apps}
              columns={applicationColumns}
              rowKey={(a) => a.id}
              onRowClick={(a) => setOpenId(a.id)}
              pageSize={200}
              emptyTitle="No applications to show"
              footer={
                appsMeta?.hasNext ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={loadingMore}
                    onClick={() => void loadMoreApplications()}
                  >
                    Load more
                  </Button>
                ) : undefined
              }
            />
          </Card>
        )
      ) : deletions === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : deletions.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={ShieldCheck}
            title="No deletion requests"
            description="GDPR and CCPA erasure requests land here so you can confirm the data purge and close them out with a resolution note."
          />
        </Card>
      ) : (
        <Card className="p-0">
          <DataTable
            rows={deletions}
            columns={deletionColumns}
            rowKey={(r) => r.id}
            pageSize={200}
            emptyTitle="No deletion requests to show"
            footer={
              deletionsMeta?.hasNext ? (
                <Button
                  variant="outline"
                  size="sm"
                  loading={loadingMore}
                  onClick={() => void loadMoreDeletions()}
                >
                  Load more
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      <Modal
        open={completing !== null}
        onClose={() => setCompleting(null)}
        title="Mark deletion request completed"
        description={
          completing
            ? `Confirms that all personal data tied to ${completing.email} has been erased.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button loading={completeSaving} onClick={() => void handleComplete()}>
              Mark completed
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {completeError && (
            <p
              role="alert"
              className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
            >
              {completeError}
            </p>
          )}
          <Textarea
            label="Resolution (optional)"
            rows={3}
            placeholder="e.g. Account anonymized, waitlist entry purged, backups scheduled for rotation…"
            hint="Stored on the request as the compliance trail."
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
        </div>
      </Modal>

      <ApplicationDrawer
        applicationId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => {
          void loadStats();
          if (tab !== "deletion") void loadApplications();
        }}
      />
    </>
  );
}
