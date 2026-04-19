import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Trash2, Ban, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/services/api";

interface AdminAccount {
  id: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  email?: string;
  accountStatus: "active" | "suspended";
  isActive: boolean;
  createdAt: { seconds: number } | null;
}

export function AdminList() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    try {
      const { data } = await api.get("/api/superadmin/admins");
      setAdmins(data.admins || []);
    } catch {
      toast.error("Failed to load admin accounts");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(admin: AdminAccount) {
    const newStatus = admin.accountStatus === "active" ? "suspended" : "active";
    setProcessing(admin.id);
    try {
      await api.patch(`/api/superadmin/admins/${admin.id}/status`, {
        accountStatus: newStatus,
      });
      toast.success(`Admin ${newStatus === "active" ? "reactivated" : "suspended"}`);
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === admin.id
            ? { ...a, accountStatus: newStatus, isActive: newStatus === "active" }
            : a
        )
      );
    } catch {
      toast.error("Failed to update admin status");
    } finally {
      setProcessing(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setProcessing(deleteTarget.id);
    try {
      await api.delete(`/api/superadmin/admins/${deleteTarget.id}`);
      toast.success("Admin account deleted");
      setAdmins((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete admin account");
    } finally {
      setProcessing(null);
    }
  }

  function formatDate(ts: { seconds: number } | null) {
    if (!ts) return "—";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck size={24} className="text-primary-600" />
          <h1 className="page-title">Admin Accounts</h1>
        </div>
        <Link to="/superadmin/admins/register" className="btn-primary flex items-center gap-2">
          <UserPlus size={16} />
          Register Admin
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : admins.length === 0 ? (
        <div className="card text-center py-12">
          <ShieldCheck size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No admin accounts yet</p>
          <p className="text-sm text-slate-400 mt-1">Register the first admin account to get started.</p>
          <Link to="/superadmin/admins/register" className="btn-primary mt-4 inline-flex items-center gap-2">
            <UserPlus size={16} />
            Register Admin
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Contact</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Registered</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin, i) => (
                  <tr
                    key={admin.id}
                    className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {admin.firstName} {admin.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{admin.contactNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          admin.accountStatus === "active"
                            ? "badge-success"
                            : "badge-warning"
                        }`}
                      >
                        {admin.accountStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(admin.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Suspend / Reactivate */}
                        <button
                          onClick={() => toggleStatus(admin)}
                          disabled={processing === admin.id}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            admin.accountStatus === "active"
                              ? "text-yellow-600 hover:bg-yellow-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={admin.accountStatus === "active" ? "Suspend" : "Reactivate"}
                        >
                          {admin.accountStatus === "active" ? (
                            <Ban size={16} />
                          ) : (
                            <CheckCircle size={16} />
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(admin)}
                          disabled={processing === admin.id}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 bg-gradient-to-r from-rose-500 to-rose-600 rounded-t-xl">
              <h3 className="text-white font-bold text-lg">Delete Admin Account</h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-slate-600 text-sm">
                Are you sure you want to permanently delete the admin account for{" "}
                <span className="font-semibold text-slate-800">
                  {deleteTarget.firstName} {deleteTarget.lastName}
                </span>
                ? This cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={processing === deleteTarget.id}
                  className="btn-danger flex-1 disabled:opacity-50"
                >
                  {processing === deleteTarget.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
