import { useAuth } from "@/contexts/AuthContext";
import { Shield, Star, Phone, Briefcase } from "lucide-react";

export function WorkerProfile() {
  const { userProfile } = useAuth();

  if (!userProfile) return null;

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6">My Profile</h2>

      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center text-accent-700 text-xl font-bold">
            {userProfile.firstName[0]}
            {userProfile.lastName[0]}
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {userProfile.firstName} {userProfile.lastName}
            </h3>
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Shield size={14} />
              {userProfile.isVerified ? "Verified" : "Pending Verification"}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Phone size={16} className="text-gray-400" />
            <span>{userProfile.contactNumber}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Star size={16} className="text-gray-400" />
            <span>Credit Points: {userProfile.creditPoints}/5</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Briefcase size={16} className="text-gray-400" />
            <span>0 Completed Jobs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
