"use client";

import { useState } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { EmployeesTab } from "./EmployeesTab";
import { ImportDialog } from "./ImportDialog";
import { ImportsTab } from "./ImportsTab";
import { OverviewTab } from "./OverviewTab";
import { PostsTab } from "./PostsTab";

type TabKey = "overview" | "posts" | "imports" | "employees";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "posts", label: "Posts" },
  { key: "imports", label: "Imports" },
  { key: "employees", label: "Employees" },
];

/**
 * Content Pulse — social posting analytics built from platform export files.
 * Only the active tab is mounted, so switching tabs always shows fresh data;
 * `refreshKey` re-runs the mounted tab's loader after a manual refresh or a
 * confirmed import.
 */
export default function ContentPulsePage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <>
      <PageHeader
        title="Content Pulse"
        description="Social posting analytics from platform export files — import snapshots, attribute posts to teammates, and track engagement."
        actions={
          <>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw size={15} aria-hidden /> Refresh
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Upload size={15} aria-hidden /> Import file
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <Tabs tabs={TABS} active={tab} onChange={(key) => setTab(key as TabKey)} />
      </div>

      {tab === "overview" && (
        <OverviewTab refreshKey={refreshKey} onImportFile={() => setImportOpen(true)} />
      )}
      {tab === "posts" && <PostsTab refreshKey={refreshKey} />}
      {tab === "imports" && (
        <ImportsTab refreshKey={refreshKey} onImportFile={() => setImportOpen(true)} />
      )}
      {tab === "employees" && <EmployeesTab refreshKey={refreshKey} />}

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refresh}
      />
    </>
  );
}
