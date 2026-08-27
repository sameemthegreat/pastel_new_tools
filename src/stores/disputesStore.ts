import { create } from "zustand";
import { disputeOrders } from "@/data/disputes";
import { NOW } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type {
  DisputeOrder,
  DisputeStatus,
  ResolutionOutcome,
  TimelineStep,
} from "@/types/disputes";

const outcomeConfig: Record<
  ResolutionOutcome,
  {
    status: DisputeStatus;
    timelineLabel: string;
    toastTitle: string;
    toastDescription: (o: DisputeOrder) => string;
  }
> = {
  buyer: {
    status: "refunded",
    timelineLabel: "Resolved in buyer's favor — refund issued",
    toastTitle: "Resolved in buyer's favor",
    toastDescription: (o) =>
      `Refund issued to ${o.buyerName} for "${o.listingTitle}".`,
  },
  seller: {
    status: "resolved",
    timelineLabel: "Resolved in seller's favor — payout released",
    toastTitle: "Resolved in seller's favor",
    toastDescription: (o) =>
      `Payout released to ${o.sellerName} for "${o.listingTitle}".`,
  },
  replacement: {
    status: "replacement",
    timelineLabel: "Replacement issued to buyer",
    toastTitle: "Replacement issued",
    toastDescription: (o) =>
      `${o.sellerName} was asked to ship a replacement to ${o.buyerName}.`,
  },
};

type DisputesState = {
  orders: DisputeOrder[];
  /** Order id currently mid-resolution (simulated async), or null. */
  resolvingId: string | null;
  refreshing: boolean;
  resolve: (id: string, outcome: ResolutionOutcome) => void;
  refresh: () => void;
};

export const useDisputesStore = create<DisputesState>((set, get) => ({
  orders: disputeOrders,
  resolvingId: null,
  refreshing: false,

  resolve: (id, outcome) => {
    if (get().resolvingId) return;
    const order = get().orders.find((o) => o.id === id);
    if (!order) return;
    set({ resolvingId: id });

    setTimeout(() => {
      const cfg = outcomeConfig[outcome];
      set((state) => ({
        resolvingId: null,
        orders: state.orders.map((o) => {
          if (o.id !== id) return o;
          const step: TimelineStep = {
            id: `${o.id}-op-${outcome}`,
            kind: "resolution",
            label: cfg.timelineLabel,
            detail: "Resolved by Sameem Amjad via admin console",
            at: NOW,
          };
          return {
            ...o,
            status: cfg.status,
            // Issuing a replacement transitions the order into the
            // replacement flow; buyer/seller resolutions are terminal.
            type: outcome === "replacement" ? "replacement" : o.type,
            lastUpdatedAt: NOW,
            resolution: {
              outcome,
              resolvedAt: NOW,
              actor: "Sameem Amjad",
            },
            timeline: [...o.timeline, step],
          };
        }),
      }));
      toast({
        title: cfg.toastTitle,
        description: cfg.toastDescription(order),
        tone: "success",
      });
    }, 750);
  },

  refresh: () => {
    if (get().refreshing) return;
    set({ refreshing: true });
    setTimeout(() => {
      set({ refreshing: false });
      toast({
        title: "Orders refreshed",
        description: "Synced escalated transactions from Sharetribe.",
        tone: "info",
      });
    }, 700);
  },
}));
