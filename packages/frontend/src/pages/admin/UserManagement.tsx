import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Shield, Ban, UserCheck, Trash2, Search } from "lucide-react";
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

interface PasswordResetRequestItem {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  role: string;
  contactNumber: string;
  note: string;
  matchedUserId: string | null;
  matchedUserRole: string | null;
  status: "pending" | "approved" | "rejected";
  requestedAt: string | Date | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"suspend" | "ban" | "activate">(
    "suspend"
  );
  const [dialogTarget, setDialogTarget] = useState<UserItem | null>(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [resetActionId, setResetActionId] = useState<string | null>(null);
  const [issuedPasswords, setIssuedPasswords] = useState<Record<string, string>>({});
  const visibleResetRequests = resetRequests.filter(
    (request) => request.status === "pending" || Boolean(issuedPasswords[request.id])
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!normalizedSearchQuery) return true;

    const searchableText = [
      user.firstName,
      user.lastName,
      `${user.firstName} ${user.lastName}`,
      user.contactNumber,
      user.email || "",
      user.role,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearchQuery);
  });

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
      const [{ data: usersData }, { data: resetData }] = await Promise.all([
        api.get(`/api/admin/users${params}`),
        api.get("/api/admin/password-reset-requests?status=all"),
      ]);
      setUsers(usersData.users || []);
      setResetRequests(resetData.requests || []);
    } catch (error) {
      console.error("Failed to load users:", error);
      setUsers([]);
      setResetRequests([]);
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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/admin/users/${deleteTarget.id}`);
      toast.success(`${deleteTarget.firstName} ${deleteTarget.lastName}'s account has been permanently deleted.`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete user");
    } finally {
      setDeleteSubmitting(false);
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

  async function handleResetAction(
    requestId: string,
    action: "approve" | "reject"
  ) {
    const resolutionNote =
      action === "reject" ? prompt("Reason for rejecting this request?") ?? "" : "";

    setResetActionId(requestId);
    try {
      const { data } = await api.patch(`/api/admin/password-reset-requests/${requestId}`, {
        action,
        resolutionNote,
      });

      if (action === "approve" && data.temporaryPassword) {
        setIssuedPasswords((prev) => ({
          ...prev,
          [requestId]: data.temporaryPassword,
        }));
        toast.success("Temporary password issued");
      } else {
        toast.success("Password reset request rejected");
      }

      await fetchUsers();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error || "Failed to process password reset request"
      );
    } finally {
      setResetActionId(null);
    }
  }

  function formatDate(value: string | Date | null | undefined) {
    if (!value) return "Unknown time";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return date.toLocaleString();
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

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Password Reset Requests</h3>
            <p className="text-sm text-slate-500">
              Review requests and issue temporary passwords that force a password change on next login.
            </p>
          </div>
          <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
            {visibleResetRequests.filter((request) => request.status === "pending").length} pending
          </span>
        </div>

        {visibleResetRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No pending password reset requests.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleResetRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{request.fullName}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                        {request.role}
                      </span>
                      {request.status === "approved" && issuedPasswords[request.id] && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          approved
                        </span>
                      )}
                      {!request.matchedUserId && (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                          no matched account
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{request.contactNumber}</p>
                    <p className="text-xs text-slate-400">
                      Requested {formatDate(request.requestedAt)}
                    </p>
                    {request.note && (
                      <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600">
                        {request.note}
                      </div>
                    )}
                    {issuedPasswords[request.id] && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                        Temporary password:{" "}
                        <span className="font-semibold">{issuedPasswords[request.id]}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 lg:w-48">
                    <button
                      onClick={() => handleResetAction(request.id, "approve")}
                      disabled={
                        resetActionId === request.id ||
                        !request.matchedUserId ||
                        request.status !== "pending"
                      }
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {request.status === "approved"
                        ? "Already Issued"
                        : resetActionId === request.id
                          ? "Processing..."
                          : "Issue Temp Password"}
                    </button>
                    <button
                      onClick={() => handleResetAction(request.id, "reject")}
                      disabled={resetActionId === request.id || request.status !== "pending"}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject Request
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

      <div className="mb-4">
        <label htmlFor="user-search" className="label">
          Search Users
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            id="user-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, number, email, or role"
            className="input-field pl-10"
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">
            {users.length === 0 ? "No users found." : "No users match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => (
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
                <button
                  onClick={() => setDeleteTarget(user)}
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete account permanently"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 size={22} />
              <h3 className="text-lg font-bold">Delete Account Permanently</h3>
            </div>
            <p className="text-slate-700 text-sm">
              You are about to permanently delete the account of{" "}
              <span className="font-semibold">
                {deleteTarget.firstName} {deleteTarget.lastName}
              </span>{" "}
              ({deleteTarget.role}).
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm font-medium">
              ⚠ This action cannot be undone. All data for this account will be lost forever.
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {deleteSubmitting ? "Deleting..." : "Yes, Delete Permanently"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
                className="flex-1 py-2 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
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
