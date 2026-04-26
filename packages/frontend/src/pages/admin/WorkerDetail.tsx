import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Briefcase,
  CheckCircle,
  Clock,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Shield,
  Star,
  Upload,
  User,
  X,
  XCircle,
} from "lucide-react";
import api from "@/services/api";
import { format12hRange } from "@/utils/time";
import { firebaseAuth } from "@/config/firebase";
import { BackButton } from "@/components/common/BackButton";
import { getWorkerCredentialLabel } from "@/constants/workerCredentials";
import { uploadFile } from "@/utils/uploadFile";
import {
  WorkerCredentialDraft,
  WorkerCredentialRecord,
  buildWorkerCredentialDrafts,
  createWorkerCredentialDraft,
  getDefaultWorkerCredentialName,
  getNextWorkerCredentialType,
  getSelectableWorkerCredentialOptions,
  sanitizeCredentialStorageSegment,
} from "@/utils/workerCredentials";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Category {
  id: string;
  name: string;
}

interface WorkerCredential extends WorkerCredentialRecord {
  fileUrl: string;
}

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface WorkerLocation {
  latitude?: number;
  longitude?: number;
  _latitude?: number;
  _longitude?: number;
}

interface WorkerProfile {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  birthday?: string;
  contactNumber: string;
  email?: string;
  address?: {
    street?: string;
    houseLot?: string;
    blockNo?: string;
    barangay?: string;
  };
  creditPoints: number;
  isVerified: boolean;
  isActive: boolean;
  accountStatus: string;
  createdAt?: unknown;
  termsAcceptedAt?: string | null;
  workerData?: {
    specialization?: string | string[];
    credentials?: WorkerCredential[];
    biometricEnrolled?: boolean;
    averageRating?: number;
    completedJobsCount?: number;
    totalJobsAssigned?: number;
    acceptanceRate?: number;
    cancellationRate?: number;
    reportsCount?: number;
    lastAssignedAt?: unknown;
    location?: WorkerLocation;
    availability?: AvailabilitySlot[];
    isAvailable?: boolean;
  };
}

function formatDate(value?: unknown): string {
  if (!value) return "Not available";

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }

  if (typeof value === "object" && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date; _seconds?: number };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().toLocaleDateString();
    }
    if (typeof maybeTimestamp._seconds === "number") {
      return new Date(maybeTimestamp._seconds * 1000).toLocaleDateString();
    }
  }

  return "Not available";
}

function getCredentialDisplayName(credential: WorkerCredentialRecord): string {
  return (
    credential.name ||
    getDefaultWorkerCredentialName(credential.type) ||
    getWorkerCredentialLabel(credential.type)
  );
}

