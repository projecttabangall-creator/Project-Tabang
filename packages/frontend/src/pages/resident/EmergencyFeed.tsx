import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Siren,
  MapPin,
  Users as UsersIcon,
  HeartHandshake,
} from "lucide-react";
import { BackButton } from "@/components/common/BackButton";
import api from "@/services/api";

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
  status: string;
}

export function ResidentEmergencyFeed() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/emergencies?status=active")
      .then(({ data }) => setEmergencies(data.emergencies || []))
      .catch(() => toast.error("Failed to load emergencies"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton to="/resident/requests" label="Back" />

      <div className="mb-6">
        <h2 className="page-title flex items-center gap-2">
          <Siren size={28} className="text-rose-600" />
          Community Emergencies
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Active emergencies and bayanihan calls from the barangay.
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
          <p className="text-xs text-slate-400 mt-1">
            You'll be notified when the barangay broadcasts one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emergencies.map((e) => (
            <div key={e.id} className="card space-y-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{e.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reported by {e.requesterName}
                </p>
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
                        alt={`emergency-${i}`}
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                    </a>
                  ))}
                </div>
              )}

              {e.needsList?.length > 0 && (
                <div className="bg-accent-50 border border-accent-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-accent-800 mb-2 flex items-center gap-1">
                    <HeartHandshake size={12} /> Needs / Donation Items
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
                  {e.affectedFamilies} families affected
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
