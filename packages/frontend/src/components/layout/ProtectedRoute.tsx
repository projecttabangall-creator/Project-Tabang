import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@tabang/shared";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { firebaseUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Not logged in
  if (!firebaseUser || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  // Not verified
  if (!userProfile.isVerified && userProfile.role === "resident") {
    return <Navigate to="/verify-otp" replace />;
  }

  // Role check
  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
    // Redirect to their role's home page
    const roleHome = {
      resident: "/resident/requests",
      worker: "/worker/home",
      admin: "/admin/dashboard",
    };
    return <Navigate to={roleHome[userProfile.role]} replace />;
  }

  return <Outlet />;
}
