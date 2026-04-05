import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

// Auth pages
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { OTPVerification } from "@/pages/auth/OTPVerification";

// Resident pages
import { MyRequests } from "@/pages/resident/MyRequests";
import { RequestService } from "@/pages/resident/RequestService";
import { RequestDetail } from "@/pages/resident/RequestDetail";
import { ResidentProfile } from "@/pages/resident/Profile";

// Worker pages
import { WorkerHome } from "@/pages/worker/Home";
import { JobDetail } from "@/pages/worker/JobDetail";
import { WorkerProfile } from "@/pages/worker/Profile";

// Admin pages
import { AdminDashboard } from "@/pages/admin/Dashboard";
import { DataEntry } from "@/pages/admin/DataEntry";
import { WorkerRegistration } from "@/pages/admin/WorkerRegistration";
import { WorkerList } from "@/pages/admin/WorkerList";
import { UserManagement } from "@/pages/admin/UserManagement";

// Shared pages
import { Notifications } from "@/pages/Notifications";

function RoleRedirect() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!userProfile) return <Navigate to="/login" replace />;

  switch (userProfile.role) {
    case "resident":
      return <Navigate to="/resident/requests" replace />;
    case "worker":
      return <Navigate to="/worker/home" replace />;
    case "admin":
      return <Navigate to="/admin/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<OTPVerification />} />

          {/* Root redirect based on role */}
          <Route path="/" element={<RoleRedirect />} />

          {/* Resident routes */}
          <Route element={<ProtectedRoute allowedRoles={["resident"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/resident/requests" element={<MyRequests />} />
              <Route path="/resident/request/new" element={<RequestService />} />
              <Route path="/resident/request/:requestId" element={<RequestDetail />} />
              <Route path="/resident/notifications" element={<Notifications />} />
              <Route path="/resident/profile" element={<ResidentProfile />} />
            </Route>
          </Route>

          {/* Worker routes */}
          <Route element={<ProtectedRoute allowedRoles={["worker"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/worker/home" element={<WorkerHome />} />
              <Route path="/worker/job/:jobId" element={<JobDetail />} />
              <Route path="/worker/notifications" element={<Notifications />} />
              <Route path="/worker/profile" element={<WorkerProfile />} />
            </Route>
          </Route>

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/data-entry" element={<DataEntry />} />
              <Route path="/admin/workers/register" element={<WorkerRegistration />} />
              <Route path="/admin/workers" element={<WorkerList />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/notifications" element={<Notifications />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
