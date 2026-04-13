import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { BackButton } from "@/components/common/BackButton";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FileText,
  Filter,
  Search,
  User,
  Wrench,
  XCircle,
  Ban,
  MoreVertical,
  Eye,
  TriangleAlert,
} from "lucide-react";
import api from "@/services/api";

interface ServiceRequest {
  id: string;
  residentName: string;
  categoryName: string;
  itemName: string;
  description: string;
  suggestedPrice: number;
  finalPrice?: number;
  pendingFinalPrice?: number;
  status: string;
  assignedWorkerName?: string;
  workerName?: string;
  paymentMethod: string;
  cancelledBy?: string;
  createdAt: { _seconds: number } | string;
  schedule: {
    date: { _seconds: number } | string;
    startTime: string;
    endTime: string;
  };
  isSpecialRequest?: boolean;
  beneficiaryName?: string;
  priceOverrideRequired?: boolean;
}

interface Category {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  assigned: "bg-yellow-50 text-yellow-700",
  accepted: "bg-primary-50 text-primary-700",
  worker_arrived: "bg-purple-50 text-purple-700",
  price_confirmed: "bg-indigo-50 text-indigo-700",
  in_progress: "bg-accent-50 text-accent-700",
  completed: "bg-emerald-50 text-emerald-700",
  payment_submitted: "bg-emerald-50 text-emerald-700",
  payment_confirmed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-50 text-rose-700",
  under_dispute: "bg-orange-50 text-orange-700",
  resolved: "bg-slate-100 text-slate-600",
};

const ALL_STATUSES = [
  "pending",
  "assigned",
  "accepted",
  "worker_arrived",
  "price_confirmed",
  "in_progress",
  "completed",
  "payment_submitted",
  "payment_confirmed",
  "cancelled",
  "under_dispute",
  "resolved",
];

function parseTimestamp(ts: { _seconds: number } | string | undefined): Date {
  if (!ts) return new Date();
  if (typeof ts === "string") return new Date(ts);
  if (typeof ts === "object" && "_seconds" in ts) {
    return new Date(ts._seconds * 1000);
  }
  return new Date();
}

