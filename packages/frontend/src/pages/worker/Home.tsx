import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Clock, Power, Wallet } from "lucide-react";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { format12hRange } from "@/utils/time";
import {
  usePendingRequestPoolLiveRefresh,
  useRequestCollectionLiveRefresh,
} from "@/hooks/useRequestLiveRefresh";

interface Request {
  id: string;
  categoryName: string;
  itemName: string;
  description: string;
  suggestedPrice: number;
  finalPrice?: number;
  tipAmount?: number;
  schedule: { date: string; startTime: string; endTime: string };
  status: string;
  residentName: string;
}

const ACTION_REQUIRED_STATUSES = ["assigned"];
const ONGOING_STATUSES = [
  "accepted",
  "worker_arrived",
  "price_confirmed",
  "in_progress",
  "completed",
  "payment_submitted",
];
const ROOKIE_JOB_THRESHOLD = 5;

function getStatusLabel(status: string) {
  return status.replace(/_/g, " ").toUpperCase();
}

export function WorkerHome() {
  const { userProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
  const [ongoingRequests, setOngoingRequests] = useState<Request[]>([]);
  const [availableRequests, setAvailableRequests] = useState<Request[]>([]);

  const completedJobsCount =
    (userProfile as any)?.workerData?.completedJobsCount ?? 0;
  const isRookie = completedJobsCount < ROOKIE_JOB_THRESHOLD;

  useEffect(() => {
    if (typeof userProfile?.workerData?.isAvailable === "boolean") {
      setIsAvailable(userProfile.workerData.isAvailable);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchRequests();
  }, []);

  useRequestCollectionLiveRefresh(
    "assignedWorkerId",
    "==",
    userProfile?.uid,
    fetchRequests,
    Boolean(userProfile?.uid)
  );

  usePendingRequestPoolLiveRefresh(fetchRequests, isRookie);

  async function fetchRequests() {
    try {
      const [{ data: mine }, available] = await Promise.all([
        api.get("/api/requests/my"),
        isRookie
          ? api.get("/api/requests/available").catch(() => ({ data: { requests: [] } }))
          : Promise.resolve({ data: { requests: [] } }),
      ]);
      const allRequests: Request[] = mine.requests || [];

      setPendingRequests(
        allRequests.filter((request) =>
          ACTION_REQUIRED_STATUSES.includes(request.status)
        )
      );
      setOngoingRequests(
        allRequests.filter((request) => ONGOING_STATUSES.includes(request.status))
      );
      setAvailableRequests(available.data.requests || []);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  }

  const getLocationOrEmpty = async (): Promise<{ latitude?: number; longitude?: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.warning("Location unavailable — assignment accuracy may be reduced");
        resolve({});
        return;
      }

      setIsTogglingAvailability(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsTogglingAvailability(false);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (error) => {
          setIsTogglingAvailability(false);
          if (error.code === error.PERMISSION_DENIED) {
            toast.warning("Location permission denied — assignment accuracy may be reduced");
          } else {
            toast.warning("Unable to retrieve location — proceeding without it");
          }
          resolve({});
        }
      );
    });
  };

  const toggleAvailability = async () => {
    const newAvailability = !isAvailable;
    const uid = userProfile?.uid;
    if (!uid) {
      toast.error("User not found");
      return;
    }

    setIsTogglingAvailability(true);
    try {
      // If turning ON, capture location first
      let body: { latitude?: number; longitude?: number } = {};
      if (newAvailability) {
        body = await getLocationOrEmpty();
      }

      await api.patch(`/api/workers/${uid}/availability`, body);
      setIsAvailable(newAvailability);
      toast.success(
        `You are now ${newAvailability ? "available" : "unavailable"}`
      );
    } catch {
      toast.error("Failed to update availability");
    } finally {
      setIsTogglingAvailability(false);
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
      <div className="card flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Welcome, {userProfile?.firstName}</h2>
          <p className="text-slate-500 text-sm mt-1">
            {isAvailable
              ? "Available to receive jobs"
              : "Currently unavailable"}
          </p>
        </div>
        <button
          onClick={toggleAvailability}
          disabled={isTogglingAvailability}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            isAvailable
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {isTogglingAvailability ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
          ) : (
            <Power size={18} />
          )}
          {isTogglingAvailability ? "Getting location..." : isAvailable ? "Available" : "Unavailable"}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">
            {pendingRequests.length + (isRookie ? availableRequests.length : 0)}
          </p>
          <p className="text-sm text-slate-500">Pending Jobs</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent-600">
            {ongoingRequests.length}
          </p>
          <p className="text-sm text-slate-500">Ongoing Jobs</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-slate-700">
            {(userProfile as any)?.workerData?.averageRating?.toFixed(1) || "N/A"}
          </p>
          <p className="text-sm text-slate-500">Average Rating</p>
        </div>
        <Link
          to="/worker/checkout"
          className="card flex flex-col items-center justify-center hover:border-primary-300 transition-colors cursor-pointer"
        >
          <Wallet size={24} className="text-primary-600 mb-2" />
          <p className="text-sm text-slate-500">Withdraw Earnings</p>
        </Link>
      </div>

      {isRookie && availableRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase size={20} /> Open Pending Pool
          </h3>
          <p className="text-xs text-slate-500 -mt-1">
            No worker has accepted these yet. First-come, first-served while you build up
            your job count ({completedJobsCount}/{ROOKIE_JOB_THRESHOLD}).
          </p>
          <div className="space-y-3">
            {availableRequests.map((request) => (
              <Link
                key={request.id}
                to={`/worker/job/${request.id}`}
                className="card block border-yellow-200 hover:border-yellow-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{request.categoryName}</p>
                    <p className="text-sm text-slate-600">{request.itemName}</p>
                  </div>
                  <p className="text-lg font-bold text-primary-600">
                    PHP {request.suggestedPrice}
                  </p>
                </div>
                <p className="text-sm text-slate-700 mb-3 line-clamp-2">
                  {request.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {request.schedule.startTime
                      ? format12hRange(request.schedule.startTime, request.schedule.endTime)
                      : "No specified time"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    From: {request.residentName}
                  </p>
                  <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded">
                    Claim job
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase size={20} /> Pending Requests (Action Required)
          </h3>
          <div className="space-y-3">
            {pendingRequests.map((request) => {
              const hasTip = (request.tipAmount ?? 0) > 0;
              return (
              <Link
                key={request.id}
                to={`/worker/job/${request.id}`}
                className={`card block transition-all ${
                  hasTip
                    ? "border-amber-300 animate-tip-glow"
                    : "hover:border-primary-300"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{request.categoryName}</p>
                    <p className="text-sm text-slate-600">{request.itemName}</p>
                  </div>
                  <p className="text-lg font-bold text-primary-600">
                    PHP {request.suggestedPrice}
                  </p>
                </div>

                <p className="text-sm text-slate-700 mb-3 line-clamp-2">
                  {request.description}
                </p>

                {hasTip && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <span className="text-lg">🎁</span>
                    <span className="text-sm font-semibold text-amber-800">
                      Tip from Resident: PHP {request.tipAmount}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {request.schedule.startTime ? format12hRange(request.schedule.startTime, request.schedule.endTime) : "No specified time"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    From: {request.residentName}
                  </p>
                  <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded">
                    Accept or reject
                  </span>
                </div>
              </Link>
              );
            })}
          </div>
        </div>
      )}

      {ongoingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase size={20} /> Ongoing Jobs
          </h3>
          <div className="space-y-3">
            {ongoingRequests.map((request) => (
              <Link
                key={request.id}
                to={`/worker/job/${request.id}`}
                className="card block border-accent-300 hover:border-accent-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{request.categoryName}</p>
                    <p className="text-sm text-slate-600">{request.itemName}</p>
                  </div>
                  <p className="text-lg font-bold text-accent-600">
                    PHP {request.finalPrice || request.suggestedPrice}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {request.schedule.startTime ? format12hRange(request.schedule.startTime, request.schedule.endTime) : "No specified time"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Status: {getStatusLabel(request.status)}
                  </p>
                  <span className="text-xs bg-accent-50 text-accent-700 px-2 py-1 rounded">
                    Open job
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {pendingRequests.length === 0 &&
        ongoingRequests.length === 0 &&
        availableRequests.length === 0 && (
        <div className="card text-center py-12">
          <Briefcase size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No jobs assigned yet</p>
          <p className="text-sm text-slate-400 mt-2">
            {isAvailable
              ? "Make sure you're available and check back soon."
              : "Set yourself as available to receive job assignments"}
          </p>
        </div>
      )}
    </div>
  );
}
