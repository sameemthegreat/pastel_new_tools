"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Download,
  Inbox,
  Pin,
  RefreshCw,
  Sparkles,
  TicketPercent,
  Trash2,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Avatar } from "@/components/ui/Avatar";
import { DonutChart } from "@/components/charts/DonutChart";
import { LineChart } from "@/components/charts/LineChart";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import {
  CATEGORY_SPLIT,
  RANGE_OPTIONS,
  kpisForRange,
  trendForRange,
  trendLabels,
} from "@/data/dashboard";
import { useDashboardStore } from "@/stores/dashboardStore";
import type { ActivityEvent, ActivityType, RangeKey } from "@/types/dashboard";

const ATTENTION_TILE: Record<string, string> = {
  warning: "bg-warning-50 text-warning-700",
  error: "bg-error-50 text-error-700",
  brand: "bg-brand-50 text-brand-600",
};

const ATTENTION_BADGE: Record<string, BadgeTone> = {
  warning: "warning",
  error: "error",
  brand: "brand",
};

const ACTIVITY_TONE: Record<ActivityType, BadgeTone> = {
  approval: "success",
  rejection: "error",
  moderation: "warning",
  dispute: "error",
  discount: "brand",
  curation: "gold",
  import: "brand",
  email: "neutral",
  system: "forest",
};

const QUICK_ACTIONS: {
  label: string;
  caption: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { label: "Review waitlist", caption: "23 pending", href: "/requests", icon: Inbox },
  { label: "Moderate users", caption: "4 open appeals", href: "/users", icon: Users },
  { label: "New discount", caption: "Promo codes", href: "/discounts", icon: TicketPercent },
  { label: "Curate home", caption: "22 categories", href: "/curation", icon: Pin },
  { label: "Import posts", caption: "Content Pulse", href: "/content-pulse", icon: BarChart3 },
  { label: "View analytics", caption: "Web funnel", href: "/analytics", icon: TrendingUp },
];

const ACTIVITY_PREVIEW_COUNT = 8;