export function RequestManagement() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCancelledOnly, setShowCancelledOnly] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetchRequests(), fetchCategories()]);
  }, []);

  async function fetchRequests() {
    try {
      setLoading(true);
      const { data } = await api.get("/api/requests");
      setRequests(data.requests || []);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const { data } = await api.get("/api/categories");
      setCategories(data.categories || []);
    } catch {
      // non-critical
    }
  }

  async function reviewPriceOverride(requestId: string, approved: boolean) {
    let rejectionReason = "";

    if (!approved) {
      rejectionReason = window.prompt("Reason for rejection:")?.trim() || "";
      if (!rejectionReason) {
        toast.error("Rejection reason is required");
        return;
      }
    }

    setProcessingId(requestId);
    try {
      await api.patch(`/api/requests/${requestId}/approve-price-override`, {
        approved,
        rejectionReason,
      });
      toast.success(
        approved ? "Price override approved." : "Price override rejected."
      );
      await fetchRequests();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to review price override"
      );
    } finally {
      setProcessingId(null);
    }
  }

  function toggleMenu(requestId: string) {
    setOpenMenuId(openMenuId === requestId ? null : requestId);
  }

  function openCancelConfirm(requestId: string) {
    setOpenMenuId(null);
    setCancelConfirmId(requestId);
  }

  async function confirmCancelRequest() {
    if (!cancelConfirmId) return;

    setProcessingId(cancelConfirmId);
    try {
      await api.patch(`/api/requests/${cancelConfirmId}/cancel`);
      toast.success("Request cancelled successfully");
      setCancelConfirmId(null);
      await fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to cancel request");
    } finally {
      setProcessingId(null);
    }
  }

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      !searchTerm ||
      request.residentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.beneficiaryName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || request.status === statusFilter;
    const matchesCategory =
      !categoryFilter || request.categoryName === categoryFilter;
    const matchesCancelled = !showCancelledOnly || request.status === "cancelled";

    return matchesSearch && matchesStatus && matchesCategory && matchesCancelled;
  });

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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title">Request Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            View and manage all service requests
          </p>
        </div>
        <span className="badge-neutral">{filteredRequests.length} requests</span>
      </div>

      <div className="card mb-6 !p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by resident, category, beneficiary, or ID..."
              className="input-field !pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
            <Filter
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              className="input-field !pl-9 !pr-8 appearance-none min-w-[160px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {ALL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          <div className="relative">
            <select
              className="input-field appearance-none !pr-8 min-w-[140px]"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              checked={showCancelledOnly}
              onChange={(e) => setShowCancelledOnly(e.target.checked)}
            />
            Cancelled only
          </label>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="card text-center py-12">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No requests match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const createdDate = parseTimestamp(request.createdAt);
            const displayPrice =
              request.pendingFinalPrice || request.finalPrice || request.suggestedPrice;
            const isReviewing = processingId === request.id;

            return (
              <div key={request.id} className="card !p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-slate-900">
                          {request.categoryName}
                        </h3>
                        <span className="text-slate-400">•</span>
                        <span className="text-sm text-slate-600">
                          {request.itemName}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            STATUS_COLORS[request.status] || STATUS_COLORS.pending
                          }`}
                        >
                          {request.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        {request.isSpecialRequest && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-50 text-accent-700">
                            SPECIAL REQUEST
                          </span>
                        )}
                        {request.priceOverrideRequired && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            PRICE OVERRIDE PENDING
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-500 truncate mb-2">
                        {request.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {request.residentName}
                        </span>
                        {request.workerName && (
                          <span className="flex items-center gap-1">
                            <Wrench size={12} />
                            {request.workerName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {format(createdDate, "MMM d, yyyy")}
                        </span>
                        {request.beneficiaryName && (
                          <span className="flex items-center gap-1 text-accent-600">
                            <AlertCircle size={12} />
                            Beneficiary: {request.beneficiaryName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Menu Button */}
                      <div className="relative">
                        <button
                          onClick={() => toggleMenu(request.id)}
                          className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                          title="More actions"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {openMenuId === request.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-10 overflow-hidden"
                          >
                            <button
                              onClick={() => {
                                navigate(`/admin/requests/${request.id}`);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
                            >
                              <Eye size={16} />
                              View Request
                            </button>

                            {request.status !== "cancelled" &&
                              request.status !== "completed" &&
                              request.status !== "payment_confirmed" && (
                                <button
                                  onClick={() => openCancelConfirm(request.id)}
                                  className="w-full text-left px-4 py-2 text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <Ban size={16} />
                                  Cancel Request
                                </button>
                              )}
                          </div>
                        )}
                      </div>

                      {/* Price Info */}
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary-700">
                          PHP {displayPrice?.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400 uppercase">
                          {request.paymentMethod}
                        </p>
                        {request.cancelledBy && (
                          <span className="badge-danger mt-1">
                            Cancelled by {request.cancelledBy}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {request.priceOverrideRequired && request.pendingFinalPrice && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-sm text-amber-900">
                          <p className="font-semibold">Pending final price review</p>
                          <p>
                            Suggested: PHP {request.suggestedPrice} | Requested final:
                            {" "}PHP {request.pendingFinalPrice}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => reviewPriceOverride(request.id, true)}
                            disabled={isReviewing}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
                          >
                            <CheckCircle2 size={16} />
                            {isReviewing ? "Working..." : "Approve"}
                          </button>
                          <button
                            onClick={() => reviewPriceOverride(request.id, false)}
                            disabled={isReviewing}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-60"
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Request Confirmation Modal */}
      {cancelConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-6 py-6">
              <div className="flex items-start gap-3">
                <TriangleAlert size={32} className="text-white shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-lg text-white">
                    Cancel Request?
                  </h3>
                  <p className="text-rose-100 text-sm mt-1">
                    This action cannot be undone
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-4">
              <div className="bg-rose-50 border-l-4 border-rose-600 px-4 py-3 rounded">
                <p className="text-sm text-rose-800 font-medium">
                  ⚠️ Warning
                </p>
                <p className="text-sm text-rose-700 mt-2">
                  Cancelling this request will:
                </p>
                <ul className="text-xs text-rose-700 mt-2 space-y-1 ml-2">
                  <li>• Notify the resident of the cancellation</li>
                  <li>• Release the assigned worker (if any)</li>
                  <li>• Apply cancellation penalties if applicable</li>
                  <li>• Mark the request as cancelled permanently</li>
                </ul>
              </div>

              <div className="bg-slate-50 px-4 py-3 rounded">
                <p className="text-xs text-slate-600">
                  <span className="font-semibold">Request ID:</span>{" "}
                  {cancelConfirmId.slice(-8)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setCancelConfirmId(null)}
                className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
              >
                Keep Request
              </button>
              <button
                onClick={confirmCancelRequest}
                disabled={processingId === cancelConfirmId}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingId === cancelConfirmId ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Ban size={16} />
                    Cancel Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
