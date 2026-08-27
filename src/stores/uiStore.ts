import { create } from "zustand";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  tone: "success" | "error" | "info";
};

type UIState = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
};

/** Incrementing module counter — deterministic ids, no Math.random. */
let toastCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  mobileNavOpen: false,
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),

  toasts: [],
  toast: (t) => {
    toastCounter += 1;
    const id = `toast-${toastCounter}`;
    set((state) => ({ toasts: [...state.toasts, { ...t, id }] }));
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Fire a toast from anywhere (stores, event handlers) without a hook. */
export const toast = (t: Omit<Toast, "id">) => useUIStore.getState().toast(t);
