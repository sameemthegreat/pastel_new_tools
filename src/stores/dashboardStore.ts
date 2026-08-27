import { create } from "zustand";
import { ACTIVITY_SEED, ATTENTION_SEED } from "@/data/dashboard";
import { toast } from "@/stores/uiStore";
import type { ActivityEvent, AttentionItem, RangeKey } from "@/types/dashboard";

type DashboardState = {
  /** Range filter driving the KPI row + trend chart. */
  range: RangeKey;
  attention: AttentionItem[];
  activity: ActivityEvent[];
  refreshing: boolean;
  exporting: boolean;
  setRange: (range: RangeKey) => void;
  /** Simulated re-aggregation of dashboard metrics. */
  refresh: () => void;
  /** Snooze a needs-attention queue from the overview (does not touch the module). */
  dismissAttention: (id: string) => void;
  restoreAttention: () => void;
  clearActivity: () => void;
  /** Simulated report export; `done` fires after the fake build completes. */
  exportReport: (sections: string[], range: RangeKey, done: () => void) => void;
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  range: "30d",
  attention: ATTENTION_SEED,
  activity: ACTIVITY_SEED,
  refreshing: false,
  exporting: false,

  setRange: (range) => set({ range }),

  refresh: () => {
    if (get().refreshing) return;
    set({ refreshing: true });
    setTimeout(() => {
      set({ refreshing: false });
      toast({
        title: "Dashboard refreshed",
        description: "Aggregates recomputed from the latest module data.",
        tone: "success",
      });
    }, 750);
  },

  dismissAttention: (id) => {
    const item = get().attention.find((a) => a.id === id);
    set((state) => ({
      attention: state.attention.filter((a) => a.id !== id),
    }));
    toast({
      title: "Hidden from overview",
      description: item
        ? `"${item.label}" stays open in ${item.href.replace("/", "")} — it is only hidden here.`
        : "The queue stays open in its module.",
      tone: "info",
    });
  },

  restoreAttention: () => {
    set({ attention: ATTENTION_SEED });
    toast({ title: "Queues restored", tone: "success" });
  },

  clearActivity: () => {
    set({ activity: [] });
    toast({
      title: "Activity feed cleared",
      description: "Events remain in each module's own audit log.",
      tone: "info",
    });
  },

  exportReport: (sections, range, done) => {
    if (get().exporting) return;
    set({ exporting: true });
    setTimeout(() => {
      set({ exporting: false });
      toast({
        title: "Report exported",
        description: `${sections.length} section${sections.length === 1 ? "" : "s"} · ${range} window — download started.`,
        tone: "success",
      });
      done();
    }, 850);
  },
}));
