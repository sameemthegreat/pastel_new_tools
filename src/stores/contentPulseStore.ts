import { create } from "zustand";
import { toast } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { NOW } from "@/lib/format";
import {
  seedChanges,
  seedEmployees,
  seedImports,
  seedPosts,
} from "@/data/contentPulse";
import type {
  MetricChange,
  PeriodType,
  PulseEmployee,
  PulseImport,
  PulsePost,
} from "@/types/contentPulse";

/** Token colors cycled onto newly added employees. */
const EMPLOYEE_COLORS = [
  "var(--color-brand-500)",
  "var(--color-forest)",
  "var(--color-gold)",
  "var(--color-star)",
  "var(--color-success-500)",
  "var(--color-ink-muted)",
];

/** Small deterministic hash so simulated imports get stable, plausible counts. */
function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

type ImportInput = {
  fileName: string;
  label: string;
  periodType: PeriodType;
};

type ContentPulseState = {
  posts: PulsePost[];
  employees: PulseEmployee[];
  imports: PulseImport[];
  changes: MetricChange[];

  /** Simulated import pipeline: 0 idle, 1 upload, 2 parse, 3 apply. */
  importing: boolean;
  importStep: 0 | 1 | 2 | 3;

  assignEmployee: (postId: string, employeeId: string | null) => void;
  acknowledgeChange: (changeId: string) => void;
  acknowledgeAllChanges: (importId?: string) => void;
  addEmployee: (name: string) => boolean;
  removeEmployee: (employeeId: string) => void;
  deleteImport: (importId: string) => void;
  clearImports: () => void;
  runImport: (input: ImportInput, onDone?: () => void) => void;
};

export const useContentPulseStore = create<ContentPulseState>((set, get) => ({
  posts: seedPosts,
  employees: seedEmployees,
  imports: seedImports,
  changes: seedChanges,
  importing: false,
  importStep: 0,

  assignEmployee: (postId, employeeId) => {
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id === postId ? { ...p, employeeId } : p,
      ),
    }));
    const employee = get().employees.find((e) => e.id === employeeId);
    toast(
      employee
        ? {
            title: "Attribution updated",
            description: `Post assigned to ${employee.name}.`,
            tone: "success",
          }
        : {
            title: "Attribution cleared",
            description: "Post is now unassigned.",
            tone: "info",
          },
    );
  },

  acknowledgeChange: (changeId) => {
    set((s) => ({
      changes: s.changes.map((c) =>
        c.id === changeId ? { ...c, acknowledged: true } : c,
      ),
    }));
    toast({ title: "Alert acknowledged", tone: "success" });
  },

  acknowledgeAllChanges: (importId) => {
    const pending = get().changes.filter(
      (c) => !c.acknowledged && (!importId || c.importId === importId),
    ).length;
    if (pending === 0) return;
    set((s) => ({
      changes: s.changes.map((c) =>
        !c.acknowledged && (!importId || c.importId === importId)
          ? { ...c, acknowledged: true }
          : c,
      ),
    }));
    toast({
      title: "All alerts acknowledged",
      description: `${pending} alert${pending === 1 ? "" : "s"} marked as reviewed.`,
      tone: "success",
    });
  },

  addEmployee: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const exists = get().employees.some(
      (e) => e.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      toast({
        title: "Already on the roster",
        description: `${trimmed} is already a team member.`,
        tone: "error",
      });
      return false;
    }
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const employee: PulseEmployee = {
      id: `emp-${slug}`,
      name: trimmed,
      handle: slug.replace(/-/g, "."),
      color: EMPLOYEE_COLORS[get().employees.length % EMPLOYEE_COLORS.length],
    };
    set((s) => ({ employees: [...s.employees, employee] }));
    toast({
      title: "Team member added",
      description: `${trimmed} can now be attributed to posts.`,
      tone: "success",
    });
    return true;
  },

  removeEmployee: (employeeId) => {
    const employee = get().employees.find((e) => e.id === employeeId);
    const affected = get().posts.filter(
      (p) => p.employeeId === employeeId,
    ).length;
    set((s) => ({
      employees: s.employees.filter((e) => e.id !== employeeId),
      posts: s.posts.map((p) =>
        p.employeeId === employeeId ? { ...p, employeeId: null } : p,
      ),
    }));
    toast({
      title: "Team member removed",
      description: employee
        ? `${employee.name} removed — ${affected} post${affected === 1 ? "" : "s"} moved to unassigned.`
        : undefined,
      tone: "info",
    });
  },

  deleteImport: (importId) => {
    const record = get().imports.find((i) => i.id === importId);
    set((s) => ({
      imports: s.imports.filter((i) => i.id !== importId),
      changes: s.changes.filter((c) => c.importId !== importId),
    }));
    toast({
      title: "Import deleted",
      description: record
        ? `"${record.label}" and its change alerts were removed.`
        : undefined,
      tone: "info",
    });
  },

  clearImports: () => {
    set({ imports: [], changes: [] });
    toast({
      title: "Import history cleared",
      description: "All import records and change alerts were removed.",
      tone: "info",
    });
  },

  runImport: (input, onDone) => {
    if (get().importing) return;
    set({ importing: true, importStep: 1 });

    // Simulated pipeline: upload -> parse -> apply. Deterministic counts
    // derived from the file name (no Math.random).
    setTimeout(() => set({ importStep: 2 }), 700);
    setTimeout(() => set({ importStep: 3 }), 1400);
    setTimeout(() => {
      const h = hashString(input.fileName);
      const state = get();
      const rowCount = state.posts.length;
      const newCount = 2 + (h % 4);
      const changedCount = 5 + (h % 8);
      const record: PulseImport = {
        id: `imp-${(h % 9000) + 1000}-${state.imports.length + 1}`,
        label: input.label,
        fileName: input.fileName,
        periodType: input.periodType,
        rowCount,
        newCount,
        changedCount,
        importedAt: NOW,
        importedBy: useAuthStore.getState().user?.name ?? "Admin",
        status: "completed",
      };
      set((s) => ({
        imports: [record, ...s.imports],
        importing: false,
        importStep: 0,
      }));
      toast({
        title: "Import complete",
        description: `${rowCount} rows processed — ${newCount} new, ${changedCount} changed.`,
        tone: "success",
      });
      onDone?.();
    }, 2100);
  },
}));
