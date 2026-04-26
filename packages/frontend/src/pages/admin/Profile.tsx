import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Phone,
  Mail,
  MapPin,
  Camera,
  Edit2,
  ShieldCheck,
  Fingerprint,
} from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/utils/uploadFile";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";
import { firebaseAuth } from "@/config/firebase";

const FINGERPRINT_STATUS_POLL_MS = 700;

export function AdminProfile() {
  const { userProfile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailError, setEmailError] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [fingerprintServiceAvailable, setFingerprintServiceAvailable] = useState(false);
  const [checkingFingerprintService, setCheckingFingerprintService] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollmentStage, setEnrollmentStage] = useState("idle");
  const [enrollmentMessage, setEnrollmentMessage] = useState(
    "Preparing the fingerprint scanner."
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fpUrl = import.meta.env.VITE_FINGERPRINT_URL || "http://localhost:5000";

  useEffect(() => {
    let cancelled = false;

    async function checkFingerprintService() {
      setCheckingFingerprintService(true);
      try {
        const res = await fetch(`${fpUrl}/health`);
        if (!cancelled) {
          setFingerprintServiceAvailable(res.ok);
        }
      } catch {
        if (!cancelled) {
          setFingerprintServiceAvailable(false);
        }
      } finally {
        if (!cancelled) {
          setCheckingFingerprintService(false);
        }
      }
    }

    checkFingerprintService();

    return () => {
      cancelled = true;
    };
  }, [fpUrl]);

  useEffect(() => {
    if (!enrolling || !userProfile?.uid) return;

    let cancelled = false;

    const pollStatus = async () => {
      try {
        const res = await fetch(`${fpUrl}/fingerprint/enroll-status/${userProfile.uid}`);
        const result = await res.json();
        if (!cancelled && result?.stage) {
          setEnrollmentStage(result.stage);
          setEnrollmentMessage(
            result.message || "Fingerprint enrollment in progress."
          );
        }
      } catch {
        if (!cancelled) {
          setEnrollmentStage("waiting_first_scan");
          setEnrollmentMessage("Waiting for the fingerprint scanner to respond.");
        }
      }
    };

    pollStatus();
    const interval = window.setInterval(pollStatus, FINGERPRINT_STATUS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enrolling, fpUrl, userProfile?.uid]);

  const roleLabel = useMemo(() => {
    if (userProfile?.role === "superadmin") return "Superadmin";
    return "Admin";
  }, [userProfile?.role]);

  const enrollmentSteps = [
    {
      key: "waiting_first_scan",
      title: "First scan",
      description: "Place your finger on the AS608 scanner.",
    },
    {
      key: "first_scan_captured",
      title: "First scan captured",
      description: "The scanner read the first fingerprint successfully.",
    },
    {
      key: "waiting_finger_removal",
      title: "Remove finger",
      description: "Lift your finger before the confirmation scan.",
    },
    {
      key: "waiting_second_scan",
      title: "Second scan",
      description: "Place the same finger on the scanner again for confirmation.",
    },
    {
      key: "second_scan_captured",
      title: "Finalizing",
      description: "Saving the fingerprint template.",
    },
  ];

  const enrollmentStepIndexByStage: Record<string, number> = {
    starting: 0,
    waiting_first_scan: 0,
    first_scan_captured: 1,
    waiting_finger_removal: 2,
    waiting_second_scan: 3,
    second_scan_captured: 4,
    complete: 4,
    error: 0,
    idle: 0,
  };

  if (!userProfile) return null;

  const profile = userProfile;
  const backTarget =
    profile.role === "superadmin" ? "/superadmin/dashboard" : "/admin/dashboard";

  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const photoUrl = await uploadFile(`users/${profile.uid}/profile.jpg`, file);
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
    setEmailValue(profile.email || "");
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

  async function handleEnrollFingerprint() {
    if (!fingerprintServiceAvailable) {
      setEnrollError("Fingerprint service unavailable. Run the Raspberry Pi service first.");
      return;
    }

    setEnrolling(true);
    setEnrollError(null);
    setEnrollmentStage("starting");
    setEnrollmentMessage("Preparing the fingerprint scanner.");

    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const res = await fetch(`${fpUrl}/fingerprint/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.uid,
          role: profile.role,
          authToken: token,
        }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Enrollment failed");
      }

      await refreshProfile();
      toast.success("Fingerprint enrolled successfully");
    } catch (error: any) {
      const message =
        error?.message || "Fingerprint service unavailable. Is it running on port 5000?";
      setEnrollError(message);
      toast.error(message);
    } finally {
      setEnrolling(false);
    }
  }

  const currentEnrollmentStep =
    enrollmentStepIndexByStage[enrollmentStage] ?? enrollmentStepIndexByStage.starting;

  const biometricStatus = profile.biometricEnrolled ? "Enrolled" : "Not Enrolled";

  const enrollButtonLabel = enrolling
    ? "Enrolling..."
    : checkingFingerprintService
      ? "Checking scanner..."
      : !fingerprintServiceAvailable
        ? "Scanner offline"
        : profile.biometricEnrolled
          ? "Re-enroll Fingerprint"
          : "Enroll Fingerprint";

  return (
    <div className="max-w-lg mx-auto">
      <BackButton to={backTarget} label="Back" />
      <h2 className="text-2xl font-bold mb-6">My Profile</h2>

      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {userProfile.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xl font-bold">
                {profile.firstName[0]}
                {profile.lastName[0]}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors disabled:opacity-50"
              title="Upload profile photo"
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
            <h3 className="text-lg font-semibold">
              {profile.firstName} {profile.lastName}
            </h3>
            <span className="inline-flex items-center gap-1 text-sm text-primary-600">
              <ShieldCheck size={14} />
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Phone size={16} className="text-slate-400" />
            <span>{profile.contactNumber}</span>
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
                  {profile.email || "No email set"}
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
            <MapPin size={16} className="text-slate-400" />
            <span>{(profile as any).address?.barangay || "No barangay set"}</span>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 p-4 bg-slate-50/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <Fingerprint size={18} className="text-primary-600" />
                Fingerprint Enrollment
              </h4>
              <p className="text-sm text-slate-500 mt-1">
                Use the Raspberry Pi biometric scanner to enroll your fingerprint for kiosk use.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
                profile.biometricEnrolled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {biometricStatus}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {userProfile.lastFingerprintVerification?.timestamp && (
              <p className="text-xs text-slate-500">
                Last fingerprint check:{" "}
                {profile.lastFingerprintVerification?.timestamp?.toLocaleString()}
              </p>
            )}

            {!checkingFingerprintService && !fingerprintServiceAvailable && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Raspberry Pi fingerprint service not detected. Start the local biometric service to enroll.
              </div>
            )}

            {enrollError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {enrollError}
              </div>
            )}

            <button
              onClick={handleEnrollFingerprint}
              disabled={checkingFingerprintService || !fingerprintServiceAvailable || enrolling}
              className="btn-primary text-sm w-full sm:w-auto"
            >
              {enrollButtonLabel}
            </button>
          </div>
        </div>

        {uploading && (
          <p className="text-xs text-slate-400 mt-4">Uploading photo...</p>
        )}
      </div>

      {enrolling && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              <h3 className="text-lg font-semibold text-slate-900">
                Fingerprint Enrollment in Progress
              </h3>
              <div className="w-full rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-center">
                <p className="text-sm font-medium text-primary-900">
                  {enrollmentMessage}
                </p>
                <p className="text-xs text-primary-700 mt-1">
                  Current stage: {enrollmentStage.split("_").join(" ")}
                </p>
              </div>
              <div className="w-full space-y-3">
                {enrollmentSteps.map((step, index) => {
                  const isComplete = index < currentEnrollmentStep;
                  const isActive = index === currentEnrollmentStep;

                  return (
                    <div
                      key={step.key}
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        isActive
                          ? "border-primary-300 bg-primary-50 text-primary-900"
                          : isComplete
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      <p className="font-medium">{step.title}</p>
                      <p className="mt-1 text-xs">{step.description}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 text-center">
                Keep this window open until enrollment finishes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
