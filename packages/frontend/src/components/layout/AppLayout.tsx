import { Outlet, NavLink } from "react-router-dom";
import { MobileNav } from "./MobileNav";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";
import { getNavItems } from "./navItems";
import logoWithText from "@Assets/logo-with-text.png";

export function AppLayout() {
  const { userProfile, signOut } = useAuth();

  const navItems = userProfile ? getNavItems(userProfile.role) : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 h-16">
        <div className="max-w-full px-4 h-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img
              src={logoWithText}
              alt="TABANG"
              className="h-12 object-contain"
            />
            <h1 className="text-2xl font-extrabold text-primary-700 font-display tracking-tight hidden sm:block">
              TABANG
            </h1>
          </div>
          {userProfile && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600 hidden sm:block font-medium">
                {userProfile.firstName}
                <span className="ml-1.5 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-semibold">
                  {userProfile.role}
                </span>
              </span>
              <button
                onClick={signOut}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
        {/* Accent stripe */}
        <div className="h-0.5 bg-gradient-to-r from-primary-600 via-accent-400 to-primary-600" />
      </header>

      {/* Layout with sidebar + main content */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        {userProfile && (
          <aside className="hidden md:flex flex-col w-56 bg-white border-r border-slate-200 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg mx-1 text-sm transition-colors font-medium ${
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }`
                  }
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 px-4 py-6 pb-24 md:pb-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
