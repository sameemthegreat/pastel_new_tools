/**
 * Shapes returned by the migration control-plane API (FastAPI, app/ in data-migration).
 * Payloads live at `data.value` of the shared envelope — see `src/lib/api/client.ts`.
 * Run rows come straight from Postgres columns, hence snake_case.
 */

export type MigrationStageParam = "seller" | "force" | "limit" | "source" | "backupFile";

export type MigrationStage = {
  key: string;
  label: string;
  description: string;
  /** Truncates production tables — gated behind a typed confirm phrase. */
  destructive: boolean;
  /** Needs live Sharetribe/Firestore credentials (extract). */
  needsCreds: boolean;
  params: MigrationStageParam[];
  /** The exact string the caller must echo in `confirm` for a destructive stage. */
  confirmPhrase: string | null;
};

export type MigrationRunStatus = "running" | "succeeded" | "failed" | "interrupted";

export type MigrationRun = {
  id: string;
  stage: string;
  params: Record<string, unknown>;
  dry_run: boolean;
  status: MigrationRunStatus;
  summary: Record<string, unknown> | null;
  error: string | null;
  triggered_by: string | null;
  triggered_by_email: string | null;
  ip: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type MigrationLogLine = {
  seq: number;
  ts: string;
  stream: "stdout" | "stderr";
  line: string;
};

export type MigrationLogsResponse = {
  lines: MigrationLogLine[];
  nextSeq: number;
  runStatus: MigrationRunStatus;
};

export type ReconcileRow = { label: string; count: number | null };

export type MigrationMapStat = { source_type: string; count: number };

export type BackupFile = { name: string; sizeBytes: number; modifiedAt: string };

/** Which source `extract` pulls from. */
export type MigrationSource = "live" | "dev";

/** Body for POST /runs. */
export type TriggerRunInput = {
  stage: string;
  seller?: string;
  force?: boolean;
  limit?: number;
  source?: MigrationSource;
  backupFile?: string;
  dryRun?: boolean;
  confirm?: string;
};
