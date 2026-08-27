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

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Static badge count shown as a pill next to the label. */
  badge?: number;
  /** Only visible to users with role "admin". */
  adminOnly?: boolean;
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
      { label: "Curation", href: "/curation", icon: Pin },
      { label: "Fill Seller", href: "/fill-seller", icon: Store },
      { label: "Content Pulse", href: "/content-pulse", icon: BarChart3 },
    ],
  },
  {
    label: "Users & Requests",
    items: [
      { label: "Users", href: "/users", icon: Users },
      { label: "Requests", href: "/requests", icon: Inbox, badge: 6 },
      { label: "Team", href: "/team", icon: UserPlus, adminOnly: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Disputes", href: "/disputes", icon: Scale },
      { label: "Sales Tax", href: "/sales-tax", icon: Receipt },
      { label: "Email Templates", href: "/email-templates", icon: Mail },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Analytics", href: "/analytics", icon: TrendingUp },
      { label: "Invite Links", href: "/invite-links", icon: Link2 },
      { label: "Discounts", href: "/discounts", icon: TicketPercent },
    ],
  },
  {
    label: "System",
    items: [{ label: "App Versions", href: "/app-versions", icon: Smartphone }],
  },
];
