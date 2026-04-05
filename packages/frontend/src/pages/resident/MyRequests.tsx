import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Clock, MapPin, Star } from "lucide-react";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface Request {
  id: string;
  categoryName: string;
  itemName: string;
  description: string;
  suggestedPrice: number;
  finalPrice?: number;
  location: { latitude: number; longitude: number };
  schedule: { date: string; startTime: string; endTime: string };
  status: string;
  workerName?: string;
  workerRating?: number;
  completedAt?: string;
  createdAt?: string;
}

type Tab = "active" | "recent" | "history";

const ACTIVE_STATUSES = [
  "assigned",
  "accepted",
  "worker_arrived",
  "price_confirmed",
  "in_progress",
];
const COMPLETED_STATUSES = [
  "completed",
  "payment_submitted",
  "payment_confirmed",
];

export function MyRequests() {
  useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [activeTab, requests]);

  const fetchRequests = async () => {
    try {
      const { data } = await api.get("/api/requests/my?role=resident");
      setRequests(data.requests || []);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  };

  const filterRequests = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let filtered: Request[] = [];

    if (activeTab === "active") {
      filtered = requests.filter((r) => ACTIVE_STATUSES.includes(r.status));
    } else if (activeTab === "recent") {
      filtered = requests.filter((r) => {
        const isCompleted = COMPLETED_STATUSES.includes(r.status);
        const completedDate = r.completedAt ? new Date(r.completedAt) : null;
        const isRecent = completedDate ? completedDate > thirtyDaysAgo : false;
        return isCompleted && isRecent;
      });
    } else if (activeTab === "history") {
      filtered = requests.filter((r) => {
        const isCompleted = COMPLETED_STATUSES.includes(r.status);
        const completedDate = r.completedAt ? new Date(r.completedAt) : null;
        const isOld = completedDate ? completedDate <= thirtyDaysAgo : false;
        return isCompleted && isOld;
      });
    }

    setFilteredRequests(filtered);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      assigned: "bg-yellow-50 text-yellow-700 border-yellow-200",
      accepted: "bg-blue-50 text-blue-700 border-blue-200",
      worker_arrived: "bg-purple-50 text-purple-700 border-purple-200",
      price_confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
      in_progress: "bg-accent-50 text-accent-700 border-accent-200",
      completed: "bg-green-50 text-green-700 border-green-200",
      payment_submitted: "bg-green-50 text-green-700 border-green-200",
      payment_confirmed: "bg-green-100 text-green-800 border-green-300",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    return colors[status] || "bg-gray-50 text-gray-700 border-gray-200";
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
          <p className="text-gray-600">
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
      <div className="flex gap-2 border-b border-gray-200">
        {(["active", "recent", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <span className="ml-2 inline-block bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                {filteredRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="card text-center py-12">
          <Briefcase size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">
            {activeTab === "active"
              ? "No active requests"
              : activeTab === "recent"
              ? "No recent requests"
              : "No history"}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {activeTab === "active"
              ? "Submit a new service request to get started"
              : "Your completed requests will appear here"}
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
                  <p className="text-sm text-gray-600">{request.itemName}</p>
                </div>
                <p className="text-lg font-bold text-primary-600">
                  ₱{request.finalPrice || request.suggestedPrice}
                </p>
              </div>

              <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                {request.description}
              </p>

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {request.schedule.date} {request.schedule.startTime}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {request.location.latitude.toFixed(4)},{" "}
                  {request.location.longitude.toFixed(4)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex-1">
                  {request.workerName && (
                    <p className="text-xs text-gray-600">
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
                <span className="text-xs text-gray-400">
                  {ACTIVE_STATUSES.includes(request.status)
                    ? "Ongoing"
                    : "Completed"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
