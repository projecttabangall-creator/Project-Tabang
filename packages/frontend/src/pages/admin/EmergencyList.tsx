import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Siren,
  Plus,
  MapPin,
  Users as UsersIcon,
  Clock,
} from "lucide-react";
import { BackButton } from "@/components/common/BackButton";
import api from "@/services/api";

interface EmergencyItem {
  id: string;
  title: string;
  categoryNames: string[];
  locationAddress: string;
  affectedFamilies: number;
  durationHours: number;
  status: "active" | "completed" | "cancelled";
  applicants?: Array<{ workerId: string; approvalStatus: string }>;
  createdAt?: any;
}

const STATUS_TABS: Array<{ key: EmergencyItem["status"]; label: string }> = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE: Record<string, string> = {
  active: "badge-success",
  completed: "badge-neutral",
  cancelled: "badge-danger",
};

export function EmergencyList() {
  const [statusFilter, setStatusFilter] =
    useState<EmergencyItem["status"]>("active");
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmergencies(statusFilter);
  }, [statusFilter]);

  async function fetchEmergencies(status: EmergencyItem["status"]) {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/emergencies?status=${status}`);
      setEmergencies(data.emergencies || []);
    } catch {
      toast.error("Failed to load emergencies");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Siren size={28} className="text-rose-600" />
            Emergency / Bayanihan
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Broadcast community emergencies and coordinate volunteer workers.
          </p>
        </div>
        <Link
          to="/admin/emergencies/new"
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus size={16} /> Create Emergency
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              statusFilter === tab.key
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : emergencies.length === 0 ? (
        <div className="card text-center py-12">
          <Siren size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            No {statusFilter} emergencies.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emergencies.map((e) => {
            const pendingApplicants = (e.applicants ?? []).filter(
              (a) => a.approvalStatus === "pending"
            ).length;
            return (
              <Link
                key={e.id}
                to={`/admin/emergencies/${e.id}`}
                className="card block hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 truncate">
                        {e.title}
                      </h3>
                      <span className={STATUS_BADGE[e.status] || "badge-neutral"}>
                        {e.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {e.categoryNames?.map((name) => (
                        <span key={name} className="badge-primary">
                          {name}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {e.locationAddress}
                      </span>
                      <span className="flex items-center gap-1">
                        <UsersIcon size={12} />
                        {e.affectedFamilies} families
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {e.durationHours}h
                      </span>
                      <span>
                        {e.applicants?.length ?? 0} applicants
                        {pendingApplicants > 0 && (
                          <span className="ml-1 text-accent-600 font-semibold">
                            ({pendingApplicants} pending)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
