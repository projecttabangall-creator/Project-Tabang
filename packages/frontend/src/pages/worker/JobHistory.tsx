import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Clock, MapPin, Star } from "lucide-react";
import { BackButton } from "@/components/common/BackButton";
import api from "@/services/api";

interface Request {
  id: string;
  categoryName: string;
  itemName: string;
  description: string;
  suggestedPrice: number;
  finalPrice?: number;
  status: string;
  residentName?: string;
  yourRating?: number;
  schedule: {
    date: string | { _seconds: number };
    startTime: string;
    endTime: string;
  };
  location: {
    _latitude?: number;
    _longitude?: number;
    latitude?: number;
    longitude?: number;
  };
  completedAt?: { _seconds: number };
  updatedAt?: { _seconds: number };
}

type Tab = "payment" | "history";

const PAYMENT_STATUSES = ["completed", "payment_submitted"];
const HISTORY_STATUSES = ["payment_confirmed", "cancelled"];

function formatDate(value: string | { _seconds: number } | undefined) {
  if (!value) return "No date";
  if (typeof value === "object" && "_seconds" in value) {
    return new Date(value._seconds * 1000).toLocaleDateString();
  }
  return value;
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    payment_submitted: "bg-teal-50 text-teal-700 border-teal-200",
    payment_confirmed: "bg-primary-50 text-primary-700 border-primary-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };

  return colors[status] || "bg-slate-50 text-slate-700 border-slate-200";
}

function getStatusLabel(status: string) {
  return status.replace(/_/g, " ").toUpperCase();
}

export function WorkerJobHistory() {
  const [activeTab, setActiveTab] = useState<Tab>("payment");
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);

  useEffect(() => {
    async function fetchRequests() {
      try {
        const { data } = await api.get("/api/requests/my");
        setRequests(data.requests || []);
      } catch {
        toast.error("Failed to load worker job history");
      } finally {
        setIsLoading(false);
      }
    }

    fetchRequests();
  }, []);

  const groupedRequests = useMemo(
    () => ({
      payment: requests.filter((request) =>
        PAYMENT_STATUSES.includes(request.status)
      ),
      history: requests.filter((request) =>
        HISTORY_STATUSES.includes(request.status)
      ),
    }),
    [requests]
  );

  const filteredRequests = groupedRequests[activeTab];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton to="/worker/home" label="Back" />

      <div>
        <h2 className="text-2xl font-bold mb-2">Job History</h2>
        <p className="text-slate-600">
          Review completed, paid, and cancelled jobs from your worker account.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent-600">
            {groupedRequests.payment.length}
          </p>
          <p className="text-sm text-slate-500">Pending Payment</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">
            {groupedRequests.history.length}
          </p>
          <p className="text-sm text-slate-500">History Records</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {(["payment", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab === "payment" ? "Pending Payment" : "History"}
            {groupedRequests[tab].length > 0 && (
              <span className="ml-2 inline-block bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                {groupedRequests[tab].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredRequests.length === 0 ? (
        <div className="card text-center py-12">
          <Briefcase size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">
            {activeTab === "payment"
              ? "No jobs awaiting payment"
              : "No job history yet"}
          </p>
          <p className="text-sm text-slate-400 mt-2">
            {activeTab === "payment"
              ? "Completed jobs waiting for resident payment will appear here."
              : "Confirmed and cancelled jobs will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <Link
              key={request.id}
              to={`/worker/job/${request.id}`}
              className="card hover:border-primary-300 transition-colors block"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                <p className="text-lg font-bold text-primary-600 whitespace-nowrap">
                  PHP {request.finalPrice || request.suggestedPrice}
                </p>
              </div>

              <p className="text-sm text-slate-700 mb-3 line-clamp-2">
                {request.description}
              </p>

              <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2 mb-3">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {formatDate(request.schedule?.date)} {request.schedule?.startTime}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {(request.location?._latitude ?? request.location?.latitude ?? 0).toFixed(4)},
                  {" "}
                  {(request.location?._longitude ?? request.location?.longitude ?? 0).toFixed(4)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-600 truncate">
                    Resident: <span className="font-medium">{request.residentName || "N/A"}</span>
                  </p>
                  {typeof request.yourRating === "number" && (
                    <div className="flex items-center gap-1 text-xs text-yellow-600 mt-1">
                      <Star size={12} fill="currentColor" />
                      <span>{request.yourRating.toFixed(1)} resident rating</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  Open details
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
