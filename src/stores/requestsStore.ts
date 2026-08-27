import { create } from "zustand";
import { NOW } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import { REMOVAL_REQUESTS, WAITLIST_SIGNUPS } from "@/data/requests";
import {
  STAGE_LABELS,
  type CrmStage,
  type RemovalRequest,
  type WaitlistSignup,
} from "@/types/requests";

/** Actor recorded on mutations (mock session admin). */
const ACTOR = "Sameem Amjad";

/** Incrementing module counter — deterministic ids, no Math.random. */
let noteCounter = 0;

type RequestsState = {
  signups: WaitlistSignup[];
  removals: RemovalRequest[];
  /** id of the signup currently being approved/rejected (simulated async). */
  approvingId: string | null;
  rejectingId: string | null;
  /** id of the removal request currently being completed (simulated async). */
  completingId: string | null;

  /** Move a signup to a new CRM stage (records stage history + toasts). */
  setStage: (id: string, stage: CrmStage) => void;
  /** Approve a signup — simulated async (welcome email), then stage → approved. */
  approveSignup: (id: string) => void;
  /** Reject a signup — simulated async (rejection email), then stage → rejected. */
  rejectSignup: (id: string) => void;
  /** Append an internal note to a signup. */
  addNote: (id: string, text: string) => void;
  /** Complete a GDPR removal request with a required audit note (simulated async). */
  completeRemoval: (id: string, auditNote: string) => void;
};

function withStage(
  signup: WaitlistSignup,
  stage: CrmStage,
): WaitlistSignup {
  return {
    ...signup,
    stage,
    lastUpdatedAt: NOW,
    stageHistory: [
      ...signup.stageHistory,
      { stage, changedBy: ACTOR, changedAt: NOW },
    ],
  };
}

export const useRequestsStore = create<RequestsState>((set, get) => ({
  signups: WAITLIST_SIGNUPS,
  removals: REMOVAL_REQUESTS,
  approvingId: null,
  rejectingId: null,
  completingId: null,

  setStage: (id, stage) => {
    const signup = get().signups.find((s) => s.id === id);
    if (!signup || signup.stage === stage) return;
    set((state) => ({
      signups: state.signups.map((s) =>
        s.id === id ? withStage(s, stage) : s,
      ),
    }));
    toast({
      title: "Stage updated",
      description: `${signup.name} moved to ${STAGE_LABELS[stage]}.`,
      tone: "info",
    });
  },

  approveSignup: (id) => {
    const signup = get().signups.find((s) => s.id === id);
    if (!signup || get().approvingId) return;
    set({ approvingId: id });
    setTimeout(() => {
      set((state) => ({
        approvingId: null,
        signups: state.signups.map((s) =>
          s.id === id ? withStage(s, "approved") : s,
        ),
      }));
      toast({
        title: "Application approved",
        description: `${signup.name} was approved — welcome email with shop setup link sent.`,
        tone: "success",
      });
    }, 800);
  },

  rejectSignup: (id) => {
    const signup = get().signups.find((s) => s.id === id);
    if (!signup || get().rejectingId) return;
    set({ rejectingId: id });
    setTimeout(() => {
      set((state) => ({
        rejectingId: null,
        signups: state.signups.map((s) =>
          s.id === id ? withStage(s, "rejected") : s,
        ),
      }));
      toast({
        title: "Application rejected",
        description: `${signup.name} was rejected and notified by email.`,
        tone: "info",
      });
    }, 650);
  },

  addNote: (id, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    noteCounter += 1;
    const noteId = `wn-live-${noteCounter}`;
    set((state) => ({
      signups: state.signups.map((s) =>
        s.id === id
          ? {
              ...s,
              notes: [
                ...s.notes,
                { id: noteId, author: ACTOR, text: trimmed, createdAt: NOW },
              ],
            }
          : s,
      ),
    }));
    toast({
      title: "Note added",
      description: "Visible to admins only.",
      tone: "info",
    });
  },

  completeRemoval: (id, auditNote) => {
    const removal = get().removals.find((r) => r.id === id);
    if (!removal || removal.status === "completed" || get().completingId) {
      return;
    }
    set({ completingId: id });
    setTimeout(() => {
      set((state) => ({
        completingId: null,
        removals: state.removals.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "completed" as const,
                completedAt: NOW,
                completedBy: ACTOR,
                auditNote: auditNote.trim(),
              }
            : r,
        ),
      }));
      toast({
        title: "Removal completed",
        description: `${removal.recordsCount} record(s) for ${removal.email} erased and logged to the audit trail.`,
        tone: "success",
      });
    }, 750);
  },
}));
