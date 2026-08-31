import {
  BarChart3,
  Inbox,
  LayoutDashboard,
  Link2,
  Mail,
  Pin,
  Receipt,
  Scale,
  Smartphone,
  Store,
  TicketPercent,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminCapability } from "@/types/auth";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Static badge count shown as a pill next to the label. */
  badge?: number;
  /** Not built yet — rendered disabled with a "Soon" chip instead of a dead link. */
  comingSoon?: boolean;
  /**
   * Hidden unless the signed-in operator holds this capability — the one the page's own API calls
   * require, so the nav never offers a screen that would only render errors. Omit for screens every
   * operator can open. The API enforces the same capability regardless; this is navigation, not a
   * security boundary.
   */
  capability?: AdminCapability;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Content",
    items: [
      { label: "Curation", href: "/curation", icon: Pin, capability: "curation.read" },
      { label: "Fill Seller", href: "/fill-seller", icon: Store, capability: "fillSeller.use" },
      {
        label: "Content Pulse",
        href: "/content-pulse",
        icon: BarChart3,
        capability: "contentPulse.read",
      },
    ],
  },
  {
    label: "Users & Requests",
    items: [
      { label: "Users", href: "/users", icon: Users, capability: "users.read" },
      { label: "Requests", href: "/requests", icon: Inbox, capability: "applications.read" },
      { label: "Team", href: "/team", icon: UserPlus, capability: "team.read" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Disputes", href: "/disputes", icon: Scale, capability: "disputes.read" },
      { label: "Sales Tax", href: "/sales-tax", icon: Receipt, capability: "salesTax.read" },
      {
        label: "Email Templates",
        href: "/email-templates",
        icon: Mail,
        capability: "emailTemplates.read",
      },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Analytics", href: "/analytics", icon: TrendingUp, capability: "analytics.read" },
      { label: "Invite Links", href: "/invite-links", icon: Link2, capability: "analytics.read" },
      {
        label: "Discounts",
        href: "/discounts",
        icon: TicketPercent,
        capability: "discounts.read",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "App Versions",
        href: "/app-versions",
        icon: Smartphone,
        capability: "appVersions.read",
      },
    ],
  },
];
