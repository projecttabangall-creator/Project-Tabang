import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Star,
  Briefcase,
  UserPlus,
  Shield,
} from "lucide-react";
import api from "@/services/api";

interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  contactNumber: string;
  creditPoints: number;
  isVerified: boolean;
  isActive: boolean;
  accountStatus: string;
  workerData?: {
    specialization: string;
    averageRating: number;
    completedJobsCount: number;
    acceptanceRate: number;
    isAvailable: boolean;
  };
}

export function WorkerList() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchWorkers();
  }, [statusFilter]);

  async function fetchWorkers() {
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const { data } = await api.get(`/api/workers${params}`);
      setWorkers(data.workers);
    } catch {
      toast.error("Failed to load workers");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(workerId: string) {
    try {
      await api.patch(`/api/workers/${workerId}/verify`);
      toast.success("Worker verified and activated");
      fetchWorkers();
    } catch {
      toast.error("Failed to verify worker");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Workers</h2>
        <Link
          to="/admin/workers/register"
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <UserPlus size={16} /> Register Worker
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "verified", label: "Verified" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              statusFilter === tab.value
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {workers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No workers found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map((worker) => (
            <div key={worker.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center text-accent-700 font-bold text-sm">
                  {worker.firstName[0]}
                  {worker.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold">
                    {worker.lastName}, {worker.firstName}{" "}
                    {worker.middleInitial ? `${worker.middleInitial}.` : ""}
                  </p>
                  <p className="text-sm text-gray-500">
                    {worker.contactNumber}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Star size={12} />
                      {worker.workerData?.averageRating?.toFixed(1) || "N/A"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase size={12} />
                      {worker.workerData?.completedJobsCount || 0} jobs
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield size={12} />
                      {worker.creditPoints}/5 credit
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Status badge */}
                {worker.isVerified ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <CheckCircle size={12} /> Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                    <XCircle size={12} /> Pending
                  </span>
                )}

                {/* Verify button */}
                {!worker.isVerified && (
                  <button
                    onClick={() => handleVerify(worker.id)}
                    className="btn-primary text-xs py-1 px-3"
                  >
                    Verify
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
