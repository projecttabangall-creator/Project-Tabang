import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BackButton } from "@/components/common/BackButton";
import {
  Shield,
  Star,
  Phone,
  Mail,
  Camera,
  Clock,
  FileText,
  Tag,
  Plus,
  Trash2,
  Edit2,
  ScrollText,
  X,
  ChevronDown,
  IdCard,
} from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/utils/uploadFile";
import api from "@/services/api";
import { getWorkerCredentialLabel } from "@/constants/workerCredentials";
import { WorkerTermsContent } from "@/components/common/WorkerTermsContent";
import { TimeInput } from "@/components/common/TimeInput";
import { format12h } from "@/utils/time";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const formatWorkingDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });

const formatStatus = (status: string) => status.replace(/_/g, " ");
const toLocalDateInputValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};

type AvailabilitySlot =
  | { type: "recurring"; dayOfWeek: number; startTime: string; endTime: string }
  | { type: "specific"; date: string; startTime: string; endTime: string }
  | { dayOfWeek: number; startTime: string; endTime: string }; // legacy

export function WorkerProfile() {
  const { userProfile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [categoryName, setCategoryName] = useState<string>("");
  const [showTerms, setShowTerms] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<AvailabilitySlot[]>([]);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [slotErrors, setSlotErrors] = useState<string[]>([]);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailError, setEmailError] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [showNameRequest, setShowNameRequest] = useState(false);
  const [nameFirst, setNameFirst] = useState("");
  const [nameLast, setNameLast] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [submittingNameRequest, setSubmittingNameRequest] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<{
    name: string;
    fileUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idUploadInputRef = useRef<HTMLInputElement>(null);
  const idCameraInputRef = useRef<HTMLInputElement>(null);

  const workerData = userProfile?.workerData;
  const workingSchedule = (workerData?.workingSchedule || [])
    .filter((slot) => !["completed", "payment_confirmed", "cancelled"].includes(slot.status))
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? a.startTime.localeCompare(b.startTime)
        : a.date.localeCompare(b.date)
    );

  // Fetch category names for the worker's specializations
  useEffect(() => {
    if (!workerData?.specialization) return;
    const specs = Array.isArray(workerData.specialization)
      ? workerData.specialization
      : [workerData.specialization];
    if (!specs.length) return;
    api
      .get("/api/categories")
      .then(({ data }) => {
        const names = specs
          .map((id: string) => data.categories?.find((c: any) => c.id === id)?.name)
          .filter(Boolean)
          .join(", ");
        if (names) setCategoryName(names);
      })
      .catch(() => {});
  }, [workerData?.specialization]);

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

  function validateSlots(slots: AvailabilitySlot[]): string[] {
    const errors = slots.map(() => "");

    slots.forEach((slot, i) => {
      // Rule 1: start must be before end
      if (slot.startTime >= slot.endTime) {
        errors[i] = "Start time must be before end time.";
        return;
      }

      const slotType = "type" in slot ? slot.type : "recurring";
      const today = toLocalDateInputValue();

      if (slotType === "specific" && "date" in slot && slot.date < today) {
        errors[i] = "Specific date cannot be in the past.";
        return;
      }

      // Rule 2: no overlap with other slots
      for (let j = 0; j < slots.length; j++) {
        if (j === i) continue;
        const other = slots[j];
        const otherType = "type" in other ? other.type : "recurring";

        // Check time overlap (applies to all)
        const timesOverlap =
          slot.startTime < other.endTime && slot.endTime > other.startTime;

        if (!timesOverlap) continue;

        // Recurring vs Recurring: same dayOfWeek
        if (slotType === "recurring" && otherType === "recurring") {
          if ("dayOfWeek" in slot && "dayOfWeek" in other && slot.dayOfWeek === other.dayOfWeek) {
            errors[i] = `Conflicts with ${DAY_NAMES[other.dayOfWeek as number]} ${format12h(other.startTime)}–${format12h(other.endTime)}.`;
            break;
          }
        }
        // Specific vs Specific: same date
        else if (slotType === "specific" && otherType === "specific") {
          if ("date" in slot && "date" in other && slot.date === other.date) {
            errors[i] = `Conflicts with ${new Date(other.date).toLocaleDateString()} ${format12h(other.startTime)}–${format12h(other.endTime)}.`;
            break;
          }
        }
        // Recurring vs Specific: if specific date falls on recurring day
        else if (slotType === "recurring" && otherType === "specific") {
          if ("dayOfWeek" in slot && "date" in other) {
            const dayOfWeek = new Date(other.date).getDay();
            if (slot.dayOfWeek === dayOfWeek) {
              errors[i] = `Conflicts with ${new Date(other.date).toLocaleDateString()} ${format12h(other.startTime)}–${format12h(other.endTime)}.`;
              break;
            }
          }
        }
        // Specific vs Recurring: if specific date falls on recurring day
        else if (slotType === "specific" && otherType === "recurring") {
          if ("date" in slot && "dayOfWeek" in other) {
            const dayOfWeek = new Date(slot.date).getDay();
            if (dayOfWeek === (other.dayOfWeek as number)) {
              errors[i] = `Conflicts with ${DAY_NAMES[other.dayOfWeek as number]} ${format12h(other.startTime)}–${format12h(other.endTime)}.`;
              break;
            }
          }
        }
      }
    });

    return errors;
  }

  function handleEditSchedule() {
    setEditingAvailability(workerData?.availability || []);
    setSlotErrors([]);
    setIsEditingSchedule(true);
  }

  function handleCancelEdit() {
    setIsEditingSchedule(false);
    setEditingAvailability([]);
    setSlotErrors([]);
  }

  async function handleSaveSchedule() {
    if (!userProfile) return;

    const errors = validateSlots(editingAvailability);
    setSlotErrors(errors);

    const hasErrors = errors.some((e) => e !== "");
    if (hasErrors) {
      toast.error("Fix the schedule errors before saving.");
      return;
    }

    setIsSavingSchedule(true);
    try {
      await api.patch(`/api/workers/${userProfile.uid}/schedule`, {
        availability: editingAvailability,
      });
      await refreshProfile();
      setIsEditingSchedule(false);
      setSlotErrors([]);
      toast.success("Availability updated");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update schedule");
    } finally {
      setIsSavingSchedule(false);
    }
  }

  function handleAddRecurringSlot() {
    setEditingAvailability([
      ...editingAvailability,
      { type: "recurring", dayOfWeek: 0, startTime: "09:00", endTime: "17:00" },
    ]);
    setSlotErrors((prev) => [...prev, ""]);
  }

  function handleAddSpecificSlot() {
    const today = toLocalDateInputValue();
    setEditingAvailability([
      ...editingAvailability,
      { type: "specific", date: today, startTime: "09:00", endTime: "17:00" },
    ]);
    setSlotErrors((prev) => [...prev, ""]);
  }

  function handleRemoveSlot(index: number) {
    setEditingAvailability(editingAvailability.filter((_, i) => i !== index));
    setSlotErrors((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSlotChange(
    index: number,
    field: string,
    value: any
  ) {
    const updated = [...editingAvailability];
    updated[index] = { ...updated[index], [field]: value };
    setEditingAvailability(updated);

    // Re-validate live as user types
    const errors = validateSlots(updated);
    setSlotErrors(errors);
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <BackButton to="/worker/home" label="Back" />
      <h2 className="text-2xl font-bold mb-6">My Profile</h2>

      {/* Basic Info Card */}
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
              <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center text-accent-700 text-xl font-bold">
                {userProfile.firstName[0]}
                {userProfile.lastName[0]}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-accent-600 text-white rounded-full flex items-center justify-center hover:bg-accent-700 transition-colors disabled:opacity-50"
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
              {userProfile.firstName} {userProfile.lastName}
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
              {userProfile.isVerified ? "Verified" : "Pending Verification"}
            </span>
          </div>
        </div>

        {/* Contact Info */}
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
          {categoryName && (
            <div className="flex items-center gap-3 text-sm">
              <Tag size={16} className="text-slate-400" />
              <span>Work Category: <span className="font-medium">{categoryName}</span></span>
            </div>
          )}
        </div>

        {uploading && (
          <p className="text-xs text-slate-400 mt-4">Uploading photo...</p>
        )}
      </div>

      {showNameRequest && (
        <form onSubmit={submitNameRequest} className="card space-y-4">
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

      {/* Stats Card */}
      <div className="card">
        <h4 className="font-semibold mb-4">Performance</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-xl font-bold text-yellow-500">
              <Star size={18} fill="currentColor" />
              {workerData?.averageRating?.toFixed(1) || "N/A"}
            </div>
            <p className="text-xs text-slate-500 mt-1">Avg Rating</p>
          </div>
          <div>
            <p className="text-xl font-bold text-primary-600">
              {workerData?.completedJobsCount ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Completed Jobs</p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-700">
              {userProfile.creditPoints}/5
            </p>
            <p className="text-xs text-slate-500 mt-1">Credit Points</p>
          </div>
        </div>
      </div>

      {/* Availability Schedule */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Clock size={16} /> Available Days & Hours
          </h4>
          {!isEditingSchedule && (
            <button
              onClick={handleEditSchedule}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Edit
            </button>
          )}
        </div>

        {isEditingSchedule ? (
          <div className="space-y-3">
            {editingAvailability.map((slot, i) => {
              const hasError = slotErrors[i];
              const slotType = "type" in slot ? slot.type : "recurring";
              const isRecurring = slotType === "recurring";

              return (
                <div key={i}>
                  <div
                    className={`flex gap-2 items-end rounded-lg p-3 transition-colors ${
                      hasError
                        ? "bg-red-50 border border-red-300"
                        : "bg-slate-50"
                    }`}
                  >
                    {isRecurring ? (
                      <>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-slate-600">
                            Day
                          </label>
                          <select
                            value={"dayOfWeek" in slot ? slot.dayOfWeek : 0}
                            onChange={(e) =>
                              handleSlotChange(i, "dayOfWeek", Number(e.target.value))
                            }
                            className={`input-field text-sm mt-1 ${
                              hasError ? "border-red-400" : ""
                            }`}
                          >
                            {ALL_DAYS.map((day) => (
                              <option key={day} value={day}>
                                {DAY_NAMES[day]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-slate-600">
                            Date
                          </label>
                          <input
                            type="date"
                            value={"date" in slot ? slot.date : ""}
                            onChange={(e) =>
                              handleSlotChange(i, "date", e.target.value)
                            }
                            min={toLocalDateInputValue()}
                            className={`input-field text-sm mt-1 ${
                              hasError ? "border-red-400" : ""
                            }`}
                          />
                        </div>
                      </>
                    )}
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-600">
                        Start
                      </label>
                      <TimeInput
                        value={slot.startTime}
                        onChange={(v) => handleSlotChange(i, "startTime", v)}
                        className={`mt-1 ${hasError ? "[&>select]:border-red-400" : ""}`}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-600">
                        End
                      </label>
                      <TimeInput
                        value={slot.endTime}
                        onChange={(v) => handleSlotChange(i, "endTime", v)}
                        className={`mt-1 ${hasError ? "[&>select]:border-red-400" : ""}`}
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveSlot(i)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {hasError && (
                    <p className="text-xs text-red-600 mt-1 px-3">
                      ⚠️ {hasError}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex gap-2">
              <button
                onClick={handleAddRecurringSlot}
                className="flex-1 py-2 border border-slate-300 hover:border-primary-600 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors"
              >
                <Plus size={16} /> Recurring Day
              </button>
              <button
                onClick={handleAddSpecificSlot}
                className="flex-1 py-2 border border-slate-300 hover:border-primary-600 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors"
              >
                <Plus size={16} /> Specific Date
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveSchedule}
                disabled={isSavingSchedule || slotErrors.some((e) => e !== "")}
                className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingSchedule ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {workerData?.availability && workerData.availability.length > 0 ? (
              workerData.availability.map((slot, i) => {
                const slotType = "type" in slot ? slot.type : "recurring";
                const isRecurring = slotType === "recurring";

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2"
                  >
                    <span className="font-medium">
                      {isRecurring
                        ? `Every ${DAY_NAMES["dayOfWeek" in slot ? slot.dayOfWeek : 0]}`
                        : `${new Date("date" in slot ? (slot.date as string) : "").toLocaleDateString()}`}
                    </span>
                    <span className="text-slate-600">
                      {format12h(slot.startTime)} - {format12h(slot.endTime)}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                No availability set. Click Edit to add available days or dates.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Working Schedule */}
      <div className="card">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Clock size={16} /> Working Schedule
        </h4>

        {workingSchedule.length > 0 ? (
          <div className="space-y-2">
            {workingSchedule.map((slot, i) => (
              <div
                key={`${slot.requestId}-${slot.date}-${i}`}
                className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {slot.categoryName} - {slot.itemName}
                    </p>
                    <p className="text-slate-600">
                      {formatWorkingDate(slot.date)} · {format12h(slot.startTime)} - {format12h(slot.endTime)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium capitalize text-primary-700">
                    {formatStatus(slot.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Accepted jobs will appear here after you set their working dates.
          </p>
        )}
      </div>

      {/* Credentials */}
      {workerData?.credentials && workerData.credentials.length > 0 && (
        <div className="card">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <FileText size={16} /> Uploaded Credentials
          </h4>
          <div className="space-y-2">
            {workerData.credentials.map((cred, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2"
              >
                <div>
                  <span className="font-medium">
                    {getWorkerCredentialLabel(cred.type)}
                  </span>
                  <p className="text-xs text-slate-500">
                    {cred.name || getWorkerCredentialLabel(cred.type)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCredential({
                      name: cred.name || getWorkerCredentialLabel(cred.type),
                      fileUrl: cred.fileUrl,
                    })
                  }
                  className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms and Conditions Card */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <ScrollText size={16} className="text-primary-600" />
            Terms and Conditions
          </h4>
          <button
            onClick={() => setShowTerms(true)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            View <ChevronDown size={14} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Your rights, responsibilities, payment process, commission rates, and platform policies as a registered worker.
        </p>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 text-slate-800">
                <ScrollText size={18} className="text-primary-600" />
                <h3 className="font-bold text-lg">Worker Terms and Conditions</h3>
              </div>
              <button
                onClick={() => setShowTerms(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4 flex-1">
              <WorkerTermsContent />
            </div>
            <div className="px-6 py-4 border-t border-slate-200 shrink-0">
              <button
                onClick={() => setShowTerms(false)}
                className="btn-primary w-full"
              >
                Close
              </button>
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
