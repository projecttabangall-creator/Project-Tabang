import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Power, Clock } from "lucide-react";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface Request {
  id: string;
  categoryName: string;
  itemName: string;
  description: string;
  suggestedPrice: number;
  location: { latitude: number; longitude: number };
  schedule: { date: string; startTime: string; endTime: string };
  status: string;
  residentName: string;
}

export function WorkerHome() {
  const { userProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
  const [ongoingRequests, setOngoingRequests] = useState<Request[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const [pending, ongoing] = await Promise.all([
        api.get("/api/requests/my?role=worker&status=assigned"),
        api.get("/api/requests/my?role=worker&status=in_progress"),
      ]);

      setPendingRequests(pending.data.requests || []);
      setOngoingRequests(ongoing.data.requests || []);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAvailability = async () => {
    try {
      await api.patch(`/api/workers/${userProfile?.uid}/availability`);
      setIsAvailable(!isAvailable);
      toast.success(
        `You are now ${!isAvailable ? "available" : "unavailable"}`
      );
    } catch {
      toast.error("Failed to update availability");
    }
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
      {/* Header */}
      <div className="card flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Welcome, {userProfile?.firstName}</h2>
          <p className="text-gray-500 text-sm mt-1">
            {isAvailable ? "✓ Available to receive jobs" : "✗ Currently unavailable"}
          </p>
        </div>
        <button
          onClick={toggleAvailability}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isAvailable
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <Power size={18} />
          {isAvailable ? "Available" : "Unavailable"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">
            {pendingRequests.length}
          </p>
          <p className="text-sm text-gray-500">Pending Jobs</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent-600">
            {ongoingRequests.length}
          </p>
          <p className="text-sm text-gray-500">Ongoing Jobs</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-700">
            {(userProfile as any)?.workerData?.averageRating?.toFixed(1) || "N/A"}
          </p>
          <p className="text-sm text-gray-500">Average Rating</p>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase size={20} /> Pending Requests (Action Required)
          </h3>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <Link
                key={req.id}
                to={`/worker/job/${req.id}`}
                className="card hover:border-primary-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{req.categoryName}</p>
                    <p className="text-sm text-gray-600">{req.itemName}</p>
                  </div>
                  <p className="text-lg font-bold text-primary-600">
                    ₱{req.suggestedPrice}
                  </p>
                </div>

                <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                  {req.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {req.schedule.startTime} - {req.schedule.endTime}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    From: {req.residentName}
                  </p>
                  <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded">
                    Accept or Reject?
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ongoing Requests */}
      {ongoingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase size={20} /> Ongoing Jobs
          </h3>
          <div className="space-y-3">
            {ongoingRequests.map((req) => (
              <Link
                key={req.id}
                to={`/worker/job/${req.id}`}
                className="card border-accent-300 hover:border-accent-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{req.categoryName}</p>
                    <p className="text-sm text-gray-600">{req.itemName}</p>
                  </div>
                  <p className="text-lg font-bold text-accent-600">
                    ₱{req.suggestedPrice}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {req.schedule.startTime} - {req.schedule.endTime}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Status: {req.status}
                  </p>
                  <span className="text-xs bg-accent-50 text-accent-700 px-2 py-1 rounded">
                    In Progress
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {pendingRequests.length === 0 && ongoingRequests.length === 0 && (
        <div className="card text-center py-12">
          <Briefcase size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No jobs assigned yet</p>
          <p className="text-sm text-gray-400 mt-2">
            {isAvailable
              ? "Make sure you're available and check back soon!"
              : "Set yourself as available to receive job assignments"}
          </p>
        </div>
      )}
    </div>
  );
}
