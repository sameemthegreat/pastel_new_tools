import { ApiError, envelopeFetch, type RequestOptions } from "@/lib/api/client";
import { refreshAccessToken } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";
import type {
  MigrationLogsResponse,
  MigrationMapStat,
  MigrationRun,
  MigrationStage,
  ReconcileRow,
  TriggerRunInput,
} from "@/types/migration";

/**
 * Migration control-plane calls. Same shape as `admin.ts` but same-origin through the
 * `/api/migration/*` proxy (which attaches `X-Operator-Secret` server-side). The 401→refresh
 * and 403→revalidate handling mirrors the admin client, so a mid-session token expiry or a
 * just-revoked operator behaves identically here.
 */

let refreshInFlight: Promise<string> | null = null;

function refreshOnce(): Promise<string> {
  refreshInFlight ??= (async () => {
    try {
      const { accessToken } = await refreshAccessToken();
      useAuthStore.setState({ accessToken });
      return accessToken;
    } catch (error) {
      useAuthStore.getState().endSession();
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: Omit<RequestOptions, "accessToken"> = {}
): Promise<{ value: T; meta: Record<string, unknown> }> {
  const token = useAuthStore.getState().accessToken;
  try {
    return await envelopeFetch<T>(`/api/migration${path}`, { ...options, accessToken: token ?? undefined });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const fresh = await refreshOnce();
      return envelopeFetch<T>(`/api/migration${path}`, { ...options, accessToken: fresh });
    }
    if (error instanceof ApiError && error.status === 403) {
      await useAuthStore.getState().revalidate();
    }
    throw error;
  }
}

async function migrationFetch<T>(
  path: string,
  options: Omit<RequestOptions, "accessToken"> = {}
): Promise<T> {
  const { value } = await request<T>(path, options);
  return value;
}

// ── Stages ──────────────────────────────────────────────────────────────────

/** The runnable stages plus the currently-active run id (meta) so the UI can lock buttons. */
export async function listStages(): Promise<{ stages: MigrationStage[]; activeRunId: string | null }> {
  const { value, meta } = await request<MigrationStage[]>("/stages");
  return { stages: value, activeRunId: (meta.activeRunId as string | null) ?? null };
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export function triggerRun(input: TriggerRunInput): Promise<MigrationRun> {
  return migrationFetch<MigrationRun>("/runs", { method: "POST", body: input });
}

export function listRuns(params: { stage?: string; status?: string; limit?: number } = {}): Promise<MigrationRun[]> {
  const query = new URLSearchParams();
  if (params.stage) query.set("stage", params.stage);
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return migrationFetch<MigrationRun[]>(`/runs${qs ? `?${qs}` : ""}`);
}

export function getRun(id: string): Promise<MigrationRun> {
  return migrationFetch<MigrationRun>(`/runs/${id}`);
}

export function getRunLogs(id: string, after = 0): Promise<MigrationLogsResponse> {
  return migrationFetch<MigrationLogsResponse>(`/runs/${id}/logs?after=${after}`);
}

// ── Reconcile / stats ─────────────────────────────────────────────────────────

export function getReconcile(): Promise<ReconcileRow[]> {
  return migrationFetch<ReconcileRow[]>("/reconcile");
}

export function getMigrationMapStats(): Promise<MigrationMapStat[]> {
  return migrationFetch<MigrationMapStat[]>("/migration-map/stats");
}
