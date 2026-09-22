"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { getRunLogs } from "@/lib/api/migration";
import { ApiError } from "@/lib/api/client";
import type {
  MigrationLogLine,
  MigrationRunStatus,
} from "@/types/migration";

const POLL_MS = 1500;
const TERMINAL: MigrationRunStatus[] = ["succeeded", "failed", "interrupted"];

const STATUS_TONE = {
  running: "brand",
  succeeded: "success",
  failed: "error",
  interrupted: "warning",
} as const;

/**
 * Streams a run's output by POLLING /runs/{id}/logs?after=<seq> (auth needs a Bearer
 * header the proxy attaches, which EventSource can't do). Stops once the run is terminal,
 * and reports the final status up so the parent can refresh history/reconcile.
 */
export function LogViewer({
  runId,
  onStatusChange,
}: {
  runId: string;
  onStatusChange?: (status: MigrationRunStatus) => void;
}) {
  const [lines, setLines] = useState<MigrationLogLine[]>([]);
  const [status, setStatus] = useState<MigrationRunStatus>("running");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let after = 0;
    let lastStatus: MigrationRunStatus | null = null;
    setLines([]);
    setStatus("running");
    setError(null);

    const tick = async () => {
      try {
        const res = await getRunLogs(runId, after);
        if (cancelled) return;
        if (res.lines.length) {
          after = res.nextSeq;
          setLines((prev) => [...prev, ...res.lines]);
        }
        setStatus(res.runStatus);
        if (res.runStatus !== lastStatus) {
          lastStatus = res.runStatus;
          onStatusChange?.(res.runStatus);
        }
        if (TERMINAL.includes(res.runStatus)) return; // stop polling
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load logs.");
      }
      timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId, onStatusChange]);

  // Keep the view pinned to the newest line unless the operator scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Live output</span>
        <Badge tone={STATUS_TONE[status]} dot>
          {status}
        </Badge>
      </div>
      {error && (
        <p className="mb-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="h-80 overflow-auto rounded-xl bg-ink/95 p-3 font-mono text-xs leading-relaxed text-white/90"
      >
        {lines.length === 0 ? (
          <span className="text-white/40">Waiting for output…</span>
        ) : (
          lines.map((l) => (
            <div key={l.seq} className={l.stream === "stderr" ? "text-error-300" : undefined}>
              {l.line || " "}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
