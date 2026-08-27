/** Team module entities — admin console team accounts. */

export type TeamRole = "admin" | "member";

export type TeamMember = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: TeamRole;
  /** ISO date the account was created. */
  joinedAt: string;
  /** ISO datetime of most recent console activity. */
  lastActiveAt: string;
};

export type InviteEmailType = "welcome" | "resend" | "reset";

/** One transactional email sent to a team member (welcome / resend / password reset). */
export type InviteEvent = {
  id: string;
  memberId: string;
  recipientName: string;
  recipientEmail: string;
  type: InviteEmailType;
  /** ISO datetime the email was sent. */
  sentAt: string;
  /** Display name of the admin who triggered it. */
  sentBy: string;
};
