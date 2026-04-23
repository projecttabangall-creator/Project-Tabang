import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Shield, Ban, UserCheck } from "lucide-react";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";
import {
  SuspendDialog,
  StatusChangePayload,
} from "@/components/admin/SuspendDialog";

interface UserItem {
  id: string;
  role: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  email?: string;
  creditPoints: number;
  isVerified: boolean;
  isActive: boolean;
  accountStatus: string;
  suspendReason?: string;
  suspendUntil?: string | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"suspend" | "ban" | "activate">(
    "suspend"
  );
  const [dialogTarget, setDialogTarget] = useState<UserItem | null>(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      setLoading(false);
      toast.error("Loading users took too long. Check if emulators are running.");
    }, 5000);

    fetchUsers().finally(() => clearTimeout(timeout));
  }, [roleFilter]);

  async function fetchUsers() {
    try {
      const params = roleFilter !== "all" ? `?role=${roleFilter}` : "";
      const { data } = await api.get(`/api/admin/users${params}`);
      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to load users:", error);
      setUsers([]);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  function openDialog(user: UserItem, mode: "suspend" | "ban" | "activate") {
    setDialogTarget(user);
    setDialogMode(mode);
    setDialogOpen(true);
  }

  async function handleDialogConfirm(payload: StatusChangePayload) {
    if (!dialogTarget) return;
    setDialogSubmitting(true);
    try {
      await api.patch(`/api/admin/users/${dialogTarget.id}/status`, payload);
      toast.success(
        `User ${
          payload.accountStatus === "suspended"
            ? "suspended"
            : payload.accountStatus === "banned"
              ? "banned"
              : "reactivated"
        }`
      );
      setDialogOpen(false);
      setDialogTarget(null);
      fetchUsers();
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.error || error?.message || "Failed to update user status";
      toast.error(errorMsg);
      throw error;
    } finally {
      setDialogSubmitting(false);
    }
  }

  async function handleCreditChange(userId: string, currentCredits: number) {
    const input = prompt(
      `Set credit points (1-5). Current: ${currentCredits}`
    );
    if (!input) return;
    const credits = parseInt(input);
    if (isNaN(credits) || credits < 1 || credits > 5) {
      toast.error("Credit points must be between 1 and 5");
      return;
    }

    const reason = prompt("Reason for adjustment:");
    if (reason === null) return;

    try {
      await api.patch(`/api/admin/users/${userId}/credit`, {
        creditPoints: credits,
        reason,
      });
      toast.success(`Credit points updated to ${credits}`);
      fetchUsers();
    } catch {
      toast.error("Failed to adjust credits");
    }
  }

  const statusColor: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    suspended: "bg-yellow-50 text-yellow-700",
    banned: "bg-red-50 text-red-700",
  };

  const roleColor: Record<string, string> = {
    resident: "bg-primary-50 text-primary-700",
    worker: "bg-purple-50 text-purple-700",
    admin: "bg-slate-100 text-slate-700",
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />
      <h2 className="text-2xl font-bold mb-6">User Management</h2>

      {/* Role filter */}
      <div className="flex gap-2 mb-4">
        {[
          { value: "all", label: "All" },
          { value: "resident", label: "Residents" },
          { value: "worker", label: "Workers" },
          { value: "admin", label: "Admins" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setRoleFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              roleFilter === tab.value
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {users.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">No users found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="card py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-slate-400">{user.contactNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Role badge */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${roleColor[user.role] || ""}`}
                >
                  {user.role}
                </span>

                {/* Status badge */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${statusColor[user.accountStatus] || ""}`}
                >
                  {user.accountStatus}
                </span>

                {/* Credit */}
                <button
                  onClick={() =>
                    handleCreditChange(user.id, user.creditPoints)
                  }
                  className="text-xs text-slate-500 hover:text-primary-600 px-2 py-0.5 rounded border border-slate-200"
                  title="Adjust credit points"
                >
                  {user.creditPoints}/5
                </button>

                {/* Status actions */}
                {user.accountStatus !== "active" && (
                  <button
                    onClick={() => openDialog(user, "activate")}
                    className="text-emerald-600 hover:text-emerald-700"
                    title="Activate"
                  >
                    <UserCheck size={16} />
                  </button>
                )}
                {user.accountStatus === "active" && user.role !== "admin" && (
                  <>
                    <button
                      onClick={() => openDialog(user, "suspend")}
                      className="text-yellow-600 hover:text-yellow-700"
                      title="Suspend"
                    >
                      <Shield size={16} />
                    </button>
                    <button
                      onClick={() => openDialog(user, "ban")}
                      className="text-red-500 hover:text-red-600"
                      title="Ban"
                    >
                      <Ban size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suspend/Ban Dialog */}
      {dialogTarget && (
        <SuspendDialog
          open={dialogOpen}
          mode={dialogMode}
          userName={`${dialogTarget.firstName} ${dialogTarget.lastName}`}
          onConfirm={handleDialogConfirm}
          onCancel={() => {
            setDialogOpen(false);
            setDialogTarget(null);
          }}
          isSubmitting={dialogSubmitting}
        />
      )}
    </div>
  );
}
