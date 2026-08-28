"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Link2, RefreshCw, TrendingUp, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { fetchReferralReport } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatNumber } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { ApplicationStatus, ReferralReport, Referrer } from "@/types/admin";

/** A leaderboard row: the referrer plus its position in the report's ranking. */
type RankedReferrer = Referrer & { rank: number };

const STATUS_BADGE: Record<ApplicationStatus, { tone: BadgeTone; label: string }> = {
  pending_verification: { tone: "warning", label: "Pending verification" },
  verified: { tone: "brand", label: "Verified" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "error", label: "Rejected" },
  revoked: { tone: "neutral", label: "Revoked" },
  withdrawn: { tone: "neutral", label: "Withdrawn" },
};

/** Keep the head and tail of a long token visible; the middle carries no meaning. */
function truncateToken(token: string): string {
  if (token.length <= 16) return token;
  return `${token.slice(0, 8)}…${token.slice(-6)}`;
}

export default function InviteLinksPage() {
  const [report, setReport] = useState<ReferralReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchReferralReport();
      setReport(data);
      setError(null);
    } catch (err) {
      setReport({ referrers: 0, referredSignups: 0, top: [] });
      setError(err instanceof ApiError ? err.message : "Could not load the referral report.");
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

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      toast({
        title: "Token copied",
        description: "The referral token is on your clipboard.",
        tone: "success",
      });
    } catch {
      toast({
        title: "Could not copy",
        description: "The browser blocked clipboard access.",
        tone: "error",
      });
    }
  }

  // Rank is assigned once from the report's order (highest referral count
  // first), so filtering the list never renumbers anyone.
  const rankedRows = useMemo<RankedReferrer[]>(
    () => (report === null ? [] : report.top.map((r, index) => ({ ...r, rank: index + 1 }))),
    [report]
  );

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rankedRows;
    return rankedRows.filter(
      (r) => r.fullName.toLowerCase().includes(query) || r.email.toLowerCase().includes(query)
    );
  }, [rankedRows, search]);

  const columns: Column<RankedReferrer>[] = [
    {
      key: "rank",
      header: "Rank",
      width: "w-16",
      sortValue: (r) => r.rank,
      render: (r) => <span className="text-ink-muted">#{r.rank}</span>,
    },
    {
      key: "referrer",
      header: "Referrer",
      sortValue: (r) => r.fullName,
      render: (r) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-ink">{r.fullName}</span>
          <span className="block text-xs text-ink-muted">{r.email}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Application status",
      render: (r) => {
        const badge = STATUS_BADGE[r.status];
        return (
          <Badge tone={badge.tone} dot>
            {badge.label}
          </Badge>
        );
      },
    },
    {
      key: "referralCount",
      header: "Referrals",
      align: "right",
      sortValue: (r) => r.referralCount,
      render: (r) => <span className="font-semibold">{formatNumber(r.referralCount)}</span>,
    },
    {
      key: "token",
      header: "Token",
      render: (r) => {
        const token = r.referralToken;
        if (token === null) return <span className="text-ink-muted">—</span>;
        return (
          <span className="inline-flex items-center gap-1">
            <code className="font-mono text-xs text-ink-secondary" title={token}>
              {truncateToken(token)}
            </code>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Copy ${r.fullName}'s referral token`}
              onClick={() => void copyToken(token)}
            >
              <Copy size={14} aria-hidden />
            </Button>
          </span>
        );
      },
    },
    {
      key: "submittedAt",
      header: "Joined",
      sortValue: (r) => r.submittedAt,
      render: (r) => formatDate(r.submittedAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invite Links"
        description="Every waitlist applicant gets a shareable referral token — each person who joins through it bumps the referrer's count and their place in the queue. This is the program's report."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden /> Refresh
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      {report === null ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {["referrers", "signups", "average"].map((key) => (
              <Card key={key} className="p-5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-3 h-8 w-16" />
              </Card>
            ))}
          </div>
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Active referrers"
              value={formatNumber(report.referrers)}
              icon={Users}
              hint="applicants with at least one referred signup"
            />
            <StatCard
              label="Referred signups"
              value={formatNumber(report.referredSignups)}
              icon={UserPlus}
              hint="people who joined through someone's link"
            />
            <StatCard
              label="Average per referrer"
              value={
                report.referrers === 0
                  ? "—"
                  : (report.referredSignups / report.referrers).toFixed(1)
              }
              icon={TrendingUp}
              hint="referred signups per active referrer"
            />
          </div>

          {report.top.length === 0 && !error ? (
            <Card className="p-6">
              <EmptyState
                icon={Link2}
                title="No referred signups yet"
                description="No one has referred a signup yet — every applicant's link starts counting the moment someone joins through it."
              />
            </Card>
          ) : (
            <>
              <div className="mb-4">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Filter referrers by name or email…"
                  className="w-full sm:w-80"
                />
              </div>

              <Card className="p-0">
                <CardHeader
                  title="Top referrers"
                  description="The applicants whose invite links have brought in the most signups, best first."
                />
                <DataTable
                  rows={visibleRows}
                  columns={columns}
                  rowKey={(r) => r.id}
                  pageSize={15}
                  emptyTitle="No matching referrers"
                  emptyDescription="No referrer's name or email matches that search."
                />
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
