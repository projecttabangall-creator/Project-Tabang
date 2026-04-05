import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Shield, Ban, UserCheck } from "lucide-react";
import api from "@/services/api";

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
}

export function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  async function fetchUsers() {
    try {
      const params = roleFilter !== "all" ? `?role=${roleFilter}` : "";
      const { data } = await api.get(`/api/admin/users${params}`);
      setUsers(data.users);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(userId: string, newStatus: string) {
    const reason = prompt(
      `Reason for ${newStatus === "active" ? "activating" : newStatus === "suspended" ? "suspending" : "banning"} this user:`
    );
    if (reason === null) return; // Cancelled

    try {
      await api.patch(`/api/admin/users/${userId}/status`, {
        accountStatus: newStatus,
        reason,
      });
      toast.success(`User ${newStatus}`);
      fetchUsers();
    } catch {
      toast.error("Failed to update user status");
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
    active: "bg-green-50 text-green-700",
    suspended: "bg-yellow-50 text-yellow-700",
    banned: "bg-red-50 text-red-700",
  };

  const roleColor: Record<string, string> = {
    resident: "bg-blue-50 text-blue-700",
    worker: "bg-purple-50 text-purple-700",
    admin: "bg-gray-100 text-gray-700",
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
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {users.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No users found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="card py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-xs">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{user.contactNumber}</p>
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
                  className="text-xs text-gray-500 hover:text-primary-600 px-2 py-0.5 rounded border border-gray-200"
                  title="Adjust credit points"
                >
                  {user.creditPoints}/5
                </button>

                {/* Status actions */}
                {user.accountStatus !== "active" && (
                  <button
                    onClick={() => handleStatusChange(user.id, "active")}
                    className="text-green-600 hover:text-green-700"
                    title="Activate"
                  >
                    <UserCheck size={16} />
                  </button>
                )}
                {user.accountStatus === "active" && user.role !== "admin" && (
                  <>
                    <button
                      onClick={() => handleStatusChange(user.id, "suspended")}
                      className="text-yellow-600 hover:text-yellow-700"
                      title="Suspend"
                    >
                      <Shield size={16} />
                    </button>
                    <button
                      onClick={() => handleStatusChange(user.id, "banned")}
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
    </div>
  );
}
