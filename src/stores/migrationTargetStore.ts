import { create } from "zustand";
import type { MigrationTarget } from "@/types/migration";

/**
 * Which migration control-plane (and therefore which backend database) the Migration page is
 * driving right now. Held in a store rather than threaded through props because the API client
 * (`lib/api/migration.ts`) reads it to tag every request, including the LogViewer's polling, so
 * no component can accidentally mix a run id from one service with the other.
 *
 * In-memory only and defaults to `primary` on every load: the destructive stages make "which
 * database am I about to truncate?" something the operator should consciously re-select, never
 * inherit.
 */
type MigrationTargetState = {
  target: MigrationTarget;
  setTarget: (target: MigrationTarget) => void;
};

export const useMigrationTargetStore = create<MigrationTargetState>((set) => ({
  target: "primary",
  setTarget: (target) => set({ target }),
}));
