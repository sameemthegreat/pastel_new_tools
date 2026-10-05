/**
 * Shapes returned by the migration control-plane API (FastAPI, app/ in data-migration).
 * Payloads live at `data.value` of the shared envelope — see `src/lib/api/client.ts`.
 * Run rows come straight from Postgres columns, hence snake_case.
 */

export type MigrationStageParam =
  | "seller"
  | "force"
  | "limit"
  | "source"
  | "backupFile"
  | "preMode";

/** migrate only — what to do with current DB data before migrating. */
export type MigrationPreMode = "discard" | "backup";

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
  pre?: MigrationPreMode;
  backupFile?: string;
  dryRun?: boolean;
  confirm?: string;
};

// ── Target environment ────────────────────────────────────────────────────────

/**
 * Which migration control-plane the console drives — and therefore which backend DATABASE the
 * data is loaded into. Each environment runs its own FastAPI instance next to its own backend.
 *
 *   primary  — the control plane beside the backend THIS console is signed into
 *              (MIGRATION_API_URL). On the dev console that is dev's database.
 *   staging  — the staging control plane, reached CROSS-environment from this console
 *              (MIGRATION_STAGING_API_URL + the cross-backend bridge).
 *
 * The Sharetribe/Firestore SOURCE is chosen per run (`source` on the stage card); this picks the
 * destination. Sent to the `/api/migration` proxy as `?__target=` (primary is untagged).
 */
export type MigrationTarget = "primary" | "staging";

export const MIGRATION_TARGETS: readonly MigrationTarget[] = ["primary", "staging"];

export function isMigrationTarget(value: unknown): value is MigrationTarget {
  return typeof value === "string" && (MIGRATION_TARGETS as readonly string[]).includes(value);
}

export const MIGRATION_TARGET_META: Record<MigrationTarget, { label: string; dbLabel: string }> = {
  primary: {
    label: "Dev backend (this console)",
    dbLabel: "the dev backend's database (api-v1-new — the catalog the live apps use through the wrapper)",
  },
  staging: {
    label: "Staging backend",
    dbLabel: "the staging backend's database (api-staging-new)",
  },
};
