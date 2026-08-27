import { create } from "zustand";

export type SessionUser = {
  name: string;
  email: string;
  role: "admin" | "operator";
};

type AuthState = {
  user: SessionUser | null;
  signIn: (email: string) => void;
  signOut: () => void;
};

/** Mock session — any credentials are accepted. */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  signIn: (email) =>
    set({ user: { name: "Sameem Amjad", email, role: "admin" } }),
  signOut: () => set({ user: null }),
}));
