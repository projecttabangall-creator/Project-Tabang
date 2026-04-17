import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getNavItems } from "./navItems";

interface MobileNavProps {
  unreadCount?: number;
}

export function MobileNav({ unreadCount = 0 }: MobileNavProps) {
  const { userProfile } = useAuth();

  if (!userProfile) return null;

  const navItems = getNavItems(userProfile.role);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 md:hidden">
      <div className="h-0.5 bg-gradient-to-r from-primary-500 via-accent-400 to-primary-500" />
      <div className="flex items-center h-16 overflow-x-auto overflow-y-hidden scrollbar-hide px-1" style={{ scrollBehavior: "smooth" }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-4 py-2 text-xs font-medium transition-colors shrink-0
              ${isActive ? "text-accent-600" : "text-slate-400 hover:text-slate-600"}`
            }
          >
            <div className="relative">
              <item.icon size={20} />
              {item.to.includes("notifications") && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </div>
            <span className="line-clamp-1">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

