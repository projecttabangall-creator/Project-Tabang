import {
  Home,
  ClipboardList,
  Bell,
  User,
  LayoutDashboard,
  Users,
  CreditCard,
  AlertTriangle,
  FileText,
  Wrench,
  Settings,
  History,
  TrendingUp,
  Siren,
  BarChart2,
  ShieldCheck,
  UserPlus,
  MessageSquare,
} from "lucide-react";

export interface NavItem {
  to: string;
  icon: typeof Home;
  label: string;
}

const adminNavItems: NavItem[] = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/analytics", icon: BarChart2, label: "Analytics" },
  { to: "/admin/notifications", icon: Bell, label: "Notifications" },
  { to: "/admin/requests", icon: FileText, label: "Requests" },
  { to: "/admin/emergencies", icon: Siren, label: "Emergencies" },
  { to: "/admin/payments", icon: CreditCard, label: "Payments" },
  { to: "/admin/income", icon: TrendingUp, label: "Income" },
  { to: "/admin/disputes", icon: AlertTriangle, label: "Disputes" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/workers", icon: Wrench, label: "Workers" },
  { to: "/admin/data-entry", icon: Settings, label: "Data Entry" },
  { to: "/admin/special-request", icon: Wrench, label: "Special Requests" },
  { to: "/admin/feedback", icon: MessageSquare, label: "Feedback" },
  { to: "/admin/logs", icon: History, label: "Logs" },
  { to: "/admin/profile", icon: User, label: "Profile" },
];

export function getNavItems(role: string): NavItem[] {
  switch (role) {
    case "resident":
      return [
        { to: "/resident/request/new", icon: ClipboardList, label: "New Request" },
        { to: "/resident/requests", icon: Home, label: "My Requests" },
        { to: "/resident/emergencies", icon: Siren, label: "Emergencies" },
        { to: "/resident/notifications", icon: Bell, label: "Notifications" },
        { to: "/resident/profile", icon: User, label: "Profile" },
      ];
    case "worker":
      return [
        { to: "/worker/home", icon: Home, label: "Home" },
        { to: "/worker/jobs", icon: History, label: "Jobs" },
        { to: "/worker/emergencies", icon: Siren, label: "Bayanihan" },
        { to: "/worker/notifications", icon: Bell, label: "Notifications" },
        { to: "/worker/profile", icon: User, label: "Profile" },
      ];
    case "admin":
      return adminNavItems;
    case "superadmin":
      return [
        { to: "/superadmin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { to: "/superadmin/admins", icon: ShieldCheck, label: "Admins" },
        { to: "/superadmin/admins/register", icon: UserPlus, label: "Register Admin" },
        ...adminNavItems.filter((item) => item.to !== "/admin/dashboard"),
      ];
    default:
      return [];
  }
}
