"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  listContentPulsePosts,
  listCpEmployees,
  setPostAttribution,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatCompact, formatDate, timeAgo } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { CpEmployee, CpMetricSnapshot, CpPost, PageMeta } from "@/types/admin";

/** Sentinel the backend accepts on `employeeId` to mean "no attribution". */
const UNASSIGNED_FILTER = "unassigned";

const CAPTION_MAX = 80;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** engagementRate is a ratio — 0.042 renders as "4.2%". */
function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function metricCell(post: CpPost, pick: (m: CpMetricSnapshot) => number): string {
  return post.latestMetrics ? formatCompact(pick(post.latestMetrics)) : "—";
}

/** Distinct post types seen so far, kept as a stable sorted union across loads. */
function mergeTypes(prev: string[], posts: CpPost[]): string[] {
  const next = new Set(prev);
  for (const post of posts) {
    if (post.type) next.add(post.type);
  }
  return next.size === prev.length ? prev : [...next].sort();
}

export function PostsTab({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<CpPost[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<CpEmployee[] | null>(null);
  const [seenTypes, setSeenTypes] = useState<string[]>([]);

  const [typeFilter, setTypeFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loadingMore, setLoadingMore] = useState(false);

  // Bumped on every fresh (non-append) request so stale responses are dropped.
  const requestSeq = useRef(0);

  // Debounce the search box so we query once typing pauses, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const typeParam = typeFilter === "all" ? undefined : typeFilter;
  const employeeParam =
    employeeFilter === "all"
      ? undefined
      : employeeFilter === "unassigned"
        ? UNASSIGNED_FILTER
        : employeeFilter;
  const searchParam = debouncedSearch.trim() || undefined;

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const page = await listContentPulsePosts({
        type: typeParam,
        employeeId: employeeParam,
        search: searchParam,
      });
      if (requestSeq.current !== seq) return;
      setItems(page.items);
      setMeta(page.meta);
      setError(null);
      setSeenTypes((prev) => mergeTypes(prev, page.items));
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setItems([]);
      setMeta(null);
      setError(err instanceof ApiError ? err.message : "Could not load posts.");
    }
  }, [typeParam, employeeParam, searchParam]);

  // Changing a filter or the (debounced) search starts the list over from page
  // one. Clearing during render (adjust-state-during-render, as DataTable does)
  // shows the skeleton on the very next paint; the effect below only reloads.
  const filterKey = `${typeParam ?? ""}|${employeeParam ?? ""}|${searchParam ?? ""}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setItems(null);
    setMeta(null);
    setError(null);
  }

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await load();
    };
    void run();
  }, [load, refreshKey]);

  useEffect(() => {
    // Employees feed the owner filter and the per-row attribution selects.
    // A failure here degrades quietly — the posts table still works.
    const run = async () => {
      try {
        const list = await listCpEmployees();
        setEmployees(list);
      } catch {
        setEmployees([]);
      }
    };
    void run();
  }, [refreshKey]);

  async function loadMore() {
    if (loadingMore || !meta?.hasNext || !meta.nextCursor) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await listContentPulsePosts({
        type: typeParam,
        employeeId: employeeParam,
        search: searchParam,
        cursor: meta.nextCursor,
      });
      if (requestSeq.current !== seq) return;
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setMeta(page.meta);
      setSeenTypes((prev) => mergeTypes(prev, page.items));
    } catch (err) {
      toast({
        title: "Could not load more posts",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  async function assignOwner(post: CpPost, value: string) {
    const nextId = value === "" ? null : value;
    const currentId = post.employee?.id ?? null;
    if (nextId === currentId) return;

    const match = nextId === null ? null : (employees ?? []).find((e) => e.id === nextId);
    const nextEmployee = match ? { id: match.id, name: match.name } : null;

    // Optimistic: swap the owner in place, and fall back to a reload on failure.
    setItems((prev) =>
      prev === null ? prev : prev.map((p) => (p.id === post.id ? { ...p, employee: nextEmployee } : p))
    );
    try {
      await setPostAttribution(post.id, nextId);
    } catch (err) {
      toast({
        title: "Could not update the owner",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
      await load();
    }
  }

  const activeEmployees = useMemo(
    () => (employees ?? []).filter((e) => e.active),
    [employees]
  );

  const typeOptions = useMemo(
    () => [{ value: "all", label: "All types" }, ...seenTypes.map((t) => ({ value: t, label: t }))],
    [seenTypes]
  );

  const employeeOptions = useMemo(
    () => [
      { value: "all", label: "All owners" },
      { value: "unassigned", label: "Unassigned" },
      ...activeEmployees.map((e) => ({ value: e.id, label: e.name })),
    ],
    [activeEmployees]
  );

  function ownerOptions(post: CpPost): { value: string; label: string }[] {
    const options = [
      { value: "", label: "Unassigned" },
      ...activeEmployees.map((e) => ({ value: e.id, label: e.name })),
    ];
    // Keep an inactive current owner selectable so the control shows the truth.
    if (post.employee && !activeEmployees.some((e) => e.id === post.employee!.id)) {
      options.push({ value: post.employee.id, label: post.employee.name });
    }
    return options;
  }

  const columns: Column<CpPost>[] = [
    {
      key: "publishTime",
      header: "Posted",
      sortValue: (p) => p.publishTime ?? "",
      render: (p) =>
        p.publishTime ? (
          <span className="block whitespace-nowrap">
            <span className="block text-ink">{formatDate(p.publishTime)}</span>
            <span className="block text-xs text-ink-muted">{timeAgo(p.publishTime)}</span>
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "type",
      header: "Type",
      sortValue: (p) => p.type ?? "",
      render: (p) => (p.type ? <Badge tone="neutral">{p.type}</Badge> : "—"),
    },
    {
      key: "username",
      header: "Username",
      sortValue: (p) => p.username ?? "",
      render: (p) =>
        p.username ? <span className="font-medium text-ink">{p.username}</span> : "—",
    },
    {
      key: "caption",
      header: "Caption",
      render: (p) =>
        p.caption ? (
          <span title={p.caption} className="block max-w-[24rem] text-ink-secondary">
            {truncate(p.caption, CAPTION_MAX)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "views",
      header: "Views",
      align: "right",
      sortValue: (p) => p.latestMetrics?.views ?? -1,
      render: (p) => metricCell(p, (m) => m.views),
    },
    {
      key: "likes",
      header: "Likes",
      align: "right",
      sortValue: (p) => p.latestMetrics?.likes ?? -1,
      render: (p) => metricCell(p, (m) => m.likes),
    },
    {
      key: "saves",
      header: "Saves",
      align: "right",
      sortValue: (p) => p.latestMetrics?.saves ?? -1,
      render: (p) => metricCell(p, (m) => m.saves),
    },
    {
      key: "comments",
      header: "Comments",
      align: "right",
      sortValue: (p) => p.latestMetrics?.comments ?? -1,
      render: (p) => metricCell(p, (m) => m.comments),
    },
    {
      key: "engagementRate",
      header: "Eng.",
      align: "right",
      sortValue: (p) => p.engagementRate,
      render: (p) => formatPercent(p.engagementRate),
    },
    {
      key: "owner",
      header: "Owner",
      render: (p) => (
        <div className="w-40">
          <Select
            value={p.employee?.id ?? ""}
            onChange={(v) => void assignOwner(p, v)}
            options={ownerOptions(p)}
          />
        </div>
      ),
    },
    {
      key: "permalink",
      header: "",
      align: "right",
      width: "w-12",
      render: (p) =>
        p.permalink ? (
          <a
            href={p.permalink}
            target="_blank"
            rel="noreferrer"
            aria-label="Open the post on its platform"
            className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-tile hover:text-ink"
          >
            <ExternalLink size={15} aria-hidden />
          </a>
        ) : null,
    },
  ];

  return (
    <>
      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search caption or username…"
          className="w-full sm:w-80"
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          options={typeOptions}
          className="w-full sm:w-44"
        />
        <Select
          value={employeeFilter}
          onChange={setEmployeeFilter}
          options={employeeOptions}
          className="w-full sm:w-48"
        />
      </div>

      {items === null ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : items.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={Megaphone}
            title="No posts found"
            description="No imported posts match the current type, owner, and search filters. Try different terms, or import a newer export file."
          />
        </Card>
      ) : (
        <Card className="p-0">
          <DataTable
            rows={items}
            columns={columns}
            rowKey={(p) => p.id}
            pageSize={200}
            emptyTitle="No posts to show"
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
        </Card>
      )}
    </>
  );
}
