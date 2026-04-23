import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Clock, MapPin, Star, Edit2 } from "lucide-react";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface Request {
  id: string;
  categoryName: string;
  itemName: string;
  description: string;
  suggestedPrice: number;
  finalPrice?: number;
  location: { _latitude?: number; _longitude?: number; latitude?: number; longitude?: number };
  schedule: { date: string | { _seconds: number }; startTime: string; endTime: string };
  status: string;
  workerName?: string;
  workerRating?: number;
  completedAt?: any;
  updatedAt?: any;
  createdAt?: any;
}

type Tab = "active" | "payment" | "history";

const ACTIVE_STATUSES = [
  "pending",
  "assigned",
  "accepted",
  "worker_arrived",
  "price_confirmed",
  "in_progress",
];
const PAYMENT_STATUSES = ["completed", "payment_submitted"];
const COMPLETED_STATUSES = ["payment_confirmed"];
const HISTORY_STATUSES = [...COMPLETED_STATUSES, "cancelled"];

export function MyRequests() {
  useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await api.get("/api/requests/my");
      setRequests(data.requests || []);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  };

  const requestGroups = useMemo(
    () => ({
      active: requests.filter((request) =>
        ACTIVE_STATUSES.includes(request.status)
      ),
      payment: requests.filter((request) =>
        PAYMENT_STATUSES.includes(request.status)
      ),
      history: requests.filter((request) =>
        HISTORY_STATUSES.includes(request.status)
      ),
    }),
    [requests]
  );

  const filteredRequests = requestGroups[activeTab];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-orange-50 text-orange-700 border-orange-200",
      assigned: "bg-yellow-50 text-yellow-700 border-yellow-200",
      accepted: "bg-primary-50 text-primary-700 border-primary-200",
      worker_arrived: "bg-purple-50 text-purple-700 border-purple-200",
      price_confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
      in_progress: "bg-accent-50 text-accent-700 border-accent-200",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      payment_submitted: "bg-emerald-50 text-emerald-700 border-emerald-200",
      payment_confirmed: "bg-emerald-100 text-emerald-800 border-emerald-300",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    return colors[status] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ").toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Service Requests</h2>
          <p className="text-slate-600">
            Track and manage all your service requests
          </p>
        </div>
        <Link
          to="/resident/request/new"
          className="btn-primary whitespace-nowrap"
        >
          + New Request
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {(["active", "payment", "history"] as const).map((tab) => {
          const tabLabel = tab === "payment" ? "Pending Payment" : tab.charAt(0).toUpperCase() + tab.slice(1);
          const tabCount = requestGroups[tab].length;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tabLabel}
              {tabCount > 0 && (
                <span className="ml-2 inline-block bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                  {tabCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="card text-center py-12">
          <Briefcase size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">
            {activeTab === "active"
              ? "No active requests"
              : activeTab === "payment"
              ? "No pending payments"
              : "No history"}
          </p>
          <p className="text-sm text-slate-400 mt-2">
            {activeTab === "active"
              ? "Submit a new service request to get started"
              : activeTab === "payment"
              ? "Your completed jobs awaiting payment will appear here"
              : "Completed and cancelled requests will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <Link
              key={request.id}
              to={`/resident/request/${request.id}`}
              className="card hover:border-primary-300 transition-colors block"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{request.categoryName}</p>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded border ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {getStatusLabel(request.status)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{request.itemName}</p>
                </div>
                <p className="text-lg font-bold text-primary-600">
                  ₱{request.finalPrice || request.suggestedPrice}
                </p>
              </div>

              <p className="text-sm text-slate-700 mb-3 line-clamp-2">
                {request.description}
              </p>

              <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {typeof request.schedule.date === "object"
                    ? new Date(request.schedule.date._seconds * 1000).toLocaleDateString()
                    : request.schedule.date}{" "}
                  {request.schedule.startTime ? `${request.schedule.startTime}` : "No specified time"}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {(request.location._latitude ?? request.location.latitude ?? 0).toFixed(4)},{" "}
                  {(request.location._longitude ?? request.location.longitude ?? 0).toFixed(4)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex-1">
                  {request.workerName && (
                    <p className="text-xs text-slate-600">
                      Worker:{" "}
                      <span className="font-medium">{request.workerName}</span>
                    </p>
                  )}
                  {request.workerRating && (
                    <div className="flex items-center gap-1 text-xs text-yellow-600 mt-1">
                      <Star size={12} fill="currentColor" />
                      <span>{request.workerRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(request.status === "pending" || request.status === "assigned") && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/resident/request/${request.id}/edit-schedule`);
                      }}
                      className="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Edit2 size={12} />
                      Edit Schedule
                    </button>
                  )}
                  <span className="text-xs text-slate-400">
                    {ACTIVE_STATUSES.includes(request.status)
                      ? "Ongoing"
                      : request.status === "cancelled"
                      ? "Cancelled"
                      : "Completed"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
