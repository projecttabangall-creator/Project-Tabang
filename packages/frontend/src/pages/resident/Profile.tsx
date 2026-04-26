import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Star, Phone, Mail, Lock, Camera, Edit2, IdCard } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/utils/uploadFile";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";

export function ResidentProfile() {
  const { userProfile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailError, setEmailError] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [showNameRequest, setShowNameRequest] = useState(false);
  const [nameFirst, setNameFirst] = useState("");
  const [nameLast, setNameLast] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [submittingNameRequest, setSubmittingNameRequest] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idUploadInputRef = useRef<HTMLInputElement>(null);
  const idCameraInputRef = useRef<HTMLInputElement>(null);

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

  function startEditingEmail() {
    setEmailValue(userProfile?.email || "");
    setEmailError("");
    setEditingEmail(true);
  }

  function cancelEditingEmail() {
    setEditingEmail(false);
    setEmailError("");
  }

  async function saveEmail() {
    const trimmed = emailValue.trim();
    if (!trimmed) {
      setEmailError("Email cannot be empty");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError("Invalid email format");
      return;
    }

    setSavingEmail(true);
    try {
      await api.patch("/api/auth/profile", { email: trimmed });
      await refreshProfile();
      setEditingEmail(false);
      toast.success("Email updated");
    } catch {
      toast.error("Failed to update email");
    } finally {
      setSavingEmail(false);
    }
  }

  function startNameRequest() {
    setNameFirst(userProfile?.firstName || "");
    setNameLast(userProfile?.lastName || "");
    setIdPhoto(null);
    setShowNameRequest(true);
  }

  async function submitNameRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!nameFirst.trim() || !nameLast.trim()) {
      toast.error("Enter your requested first and last name.");
      return;
    }
    if (!idPhoto) {
      toast.error("Upload a photo of you holding an ID.");
      return;
    }

    setSubmittingNameRequest(true);
    try {
      const idPhotoUrl = await uploadFile(
        `users/${userProfile!.uid}/name-change-id-${Date.now()}.jpg`,
        idPhoto
      );
      await api.post("/api/auth/profile/name-change-request", {
        firstName: nameFirst.trim(),
        lastName: nameLast.trim(),
        idPhotoUrl,
      });
      await refreshProfile();
      setShowNameRequest(false);
      toast.success("Name change request submitted for admin review.");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to submit name change request");
    } finally {
      setSubmittingNameRequest(false);
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
            <button
              type="button"
              onClick={startNameRequest}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              <Edit2 size={12} />
              Request name change
            </button>
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
          <div className="space-y-2">
            {editingEmail ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <input
                    type="email"
                    value={emailValue}
                    onChange={(e) => {
                      setEmailValue(e.target.value);
                      setEmailError("");
                    }}
                    className="input-field text-sm"
                    placeholder="your@email.com"
                  />
                  {emailError && (
                    <p className="text-red-500 text-xs mt-1">{emailError}</p>
                  )}
                </div>
                <button
                  onClick={saveEmail}
                  disabled={savingEmail}
                  className="px-2 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={cancelEditingEmail}
                  disabled={savingEmail}
                  className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-medium hover:bg-slate-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="text-slate-400" />
                <span className="text-slate-500 flex-1">
                  {userProfile.email || "No email set"}
                </span>
                <button
                  onClick={startEditingEmail}
                  className="text-slate-400 hover:text-primary-600 transition-colors"
                  title="Edit email"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            )}
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

      {showNameRequest && (
        <form onSubmit={submitNameRequest} className="card mt-4 space-y-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <IdCard size={18} /> Request Name Change
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              An admin must approve this. Upload a clear photo of you holding an ID.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First Name</label>
              <input
                value={nameFirst}
                onChange={(e) => setNameFirst(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                value={nameLast}
                onChange={(e) => setNameLast(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="label">Photo Holding ID</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => idCameraInputRef.current?.click()}
                className="rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => idUploadInputRef.current?.click()}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Choose File
              </button>
            </div>
            <input
              ref={idCameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={(e) => setIdPhoto(e.target.files?.[0] || null)}
              className="hidden"
            />
            <input
              ref={idUploadInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setIdPhoto(e.target.files?.[0] || null)}
              className="hidden"
            />
            <p className="mt-2 text-xs text-slate-500">
              {idPhoto ? idPhoto.name : "No photo selected yet."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submittingNameRequest}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {submittingNameRequest ? "Submitting..." : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={() => setShowNameRequest(false)}
              disabled={submittingNameRequest}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
