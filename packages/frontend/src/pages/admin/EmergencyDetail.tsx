import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import {
  Siren,
  MapPin,
  Users as UsersIcon,
  Clock,
  Gift,
  CheckCircle,
  XCircle,
  Award,
  HeartHandshake,
} from "lucide-react";
import { BackButton } from "@/components/common/BackButton";
import { firestore } from "@/config/firebase";
import api from "@/services/api";

interface Applicant {
  workerId: string;
  workerName: string;
  appliedAt: any;
  approvalStatus: "pending" | "approved" | "rejected";
  approvedAt?: any;
  creditAwarded?: number;
  awardedAt?: any;
}

interface Emergency {
  id: string;
  title: string;
  requesterName: string;
  requesterContact: string;
  categoryNames: string[];
  details: string;
  needsList: string[];
  photoUrls: string[];
  locationAddress: string;
  location: any;
  affectedFamilies: number;
  durationHours: number;
  creditReward?: number;
  status: "active" | "completed" | "cancelled";
  applicants: Applicant[];
  createdAt: any;
}

const APPLICANT_BADGE: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
};

function formatDate(ts: any): string {
  if (!ts) return "—";
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
  return date.toLocaleString();
}

export function EmergencyDetail() {
  const { emergencyId } = useParams<{ emergencyId: string }>();
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const [loading, setLoading] = useState(true);
  const [awardTarget, setAwardTarget] = useState<string | null>(null);
  const [awardAmount, setAwardAmount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!emergencyId) return;
    const unsub = onSnapshot(
      doc(firestore, "emergencies", emergencyId),
      (snap) => {
        if (!snap.exists()) {
          setEmergency(null);
          setLoading(false);
          return;
        }
        const d = snap.data()!;
        setEmergency({
          id: snap.id,
          ...d,
          applicants: Array.isArray(d.applicants) ? d.applicants : [],
          categoryNames: Array.isArray(d.categoryNames) ? d.categoryNames : [],
          photoUrls: Array.isArray(d.photoUrls) ? d.photoUrls : [],
          needsList: Array.isArray(d.needsList) ? d.needsList : [],
        } as any);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [emergencyId]);

  async function reviewApplicant(
    workerId: string,
    approvalStatus: "approved" | "rejected"
  ) {
    if (!emergencyId) return;
    try {
      await api.patch(
        `/api/emergencies/${emergencyId}/applicants/${workerId}/approve`,
        { approvalStatus }
      );
      toast.success(`Applicant ${approvalStatus}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update applicant");
    }
  }

  async function handleAwardCredit(workerId: string) {
    if (!emergencyId || !awardAmount) return;
    setIsSubmitting(true);
    try {
      await api.patch(
        `/api/emergencies/${emergencyId}/applicants/${workerId}/award`,
        { amount: awardAmount }
      );
      toast.success(`Awarded ${awardAmount} credit point(s)`);
      setAwardTarget(null);
      setAwardAmount(1);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to award credits");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function changeStatus(action: "complete" | "cancel") {
    if (!emergencyId) return;
    if (!confirm(`Are you sure you want to ${action} this emergency?`)) return;
    try {
      await api.patch(`/api/emergencies/${emergencyId}/${action}`);
      toast.success(`Emergency ${action === "complete" ? "completed" : "cancelled"}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!emergency) {
    return (
      <div className="max-w-3xl mx-auto">
        <BackButton to="/admin/emergencies" label="Back" />
        <div className="card text-center py-12">
          <p className="text-slate-500">Emergency not found.</p>
        </div>
      </div>
    );
  }

  const applicants = emergency.applicants ?? [];
  const isActive = emergency.status === "active";

  return (
    <div className="max-w-4xl mx-auto">
      <BackButton to="/admin/emergencies" label="Back to Emergencies" />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Siren size={28} className="text-rose-600" />
            {emergency.title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                emergency.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : emergency.status === "cancelled"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {emergency.status.toUpperCase()}
            </span>
            <span className="text-xs text-slate-500">
              Created {formatDate(emergency.createdAt)}
            </span>
          </div>
        </div>

        {isActive && (
          <div className="flex gap-2">
            <button
              onClick={() => changeStatus("complete")}
              className="btn-primary flex items-center gap-1.5"
            >
              <CheckCircle size={14} /> Complete
            </button>
            <button
              onClick={() => changeStatus("cancel")}
              className="btn-danger flex items-center gap-1.5"
            >
              <XCircle size={14} /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* Summary card */}
      <div className="card space-y-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 text-xs">Requester</p>
            <p className="font-semibold">{emergency.requesterName}</p>
            <p className="text-slate-600">{emergency.requesterContact}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs flex items-center gap-1">
              <MapPin size={12} /> Location
            </p>
            <p className="font-semibold">{emergency.locationAddress}</p>
            {emergency.location && (
              <p className="text-xs text-slate-500">
                {emergency.location.latitude ?? emergency.location._latitude}
                {", "}
                {emergency.location.longitude ?? emergency.location._longitude}
              </p>
            )}
          </div>
          <div>
            <p className="text-slate-500 text-xs flex items-center gap-1">
              <UsersIcon size={12} /> Affected Families
            </p>
            <p className="font-semibold">{emergency.affectedFamilies}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs flex items-center gap-1">
              <Clock size={12} /> Duration
            </p>
            <p className="font-semibold">{emergency.durationHours} hours</p>
          </div>
          {emergency.creditReward !== undefined && (
            <div className="sm:col-span-2 bg-accent-50 border border-accent-200 rounded-lg p-3">
              <p className="text-xs text-accent-700 flex items-center gap-1">
                <Gift size={12} /> Credit Reward (admin-only)
              </p>
              <p className="font-bold text-accent-800 text-lg">
                {emergency.creditReward} credit point(s)
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-slate-500 text-xs mb-1">Worker Specializations</p>
          <div className="flex flex-wrap gap-1.5">
            {emergency.categoryNames.map((name) => (
              <span key={name} className="badge-primary">
                {name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-slate-500 text-xs mb-1">Details</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {emergency.details}
          </p>
        </div>

        {emergency.needsList?.length > 0 && (
          <div>
            <p className="text-slate-500 text-xs mb-1 flex items-center gap-1">
              <HeartHandshake size={12} /> Needs / Donation Items
            </p>
            <div className="flex flex-wrap gap-1.5">
              {emergency.needsList.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center bg-accent-50 text-accent-800 border border-accent-200 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {emergency.photoUrls?.length > 0 && (
          <div>
            <p className="text-slate-500 text-xs mb-1">Photos</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {emergency.photoUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt={`photo-${i}`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Applicants */}
      <div className="card">
        <h3 className="section-title mb-3">
          Applicants ({applicants.length})
        </h3>

        {applicants.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No workers have applied yet.
          </p>
        ) : (
          <div className="space-y-2">
            {applicants.map((a) => (
              <div
                key={a.workerId}
                className="border border-slate-200 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/admin/workers/${a.workerId}`}
                      className="font-semibold text-slate-900 hover:text-primary-600"
                    >
                      {a.workerName || a.workerId}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Applied {formatDate(a.appliedAt)}
                    </p>
                    <span
                      className={`mt-1 inline-block ${
                        APPLICANT_BADGE[a.approvalStatus] || "badge-neutral"
                      }`}
                    >
                      {a.approvalStatus}
                    </span>
                    {a.creditAwarded !== undefined && (
                      <div className="mt-2 text-xs text-emerald-700 flex items-center gap-1">
                        <Award size={12} />
                        {a.creditAwarded} credit(s) awarded
                        {a.awardedAt && (
                          <span className="text-slate-500">
                            · {formatDate(a.awardedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {a.approvalStatus === "pending" && isActive && (
                      <>
                        <button
                          onClick={() =>
                            reviewApplicant(a.workerId, "approved")
                          }
                          className="btn-primary text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            reviewApplicant(a.workerId, "rejected")
                          }
                          className="btn-secondary text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {a.approvalStatus === "approved" &&
                      a.creditAwarded === undefined && (
                        <button
                          onClick={() => {
                            setAwardTarget(a.workerId);
                            setAwardAmount(emergency.creditReward ?? 1);
                          }}
                          className="btn-accent text-xs flex items-center gap-1"
                        >
                          <Award size={12} /> Award Credit
                        </button>
                      )}
                  </div>
                </div>

                {awardTarget === a.workerId && (
                  <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                    <label className="label">Credit points to award (1–5)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={awardAmount}
                        onChange={(e) => setAwardAmount(Number(e.target.value))}
                        className="input-field w-28"
                      />
                      <button
                        onClick={() => handleAwardCredit(a.workerId)}
                        disabled={isSubmitting}
                        className="btn-primary text-sm"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setAwardTarget(null)}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
