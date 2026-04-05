import { Outlet } from "react-router-dom";
import { MobileNav } from "./MobileNav";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";

export function AppLayout() {
  const { userProfile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary-700">Tabang</h1>
          {userProfile && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:block">
                {userProfile.firstName} ({userProfile.role})
              </span>
              <button
                onClick={signOut}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