export default function DashboardPage() {
  const router = useRouter();

  const range = useDashboardStore((s) => s.range);
  const setRange = useDashboardStore((s) => s.setRange);
  const attention = useDashboardStore((s) => s.attention);
  const activity = useDashboardStore((s) => s.activity);
  const refreshing = useDashboardStore((s) => s.refreshing);
  const exporting = useDashboardStore((s) => s.exporting);
  const refresh = useDashboardStore((s) => s.refresh);
  const dismissAttention = useDashboardStore((s) => s.dismissAttention);
  const restoreAttention = useDashboardStore((s) => s.restoreAttention);
  const clearActivity = useDashboardStore((s) => s.clearActivity);
  const exportReport = useDashboardStore((s) => s.exportReport);

  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportRange, setExportRange] = React.useState<RangeKey>(range);
  const [exportSections, setExportSections] = React.useState({
    kpis: true,
    charts: true,
    activity: false,
  });
  const [exportError, setExportError] = React.useState("");

  const [clearOpen, setClearOpen] = React.useState(false);
  const [showAllActivity, setShowAllActivity] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<ActivityEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const kpis = React.useMemo(() => kpisForRange(range), [range]);
  const trend = React.useMemo(() => trendForRange(range), [range]);
  const labels = React.useMemo(() => trendLabels(range), [range]);
  const rangeLabel =
    RANGE_OPTIONS.find((r) => r.key === range)?.label ?? "Last 30 days";

  const totalVisits = trend.reduce((sum, p) => sum + p.visits, 0);
  const totalSignups = trend.reduce((sum, p) => sum + p.signups, 0);

  const visibleActivity = showAllActivity
    ? activity
    : activity.slice(0, ACTIVITY_PREVIEW_COUNT);

  const openExport = () => {
    setExportRange(range);
    setExportError("");
    setExportOpen(true);
  };

  const submitExport = () => {
    const sections = Object.entries(exportSections)
      .filter(([, on]) => on)
      .map(([key]) => key);
    if (sections.length === 0) {
      setExportError("Select at least one section to include in the report.");
      return;
    }
    setExportError("");
    exportReport(sections, exportRange, () => setExportOpen(false));
  };

  const openEvent = (event: ActivityEvent) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Marketplace health, growth, and open queues at a glance."
        actions={
          <>
            <Button
              variant="outline"
              icon={RefreshCw}
              loading={refreshing}
              onClick={refresh}
            >
              Refresh
            </Button>
            <Button icon={Download} onClick={openExport}>
              Export report
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <Tabs
          tabs={RANGE_OPTIONS.map((r) => ({ key: r.key, label: r.label }))}
          active={range}
          onChange={(key) => setRange(key as RangeKey)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            hint={kpi.hint}
            icon={kpi.icon}
            spark={kpi.spark}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Traffic & signups"
            description={`${formatNumber(totalVisits)} visits · ${formatNumber(totalSignups)} signups — ${rangeLabel.toLowerCase()}`}
          />
          <CardBody>
            <LineChart
              series={[
                { name: "Visits", data: trend.map((p) => p.visits) },
                {
                  name: "Signups",
                  data: trend.map((p) => p.signups),
                  color: "var(--color-forest)",
                },
              ]}
              labels={labels}
              height={240}
              formatValue={formatNumber}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Listings by category"
            description="Live listings across the marketplace"
          />
          <CardBody>
            <DonutChart data={CATEGORY_SPLIT} size={176} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Needs attention"
            description="Open queues across modules"
            actions={
              attention.length < 5 ? (
                <Button variant="ghost" size="sm" onClick={restoreAttention}>
                  Restore
                </Button>
              ) : undefined
            }
          />
          {attention.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={CheckCircle2}
                title="All caught up"
                description="No queues need your attention right now."
                action={
                  <Button variant="outline" size="sm" onClick={restoreAttention}>
                    Restore queues
                  </Button>
                }
              />
            </CardBody>
          ) : (
            <div className="divide-y divide-hairline">
              {attention.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 px-5 py-3.5"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl",
                      ATTENTION_TILE[item.tone],
                    )}
                  >
                    <item.icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={item.href}
                      className="block truncate text-sm font-medium text-ink hover:text-brand-600"
                    >
                      {item.label}
                    </Link>
                    <p className="truncate text-xs text-ink-muted">
                      {item.description}
                    </p>
                  </div>
                  <Badge tone={ATTENTION_BADGE[item.tone]}>
                    {formatNumber(item.count)}
                  </Badge>
                  <Link
                    href={item.href}
                    aria-label={`Open ${item.label}`}
                    className="text-ink-muted transition-colors hover:text-brand-600"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    aria-label={`Hide ${item.label} from overview`}
                    onClick={() => dismissAttention(item.id)}
                    className="rounded-md p-1 text-ink-muted opacity-0 transition-opacity hover:bg-tile hover:text-ink group-hover:opacity-100"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Recent activity"
            description="Latest admin events across the console"
            actions={
              activity.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setClearOpen(true)}
                >
                  Clear
                </Button>
              ) : undefined
            }
          />
          {activity.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={Sparkles}
                title="No recent activity"
                description="Admin events will appear here as your team works the queues."
              />
            </CardBody>
          ) : (
            <>
              <div className="divide-y divide-hairline">
                {visibleActivity.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openEvent(event)}
                    className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-cream/50"
                  >
                    <Avatar name={event.actor} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-ink">
                        <span className="font-medium">{event.actor}</span>{" "}
                        <span className="text-ink-secondary">{event.action}</span>{" "}
                        <span className="font-medium">{event.target}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {event.module} · {timeAgo(event.at)}
                      </p>
                    </div>
                    <ChevronRight
                      size={14}
                      className="mt-1 shrink-0 text-ink-muted"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              {activity.length > ACTIVITY_PREVIEW_COUNT && (
                <div className="border-t border-hairline px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setShowAllActivity((v) => !v)}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    {showAllActivity
                      ? "Show less"
                      : `Show all (${activity.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-base font-semibold tracking-tight text-ink">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="group rounded-2xl border border-hairline bg-surface p-4 shadow-xs transition-all hover:border-tileborder hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <action.icon size={18} aria-hidden="true" />
                </span>
                <ArrowUpRight
                  size={16}
                  className="text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 text-sm font-medium text-ink">{action.label}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{action.caption}</p>
            </Link>
          ))}
        </div>
      </div>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export report"
        description="Build a snapshot of the overview for sharing outside the console."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button icon={Download} loading={exporting} onClick={submitExport}>
              Export
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Select
            label="Date range"
            value={exportRange}
            onChange={(v) => setExportRange(v as RangeKey)}
            options={RANGE_OPTIONS.map((r) => ({ value: r.key, label: r.label }))}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Sections</p>
            <div className="space-y-3">
              <Switch
                checked={exportSections.kpis}
                onChange={(v) =>
                  setExportSections((s) => ({ ...s, kpis: v }))
                }
                label="KPI summary"
              />
              <Switch
                checked={exportSections.charts}
                onChange={(v) =>
                  setExportSections((s) => ({ ...s, charts: v }))
                }
                label="Traffic & category charts"
              />
              <Switch
                checked={exportSections.activity}
                onChange={(v) =>
                  setExportSections((s) => ({ ...s, activity: v }))
                }
                label="Activity log"
              />
            </div>
          </div>
          {exportError && (
            <p className="text-sm text-error-600">{exportError}</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          clearActivity();
          setClearOpen(false);
        }}
        title="Clear activity feed?"
        message="This clears the overview feed only — every event remains in its module's own audit log."
        confirmLabel="Clear feed"
        tone="danger"
      />

      <Drawer
        open={drawerOpen && selectedEvent !== null}
        onClose={() => setDrawerOpen(false)}
        title="Activity detail"
        description={selectedEvent ? timeAgo(selectedEvent.at) : undefined}
        footer={
          selectedEvent ? (
            <>
              <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                Close
              </Button>
              <Button
                icon={ArrowUpRight}
                onClick={() => {
                  setDrawerOpen(false);
                  router.push(selectedEvent.href);
                }}
              >
                Open {selectedEvent.module}
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedEvent && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Avatar name={selectedEvent.actor} size="lg" />
              <div>
                <p className="text-sm font-semibold text-ink">
                  {selectedEvent.actor}
                </p>
                <p className="text-xs text-ink-muted">
                  {formatDateTime(selectedEvent.at)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={ACTIVITY_TONE[selectedEvent.type]} dot>
                {selectedEvent.type}
              </Badge>
              <Badge tone="neutral">{selectedEvent.module}</Badge>
            </div>

            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Action
                </dt>
                <dd className="mt-1 text-sm text-ink">{selectedEvent.action}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Target
                </dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {selectedEvent.target}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Detail
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink-secondary">
                  {selectedEvent.detail}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Drawer>
    </div>
  );
}
