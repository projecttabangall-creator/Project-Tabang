import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

// Auth pages
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { ForgotPassword } from "@/pages/auth/ForgotPassword";
import { ChangePassword } from "@/pages/auth/ChangePassword";
import { VerifyEmail } from "@/pages/auth/VerifyEmail";

// Public pages
import { Landing } from "@/pages/Landing";
import { WorkerApplicationInfo } from "@/pages/WorkerApplicationInfo";

// Resident pages
import { MyRequests } from "@/pages/resident/MyRequests";
import { RequestService } from "@/pages/resident/RequestService";
import { RequestDetail } from "@/pages/resident/RequestDetail";
import { EditSchedule } from "@/pages/resident/EditSchedule";
import { ResidentProfile } from "@/pages/resident/Profile";
import { ResidentEmergencyFeed } from "@/pages/resident/EmergencyFeed";

// Worker pages
import { WorkerHome } from "@/pages/worker/Home";
import { JobDetail } from "@/pages/worker/JobDetail";
import { WorkerJobHistory } from "@/pages/worker/JobHistory";
import { WorkerProfile } from "@/pages/worker/Profile";
import Checkout from "@/pages/worker/Checkout";
import { WorkerEmergencyFeed } from "@/pages/worker/EmergencyFeed";

// Admin pages
import { AdminDashboard } from "@/pages/admin/Dashboard";
import { DataEntry } from "@/pages/admin/DataEntry";
import { WorkerRegistration } from "@/pages/admin/WorkerRegistration";
import { WorkerList } from "@/pages/admin/WorkerList";
import { WorkerDetail } from "@/pages/admin/WorkerDetail";
import { UserManagement } from "@/pages/admin/UserManagement";
import { PaymentReview } from "@/pages/admin/PaymentReview";
import { DisputeReview } from "@/pages/admin/DisputeReview";
import { RequestManagement } from "@/pages/admin/RequestManagement";
import { AdminRequestDetail } from "@/pages/admin/RequestDetail";
import { SpecialRequest } from "@/pages/admin/SpecialRequest";
import { Services } from "@/pages/admin/Services";
import { SystemLogs } from "@/pages/admin/SystemLogs";
import { Income } from "@/pages/admin/Income";
import { EmergencyList } from "@/pages/admin/EmergencyList";
import { EmergencyCreate } from "@/pages/admin/EmergencyCreate";
import { EmergencyDetail } from "@/pages/admin/EmergencyDetail";
import { Analytics } from "@/pages/admin/Analytics";
import { AdminProfile } from "@/pages/admin/Profile";

// Superadmin pages
import { SuperadminDashboard } from "@/pages/superadmin/Dashboard";
import { AdminList } from "@/pages/superadmin/AdminList";
import { AdminRegistration } from "@/pages/superadmin/AdminRegistration";

// Shared pages
import { Notifications } from "@/pages/Notifications";
import { SubmitPayment } from "@/pages/resident/SubmitPayment";
import { FileDispute } from "@/pages/shared/FileDispute";
import { FeedbackReview } from "@/pages/admin/FeedbackReview";
import { isSeedAuthEmail } from "@/utils/auth";

function RoleRedirect() {
  const { firebaseUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!userProfile) return <Landing />;

  if (
    userProfile.role === "resident" &&
    firebaseUser?.email &&
    !firebaseUser.emailVerified &&
    !isSeedAuthEmail(firebaseUser.email)
  ) {
    return <Navigate to="/verify-email" replace />;
  }

  switch (userProfile.role) {
    case "resident":
      return <Navigate to="/resident/requests" replace />;
    case "worker":
      return <Navigate to="/worker/home" replace />;
    case "admin":
      return <Navigate to="/admin/dashboard" replace />;
    case "superadmin":
      return <Navigate to="/superadmin/dashboard" replace />;
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
          <Route path="/apply-worker" element={<WorkerApplicationInfo />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
          </Route>

          {/* Root redirect based on role */}
          <Route path="/" element={<RoleRedirect />} />

          {/* Resident routes */}
          <Route element={<ProtectedRoute allowedRoles={["resident"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/resident/requests" element={<MyRequests />} />
              <Route path="/resident/request/new" element={<RequestService />} />
              <Route path="/resident/request/:requestId" element={<RequestDetail />} />
              <Route path="/resident/request/:requestId/edit-schedule" element={<EditSchedule />} />
              <Route path="/resident/request/:requestId/pay" element={<SubmitPayment />} />
              <Route path="/resident/request/:requestId/dispute" element={<FileDispute />} />
              <Route path="/resident/notifications" element={<Notifications />} />
              <Route path="/resident/emergencies" element={<ResidentEmergencyFeed />} />
              <Route path="/resident/profile" element={<ResidentProfile />} />
            </Route>
          </Route>

          {/* Worker routes */}
          <Route element={<ProtectedRoute allowedRoles={["worker"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/worker/home" element={<WorkerHome />} />
              <Route path="/worker/jobs" element={<WorkerJobHistory />} />
              <Route path="/worker/job/:jobId" element={<JobDetail />} />
              <Route path="/worker/job/:requestId/dispute" element={<FileDispute />} />
              <Route path="/worker/checkout" element={<Checkout />} />
              <Route path="/worker/notifications" element={<Notifications />} />
              <Route path="/worker/emergencies" element={<WorkerEmergencyFeed />} />
              <Route path="/worker/profile" element={<WorkerProfile />} />
            </Route>
          </Route>

          {/* Admin routes — also accessible by superadmin */}
          <Route element={<ProtectedRoute allowedRoles={["admin", "superadmin"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/analytics" element={<Analytics />} />
              <Route path="/admin/data-entry" element={<DataEntry />} />
              <Route path="/admin/workers/register" element={<WorkerRegistration />} />
              <Route path="/admin/workers" element={<WorkerList />} />
              <Route path="/admin/workers/:workerId" element={<WorkerDetail />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/payments" element={<PaymentReview />} />
              <Route path="/admin/income" element={<Income />} />
              <Route path="/admin/disputes" element={<DisputeReview />} />
              <Route path="/admin/requests" element={<RequestManagement />} />
              <Route path="/admin/requests/:requestId" element={<AdminRequestDetail />} />
              <Route path="/admin/special-request" element={<SpecialRequest />} />
              <Route path="/admin/services" element={<Services />} />
              <Route path="/admin/logs" element={<SystemLogs />} />
              <Route path="/admin/notifications" element={<Notifications />} />
              <Route path="/admin/profile" element={<AdminProfile />} />
              <Route path="/admin/emergencies" element={<EmergencyList />} />
              <Route path="/admin/emergencies/new" element={<EmergencyCreate />} />
              <Route path="/admin/emergencies/:emergencyId" element={<EmergencyDetail />} />
              <Route path="/admin/feedback" element={<FeedbackReview />} />
            </Route>
          </Route>

          {/* Superadmin routes */}
          <Route element={<ProtectedRoute allowedRoles={["superadmin"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/superadmin/dashboard" element={<SuperadminDashboard />} />
              <Route path="/superadmin/admins" element={<AdminList />} />
              <Route path="/superadmin/admins/register" element={<AdminRegistration />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
