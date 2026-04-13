import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Star, Phone, Mail, Lock, Camera } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/utils/uploadFile";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";

export function ResidentProfile() {
  const { userProfile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!userProfile) return null;

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const photoUrl = await uploadFile(
        `users/${userProfile!.uid}/profile.jpg`,
        file
      );
      await api.patch("/api/auth/profile", { profilePhotoUrl: photoUrl });
      await refreshProfile();
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <BackButton to="/resident/requests" label="Back" />
      <h2 className="text-2xl font-bold mb-6">My Profile</h2>

      <div className="card">
        {/* Avatar with upload */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {userProfile.profilePhotoUrl ? (
              <img
                src={userProfile.profilePhotoUrl}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xl font-bold">
                {userProfile.firstName[0]}
                {userProfile.lastName[0]}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {userProfile.firstName} {userProfile.lastName}
              {userProfile.isVerified && (
                <Lock size={14} className="text-slate-400" />
              )}
            </h3>
            <span
              className={`inline-flex items-center gap-1 text-sm ${
                userProfile.isVerified ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              <Shield size={14} />
              {userProfile.isVerified ? "Verified" : "Unverified"}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Phone size={16} className="text-slate-400" />
            <span>{userProfile.contactNumber}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail size={16} className="text-slate-400" />
            <span className="text-slate-500">
              {userProfile.email || "No email set"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Star size={16} className="text-slate-400" />
            <span>Credit Points: {userProfile.creditPoints}/5</span>
          </div>
        </div>

        {uploading && (
          <p className="text-xs text-slate-400 mt-4">Uploading photo...</p>
        )}
      </div>
    </div>
  );
}