export function WorkerDetail() {
  const { workerId } = useParams();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showCredentialUploader, setShowCredentialUploader] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<{
    name: string;
    fileUrl: string;
  } | null>(null);
  const [credentialDrafts, setCredentialDrafts] = useState<WorkerCredentialDraft[]>(
    []
  );
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentStage, setEnrollmentStage] = useState("idle");
  const [enrollmentMessage, setEnrollmentMessage] = useState(
    "Preparing the fingerprint scanner."
  );
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadWorkerDetail = useCallback(async () => {
    if (!workerId) return;

    setLoading(true);
    try {
      const [{ data: workerResponse }, { data: categoryResponse }] =
        await Promise.all([
          api.get(`/api/workers/${workerId}`),
          api.get("/api/categories"),
        ]);

      setWorker(workerResponse.worker || null);
      setCategories(categoryResponse.categories || []);
    } catch {
      toast.error("Failed to load worker details");
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    loadWorkerDetail();
  }, [loadWorkerDetail]);

  useEffect(() => {
    setCredentialDrafts(buildWorkerCredentialDrafts(worker?.workerData?.credentials));
  }, [worker?.workerData?.credentials]);

  useEffect(() => {
    if (!enrolling || !workerId) return;

    const fpUrl = import.meta.env.VITE_FINGERPRINT_URL || "http://localhost:5000";
    let cancelled = false;

    const pollStatus = async () => {
      try {
        const res = await fetch(`${fpUrl}/fingerprint/enroll-status/${workerId}`);
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
          setEnrollmentMessage(
            "Waiting for the fingerprint scanner to respond."
          );
        }
      }
    };

    pollStatus();
    const interval = window.setInterval(pollStatus, 700);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enrolling, workerId]);

  const specializationLabel = useMemo(() => {
    const raw = worker?.workerData?.specialization;
    const specs = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (!specs.length) return "Not available";
    return specs
      .map((id) => categories.find((c) => c.id === id)?.name || id)
      .join(", ");
  }, [categories, worker?.workerData?.specialization]);

  async function handleVerify() {
    if (!workerId || !worker || worker.isVerified) return;

    setVerifying(true);
    try {
      await api.patch(`/api/workers/${workerId}/verify`);
      setWorker((current) =>
        current
          ? {
              ...current,
              isVerified: true,
              isActive: true,
            }
          : current
      );
      toast.success("Worker verified and activated");
    } catch {
      toast.error("Failed to verify worker");
    } finally {
      setVerifying(false);
    }
  }

  async function handleEnrollFingerprint() {
    if (!workerId || !worker) return;

    setEnrolling(true);
    setEnrollError(null);
    setEnrollmentStage("starting");
    setEnrollmentMessage("Preparing the fingerprint scanner.");
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const fpUrl = import.meta.env.VITE_FINGERPRINT_URL || "http://localhost:5000";
      const res = await fetch(`${fpUrl}/fingerprint/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, adminToken: token }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Fingerprint enrolled successfully");
        setWorker((prev) =>
          prev
            ? {
                ...prev,
                workerData: {
                  ...prev.workerData!,
                  biometricEnrolled: true,
                },
              }
            : prev
        );
      } else {
        setEnrollError(result.error || "Enrollment failed");
      }
    } catch {
      setEnrollError("Fingerprint service unavailable. Is it running on port 5000?");
    } finally {
      setEnrolling(false);
    }
  }

  function openCredentialUploader() {
    if (credentialDrafts.length === 0) {
      const nextType = getNextWorkerCredentialType([]);
      setCredentialDrafts([createWorkerCredentialDraft({ type: nextType })]);
    }

    setShowCredentialUploader(true);
  }

  function addCredentialDraft() {
    const nextType = getNextWorkerCredentialType(credentialDrafts);
    setCredentialDrafts((current) => [
      ...current,
      createWorkerCredentialDraft({ type: nextType }),
    ]);
  }

  function removeCredentialDraft(draftId: string) {
    setCredentialDrafts((current) =>
      current.filter((credential) => credential.id !== draftId)
    );

    const input = fileInputRefs.current[draftId];
    if (input) {
      input.value = "";
    }
  }

  function updateCredentialDraft(
    draftId: string,
    updates: Partial<WorkerCredentialDraft>
  ) {
    setCredentialDrafts((current) =>
      current.map((credential) =>
        credential.id === draftId ? { ...credential, ...updates } : credential
      )
    );
  }

  function handleCredentialTypeChange(draftId: string, type: string) {
    updateCredentialDraft(draftId, {
      type,
      name: getDefaultWorkerCredentialName(type),
      file: null,
      existingUrl: undefined,
      uploadedAt: undefined,
    });

    const input = fileInputRefs.current[draftId];
    if (input) {
      input.value = "";
    }
  }

  function handleCredentialFileSelect(draftId: string, file: File | null) {
    updateCredentialDraft(draftId, { file });
  }

  function clearSelectedCredentialFile(draftId: string) {
    updateCredentialDraft(draftId, { file: null });

    const input = fileInputRefs.current[draftId];
    if (input) {
      input.value = "";
    }
  }

  async function handleSaveCredentials() {
    if (!workerId) return;

    const credentialsToSave = credentialDrafts.filter(
      (credential) =>
        credential.type ||
        credential.name.trim() ||
        credential.file ||
        credential.existingUrl
    );

    if (credentialsToSave.length === 0) {
      toast.error("Please add at least one credential.");
      return;
    }

    for (const credential of credentialsToSave) {
      if (!credential.type) {
        toast.error("Please choose a certificate type for each credential.");
        return;
      }

      if (!credential.name.trim()) {
        toast.error("Please enter the certificate or file name.");
        return;
      }

      if (!credential.file && !credential.existingUrl) {
        toast.error("Please upload a file for each credential.");
        return;
      }
    }

    setSavingCredentials(true);
    try {
      const credentialsPayload = await Promise.all(
        credentialsToSave.map(async (credential) => {
          if (credential.file) {
            const path = `workers/${workerId}/credentials/${sanitizeCredentialStorageSegment(
              credential.type
            )}/${credential.id}_${sanitizeCredentialStorageSegment(
              credential.name
            )}`;
            const fileUrl = await uploadFile(path, credential.file);
            return {
              type: credential.type,
              name: credential.name.trim(),
              fileUrl,
            };
          }

          return {
            type: credential.type,
            name: credential.name.trim(),
            fileUrl: credential.existingUrl!,
          };
        })
      );

      await api.patch(`/api/workers/${workerId}/credentials`, {
        credentials: credentialsPayload,
      });

      await loadWorkerDetail();
      setShowCredentialUploader(false);
      toast.success("Credentials updated");
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to upload credentials"
      );
    } finally {
      setSavingCredentials(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="max-w-3xl mx-auto">
        <BackButton to="/admin/workers" label="Back to Workers" />
        <div className="card text-center py-12">
          <p className="text-slate-500">Worker not found.</p>
        </div>
      </div>
    );
  }

  const location = worker.workerData?.location;
  const latitude = location?.latitude ?? location?._latitude;
  const longitude = location?.longitude ?? location?._longitude;
  const enrollmentSteps = [
    {
      key: "waiting_first_scan",
      title: "First scan",
      description: "Ask the worker to place their finger on the AS608 scanner.",
    },
    {
      key: "first_scan_captured",
      title: "First scan captured",
      description: "The scanner read the first fingerprint successfully.",
    },
    {
      key: "waiting_finger_removal",
      title: "Remove finger",
      description: "Tell the worker to lift their finger before the second scan.",
    },
    {
      key: "waiting_second_scan",
      title: "Second scan",
      description: "Place the same finger on the scanner again for confirmation.",
    },
    {
      key: "second_scan_captured",
      title: "Finalizing",
      description: "The second scan was captured. Saving the fingerprint template.",
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
  };
  const currentEnrollmentStep =
    enrollmentStepIndexByStage[enrollmentStage] ?? enrollmentStepIndexByStage.starting;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <BackButton to="/admin/workers" label="Back to Workers" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Worker Information</h2>
          <p className="text-slate-500 mt-1">
            View the registered worker profile and verification details.
          </p>
        </div>
        {!worker.isVerified && (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="btn-primary text-sm"
          >
            {verifying ? "Verifying..." : "Verify Worker"}
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center text-accent-700 text-xl font-bold shrink-0">
            {worker.firstName[0]}
            {worker.lastName[0]}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold">
                {worker.firstName}{" "}
                {worker.middleInitial ? `${worker.middleInitial}. ` : ""}
                {worker.lastName}
              </h3>
              {worker.isVerified ? (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  <CheckCircle size={14} />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  <XCircle size={14} />
                  Pending Verification
                </span>
              )}
            </div>

            <div className="grid gap-3 mt-5 sm:grid-cols-2">
              <div className="flex items-center gap-3 text-sm">
                <Phone size={16} className="text-slate-400" />
                <span>{worker.contactNumber}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="text-slate-400" />
                <span>{worker.email || "No email set"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase size={16} className="text-slate-400" />
                <span>{specializationLabel}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield size={16} className="text-slate-400" />
                <span>
                  {worker.creditPoints}/5 credit, {worker.accountStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h4 className="font-semibold mb-4">Personal Details</h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <User size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-slate-500">Birthday</p>
                <p>{formatDate(worker.birthday)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-slate-500">Barangay Address</p>
                <p>{worker.address?.street || "No street set"}</p>
                <p>
                  House/Lot {worker.address?.houseLot || "N/A"}
                  {worker.address?.blockNo
                    ? `, Block ${worker.address.blockNo}`
                    : ""}
                </p>
                <p>{worker.address?.barangay || "No barangay set"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-slate-500">Registered On</p>
                <p>{formatDate(worker.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 className="font-semibold mb-4">Worker Status</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-lg px-4 py-3">
              <p className="text-slate-500">Availability</p>
              <p className="font-medium">
                {worker.workerData?.isAvailable ? "Available" : "Unavailable"}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500">Biometric</p>
                {worker.workerData?.biometricEnrolled && (
                  <button
                    onClick={handleEnrollFingerprint}
                    disabled={enrolling}
                    className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded text-slate-700 font-medium transition"
                  >
                    {enrolling ? "Enrolling..." : "Re-enroll"}
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {worker.workerData?.biometricEnrolled ? "Enrolled" : "Not Enrolled"}
                </p>
                {!worker.workerData?.biometricEnrolled && (
                  <button
                    onClick={handleEnrollFingerprint}
                    disabled={enrolling}
                    className="text-xs px-3 py-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded font-medium transition"
                  >
                    {enrolling ? "Enrolling..." : "Enroll"}
                  </button>
                )}
              </div>
              {enrollError && (
                <p className="text-xs text-red-600 mt-2">{enrollError}</p>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-3">
              <p className="text-slate-500">Account Status</p>
              <p className="font-medium capitalize">{worker.accountStatus}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-3">
              <p className="text-slate-500">Active</p>
              <p className="font-medium">{worker.isActive ? "Yes" : "No"}</p>
            </div>
          </div>
          {(latitude !== undefined || longitude !== undefined) && (
            <div className="mt-4 text-sm text-slate-600">
              <p className="font-medium text-slate-700 mb-1">Last Known Location</p>
              <p>
                {latitude ?? "N/A"}, {longitude ?? "N/A"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h4 className="font-semibold mb-4">Performance</h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-slate-500 flex items-center gap-1">
              <Star size={14} />
              Rating
            </p>
            <p className="font-semibold">
              {worker.workerData?.averageRating?.toFixed(1) || "0.0"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-slate-500">Completed Jobs</p>
            <p className="font-semibold">
              {worker.workerData?.completedJobsCount || 0}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-slate-500">Total Assigned</p>
            <p className="font-semibold">
              {worker.workerData?.totalJobsAssigned || 0}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-slate-500">Acceptance Rate</p>
            <p className="font-semibold">
              {typeof worker.workerData?.acceptanceRate === "number"
                ? `${Math.round(worker.workerData.acceptanceRate * 100)}%`
                : "N/A"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-slate-500">Reports Count</p>
            <p className="font-semibold">{worker.workerData?.reportsCount || 0}</p>
          </div>
        </div>
      </div>

      {worker.workerData?.availability && worker.workerData.availability.length > 0 && (
        <div className="card">
          <h4 className="font-semibold mb-4">Availability Schedule</h4>
          <div className="space-y-2">
            {worker.workerData.availability.map((slot, index) => (
              <div
                key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}
                className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-4 py-3"
              >
                <span className="font-medium">
                  {DAY_NAMES[slot.dayOfWeek] || `Day ${slot.dayOfWeek}`}
                </span>
                <span className="text-slate-600">
                  {format12hRange(slot.startTime, slot.endTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-semibold flex items-center gap-2">
              <FileText size={16} />
              Credentials
            </h4>
            <p className="text-sm text-slate-500 mt-1">
              National ID, Driver's License, PRC ID, Police Clearance, and NBI
              Clearance can each be uploaded once. Skills Certificates can have
              multiple entries.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              showCredentialUploader
                ? setShowCredentialUploader(false)
                : openCredentialUploader()
            }
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Upload size={14} />
            {showCredentialUploader ? "Hide Upload" : "Upload Credentials"}
          </button>
        </div>
        {worker.workerData?.credentials && worker.workerData.credentials.length > 0 ? (
          <div className="space-y-2">
            {worker.workerData.credentials.map((credential, index) => {
              const label = getWorkerCredentialLabel(credential.type);
              const name = getCredentialDisplayName(credential);

              return (
                <div
                  key={`${credential.type}-${credential.fileUrl}-${index}`}
                  className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-4 py-3 gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{label}</p>
                    <p className="text-slate-500 truncate">{name}</p>
                    <p className="text-slate-400">
                      Uploaded {formatDate(credential.uploadedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCredential({
                        name,
                        fileUrl: credential.fileUrl,
                      })
                    }
                    className="text-primary-600 hover:text-primary-700 font-medium shrink-0"
                  >
                    View File
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No credentials uploaded yet.</p>
        )}

        {showCredentialUploader && (
          <div className="mt-6 border-t border-slate-200 pt-5 space-y-4">
            <p className="text-sm text-slate-500">
              Add a certificate row, choose the document type, enter the
              certificate or file name, and upload the photo or PDF.
            </p>

            {credentialDrafts.map((credential) => {
              const options = getSelectableWorkerCredentialOptions(
                credentialDrafts,
                credential.id
              );

              return (
                <div
                  key={credential.id}
                  className="rounded-lg border border-slate-200 p-4 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">Credential Entry</p>
                      {credential.existingUrl && (
                        <a
                          href={credential.existingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          View current file
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCredentialDraft(credential.id)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                      title="Remove credential"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">Certificate Type</label>
                      <select
                        value={credential.type}
                        onChange={(event) =>
                          handleCredentialTypeChange(credential.id, event.target.value)
                        }
                        className="input-field"
                      >
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Certificate/File Name</label>
                      <input
                        value={credential.name}
                        onChange={(event) =>
                          updateCredentialDraft(credential.id, {
                            name: event.target.value,
                          })
                        }
                        className="input-field"
                        placeholder="Enter certificate or file name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Upload Photo / File</label>
                    <input
                      ref={(element) => {
                        fileInputRefs.current[credential.id] = element;
                      }}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(event) =>
                        handleCredentialFileSelect(
                          credential.id,
                          event.target.files?.[0] || null
                        )
                      }
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[credential.id]?.click()}
                        className="btn-secondary text-sm"
                      >
                        {credential.existingUrl ? "Replace File" : "Upload File"}
                      </button>
                      {credential.file && (
                        <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                          <span className="truncate max-w-xs">
                            {credential.file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => clearSelectedCredentialFile(credential.id)}
                            className="text-slate-400 hover:text-rose-500 transition-colors"
                            title="Clear selected file"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      {!credential.file && credential.existingUrl && (
                        <span className="text-sm text-slate-500">
                          Keeping the current uploaded file.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addCredentialDraft}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Plus size={14} />
              Add Credential
            </button>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveCredentials}
                disabled={savingCredentials}
                className="btn-primary text-sm"
              >
                {savingCredentials ? "Uploading..." : "Save Credentials"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCredentialDrafts(
                    buildWorkerCredentialDrafts(worker.workerData?.credentials)
                  );
                  setShowCredentialUploader(false);
                }}
                disabled={savingCredentials}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fingerprint Enrollment Modal */}
      {enrolling && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              <h3 className="text-lg font-semibold text-slate-900">Fingerprint Enrollment in Progress</h3>
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

      {selectedCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {selectedCredential.name}
                </h3>
                <p className="text-xs text-slate-500">Submitted credential preview</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCredential(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close credential preview"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto px-4 py-4 flex-1 bg-slate-50">
              {selectedCredential.fileUrl.startsWith("data:image/") ? (
                <img
                  src={selectedCredential.fileUrl}
                  alt={selectedCredential.name}
                  className="w-full h-auto rounded-lg border border-slate-200 bg-white object-contain"
                />
              ) : selectedCredential.fileUrl.startsWith("data:application/pdf") ? (
                <iframe
                  src={selectedCredential.fileUrl}
                  title={selectedCredential.name}
                  className="w-full min-h-[70vh] rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-6 text-center space-y-3">
                  <p className="text-sm text-slate-600">
                    This credential cannot be previewed inline.
                  </p>
                  <a
                    href={selectedCredential.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                  >
                    Open File
                  </a>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex gap-3">
              <a
                href={selectedCredential.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center rounded-lg border border-primary-200 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
              >
                Open in New Tab
              </a>
              <button
                type="button"
                onClick={() => setSelectedCredential(null)}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
