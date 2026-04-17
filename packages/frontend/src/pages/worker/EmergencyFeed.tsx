import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Siren,
  MapPin,
  Users as UsersIcon,
  HeartHandshake,
  CheckCircle,
  Award,
} from "lucide-react";
import { BackButton } from "@/components/common/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/services/api";

interface MyApplication {
  workerId: string;
  approvalStatus: "pending" | "approved" | "rejected";
  creditAwarded?: number;
}

interface Emergency {
  id: string;
  title: string;
  requesterName: string;
  categoryNames: string[];
  details: string;
  needsList: string[];
  photoUrls: string[];
  locationAddress: string;
  location: any;
  affectedFamilies: number;
  durationHours: number;
  status: string;
  applicants: MyApplication[];
  canApply?: boolean;
}

export function WorkerEmergencyFeed() {
  const { userProfile } = useAuth();
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  async function fetchFeed() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/emergencies?status=active");
      setEmergencies(data.emergencies || []);
    } catch {
      toast.error("Failed to load emergencies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFeed();
  }, []);

  async function apply(id: string) {
    setApplying(id);
    try {
      await api.post(`/api/emergencies/${id}/apply`);
      toast.success("Application submitted — awaiting admin approval");
      await fetchFeed();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to apply");
    } finally {
      setApplying(null);
    }
  }

  function getMyApplication(e: Emergency): MyApplication | undefined {
    if (!userProfile?.uid) return undefined;
    return (e.applicants ?? []).find((a) => a.workerId === userProfile.uid);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton to="/worker/home" label="Back" />

      <div className="mb-6">
        <h2 className="page-title flex items-center gap-2">
          <Siren size={28} className="text-rose-600" />
          Bayanihan Opportunities
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Active emergencies matching your specialization.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : emergencies.length === 0 ? (
        <div className="card text-center py-12">
          <Siren size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            No active emergencies right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emergencies.map((e) => {
            const mine = getMyApplication(e);
            return (
              <div key={e.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg">
                      {e.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Reported by {e.requesterName}
                    </p>
                  </div>
                  {mine ? (
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={
                          mine.approvalStatus === "approved"
                            ? "badge-success"
                            : mine.approvalStatus === "rejected"
                            ? "badge-danger"
                            : "badge-warning"
                        }
                      >
                        {mine.approvalStatus === "pending"
                          ? "Pending approval"
                          : mine.approvalStatus === "approved"
                          ? "Approved"
                          : "Rejected"}
                      </span>
                      {mine.creditAwarded !== undefined && (
                        <span className="text-xs text-emerald-700 flex items-center gap-1 font-semibold">
                          <Award size={12} />
                          {mine.creditAwarded} credit(s) earned
                        </span>
                      )}
                    </div>
                  ) : e.canApply === false ? (
                    <span className="text-xs text-slate-500 font-medium px-3 py-1.5 bg-slate-100 rounded-full">
                      View only
                    </span>
                  ) : (
                    <button
                      onClick={() => apply(e.id)}
                      disabled={applying === e.id}
                      className="btn-primary text-sm flex items-center gap-1.5"
                    >
                      <CheckCircle size={14} />
                      {applying === e.id ? "Applying..." : "Apply to Help"}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {e.categoryNames.map((name) => (
                    <span key={name} className="badge-primary">
                      {name}
                    </span>
                  ))}
                </div>

                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {e.details}
                </p>

                {e.photoUrls?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {e.photoUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`photo-${i}`}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {e.needsList?.length > 0 && (
                  <div className="bg-accent-50 border border-accent-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-accent-800 mb-2 flex items-center gap-1">
                      <HeartHandshake size={12} /> Residents can donate
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {e.needsList.map((n) => (
                        <span
                          key={n}
                          className="bg-white text-accent-800 border border-accent-200 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    {e.locationAddress}
                  </span>
                  {e.location && (
                    <a
                      href={`https://www.google.com/maps?q=${
                        e.location.latitude ?? e.location._latitude
                      },${e.location.longitude ?? e.location._longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      View on map
                    </a>
                  )}
                  <span className="flex items-center gap-1">
                    <UsersIcon size={12} />
                    {e.affectedFamilies} families
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
