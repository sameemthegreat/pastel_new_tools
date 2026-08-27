import { create } from "zustand";
import { NOW } from "@/lib/format";
import { seedDeletionLog, seedUsers } from "@/data/users";
import { toast } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import type {
  DeletionLogEntry,
  MarketUser,
  UserType,
} from "@/types/users";

export type ModerationKind = "restrict" | "unrestrict" | "delete" | "role";

type PendingAction = { userId: string; kind: ModerationKind } | null;

type UsersState = {
  users: MarketUser[];
  deletionLog: DeletionLogEntry[];
  /** Action currently in flight (simulated async), or null. */
  pending: PendingAction;
  restrict: (userId: string, reason: string) => void;
  unrestrict: (userId: string, reason: string) => void;
  changeRole: (userId: string, nextType: UserType) => void;
  deleteAccount: (userId: string, reason: string) => void;
};

/** Deterministic id counter for history / log entries created at runtime. */
let entryCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++entryCounter}`;

function actorName(): string {
  return useAuthStore.getState().user?.name ?? "Admin";
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: seedUsers,
  deletionLog: seedDeletionLog,
  pending: null,

  restrict: (userId, reason) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user || get().pending) return;
    set({ pending: { userId, kind: "restrict" } });
    setTimeout(() => {
      set((state) => ({
        pending: null,
        users: state.users.map((u) =>
          u.id === userId
            ? {
                ...u,
                status: "restricted",
                restrictedAt: NOW,
                restrictionReason: reason,
                restrictionHistory: [
                  ...u.restrictionHistory,
                  {
                    id: nextId("rh"),
                    action: "restrict",
                    reason,
                    actor: actorName(),
                    createdAt: NOW,
                  },
                ],
                listings: u.listings.map((l) =>
                  l.state === "published" ? { ...l, state: "closed" as const } : l
                ),
              }
            : u
        ),
      }));
      toast({
        title: "Account restricted",
        description: `${user.displayName} can no longer sell or purchase. Published listings were closed.`,
        tone: "success",
      });
    }, 700);
  },

  unrestrict: (userId, reason) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user || get().pending) return;
    set({ pending: { userId, kind: "unrestrict" } });
    setTimeout(() => {
      set((state) => ({
        pending: null,
        users: state.users.map((u) =>
          u.id === userId
            ? {
                ...u,
                status: "active",
                restrictedAt: undefined,
                restrictionReason: undefined,
                restrictionHistory: [
                  ...u.restrictionHistory,
                  {
                    id: nextId("rh"),
                    action: "unrestrict",
                    reason,
                    actor: actorName(),
                    createdAt: NOW,
                  },
                ],
              }
            : u
        ),
      }));
      toast({
        title: "Restriction lifted",
        description: `${user.displayName} is active again.`,
        tone: "success",
      });
    }, 700);
  },

  changeRole: (userId, nextType) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user || get().pending || user.userType === nextType) return;
    set({ pending: { userId, kind: "role" } });
    setTimeout(() => {
      set((state) => ({
        pending: null,
        users: state.users.map((u) =>
          u.id === userId
            ? {
                ...u,
                userType: nextType,
                // Demoting a seller closes their shop's listings.
                listings:
                  nextType === "buyer"
                    ? u.listings.map((l) =>
                        l.state === "published"
                          ? { ...l, state: "closed" as const }
                          : l
                      )
                    : u.listings,
              }
            : u
        ),
      }));
      toast({
        title: "Role updated",
        description:
          nextType === "buyer"
            ? `${user.displayName} was demoted to buyer — open listings were closed.`
            : `${user.displayName} was promoted to seller.`,
        tone: "success",
      });
    }, 650);
  },

  deleteAccount: (userId, reason) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user || get().pending) return;
    set({ pending: { userId, kind: "delete" } });
    setTimeout(() => {
      const entry: DeletionLogEntry = {
        id: nextId("del-live"),
        userName: user.displayName,
        userEmail: user.email,
        userType: user.userType,
        reason,
        actor: actorName(),
        records: 3 + user.listings.length + user.restrictionHistory.length,
        source: "admin-user",
        deletedAt: NOW,
      };
      set((state) => ({
        pending: null,
        users: state.users.filter((u) => u.id !== userId),
        deletionLog: [entry, ...state.deletionLog],
      }));
      toast({
        title: "Account deleted",
        description: `${user.displayName} was removed. An entry was appended to the deletion log.`,
        tone: "success",
      });
    }, 850);
  },
}));
