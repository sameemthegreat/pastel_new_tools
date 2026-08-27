import { create } from "zustand";
import { inviteEvents, teamMembers } from "@/data/team";
import { NOW } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import type { InviteEmailType, InviteEvent, TeamMember, TeamRole } from "@/types/team";

/** Deterministic id sequence — no Math.random / Date.now. */
let memberSeq = 100;
let inviteSeq = 100;
const nextMemberId = () => `tm-${memberSeq++}`;
const nextInviteId = () => `inv-${inviteSeq++}`;

export type NewMemberInput = {
  name: string;
  username: string;
  email: string;
  role: TeamRole;
};

export type EditMemberInput = {
  name: string;
  email: string;
};

type TeamState = {
  members: TeamMember[];
  invites: InviteEvent[];
  /** True while the Add-member modal submit is in flight. */
  addingMember: boolean;
  /** True while the Edit-member modal submit is in flight. */
  savingMember: boolean;
  /** True while the header "Send test email" action is in flight. */
  sendingTest: boolean;
  /** Member id with a row action (reset / resend / remove) currently in flight. */
  busyMemberId: string | null;
  addMember: (input: NewMemberInput, sentBy: string, onDone?: () => void) => void;
  updateMember: (id: string, patch: EditMemberInput, onDone?: () => void) => void;
  setRole: (id: string, role: TeamRole) => void;
  removeMember: (id: string) => void;
  resetPassword: (id: string, sentBy: string) => void;
  resendWelcome: (id: string, sentBy: string) => void;
  sendTestEmail: (email: string) => void;
};

function inviteFor(member: TeamMember, type: InviteEmailType, sentBy: string): InviteEvent {
  return {
    id: nextInviteId(),
    memberId: member.id,
    recipientName: member.name,
    recipientEmail: member.email,
    type,
    sentAt: NOW,
    sentBy,
  };
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: teamMembers,
  invites: inviteEvents,
  addingMember: false,
  savingMember: false,
  sendingTest: false,
  busyMemberId: null,

  addMember: (input, sentBy, onDone) => {
    set({ addingMember: true });
    setTimeout(() => {
      const member: TeamMember = {
        id: nextMemberId(),
        name: input.name.trim(),
        username: input.username.trim().toLowerCase(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        joinedAt: NOW.slice(0, 10),
        lastActiveAt: NOW,
      };
      set((state) => ({
        addingMember: false,
        members: [...state.members, member],
        invites: [...state.invites, inviteFor(member, "welcome", sentBy)],
      }));
      toast({
        title: "Member added",
        description: `Welcome email with login details sent to ${member.email}.`,
        tone: "success",
      });
      onDone?.();
    }, 800);
  },

  updateMember: (id, patch, onDone) => {
    set({ savingMember: true });
    setTimeout(() => {
      set((state) => ({
        savingMember: false,
        members: state.members.map((m) =>
          m.id === id
            ? { ...m, name: patch.name.trim(), email: patch.email.trim().toLowerCase() }
            : m
        ),
      }));
      toast({ title: "Changes saved", description: "Member details updated.", tone: "success" });
      onDone?.();
    }, 650);
  },

  setRole: (id, role) => {
    const member = get().members.find((m) => m.id === id);
    if (!member || member.role === role) return;
    set((state) => ({
      members: state.members.map((m) => (m.id === id ? { ...m, role } : m)),
    }));
    toast({
      title: "Role updated",
      description: `${member.name} is now ${role === "admin" ? "an admin" : "a member"}.`,
      tone: "success",
    });
  },

  removeMember: (id) => {
    const member = get().members.find((m) => m.id === id);
    if (!member) return;
    set({ busyMemberId: id });
    setTimeout(() => {
      set((state) => ({
        busyMemberId: null,
        members: state.members.filter((m) => m.id !== id),
      }));
      toast({
        title: "Member removed",
        description: `${member.name} no longer has access to the console.`,
        tone: "success",
      });
    }, 700);
  },

  resetPassword: (id, sentBy) => {
    const member = get().members.find((m) => m.id === id);
    if (!member) return;
    set({ busyMemberId: id });
    setTimeout(() => {
      set((state) => ({
        busyMemberId: null,
        invites: [...state.invites, inviteFor(member, "reset", sentBy)],
      }));
      toast({
        title: "Password reset sent",
        description: `Reset link emailed to ${member.email}.`,
        tone: "success",
      });
    }, 700);
  },

  resendWelcome: (id, sentBy) => {
    const member = get().members.find((m) => m.id === id);
    if (!member) return;
    set({ busyMemberId: id });
    setTimeout(() => {
      set((state) => ({
        busyMemberId: null,
        invites: [...state.invites, inviteFor(member, "resend", sentBy)],
      }));
      toast({
        title: "Welcome email resent",
        description: `A fresh welcome email is on its way to ${member.email}.`,
        tone: "success",
      });
    }, 700);
  },

  sendTestEmail: (email) => {
    set({ sendingTest: true });
    setTimeout(() => {
      set({ sendingTest: false });
      toast({
        title: "Test email sent",
        description: `Delivered to ${email}.`,
        tone: "success",
      });
    }, 750);
  },
}));
