import { NavLink } from "react-router-dom";
import {
  Home,
  ClipboardList,
  Bell,
  User,
  LayoutDashboard,
  Users,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function MobileNav() {
  const { userProfile } = useAuth();

  if (!userProfile) return null;

  const navItems = getNavItems(userProfile.role);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs
              ${isActive ? "text-primary-600" : "text-gray-500"}`
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function getNavItems(role: string) {
  switch (role) {
    case "resident":
      return [
        { to: "/resident/request/new", icon: ClipboardList, label: "Request" },
        { to: "/resident/requests", icon: Home, label: "My Jobs" },
        { to: "/resident/notifications", icon: Bell, label: "Alerts" },
        { to: "/resident/profile", icon: User, label: "Profile" },
      ];
    case "worker":
      return [
        { to: "/worker/home", icon: Home, label: "Home" },
        { to: "/worker/notifications", icon: Bell, label: "Alerts" },
        { to: "/worker/profile", icon: User, label: "Profile" },
      ];
    case "admin":
      return [
        { to: "/admin/dashboard", icon: LayoutDashboard, label: "Home" },
        { to: "/admin/payments", icon: CreditCard, label: "Payments" },
        { to: "/admin/disputes", icon: AlertTriangle, label: "Disputes" },
        { to: "/admin/users", icon: Users, label: "Users" },
        { to: "/admin/data-entry", icon: ClipboardList, label: "Config" },
      ];
    default:
      return [];
  }
}
