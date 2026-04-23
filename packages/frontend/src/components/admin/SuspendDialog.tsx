import { useState } from "react";
import { X } from "lucide-react";

export interface StatusChangePayload {
  accountStatus: "active" | "suspended" | "banned";
  reason: string;
  durationValue?: number;
  durationUnit?: "hours" | "days";
}

interface SuspendDialogProps {
  open: boolean;
  mode: "suspend" | "ban" | "activate";
  userName: string;
  onConfirm: (payload: StatusChangePayload) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function SuspendDialog({
  open,
  mode,
  userName,
  onConfirm,
  onCancel,
  isSubmitting,
}: SuspendDialogProps) {
  const [reason, setReason] = useState("");
  const [durationValue, setDurationValue] = useState<number | "">(1);
  const [durationUnit, setDurationUnit] = useState<"hours" | "days">("days");
  const [error, setError] = useState("");

  const canSubmit =
    reason.trim().length > 0 &&
    (mode !== "suspend" || (durationValue !== "" && durationValue > 0));

  const handleSubmit = async () => {
    setError("");

    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }

    if (mode === "suspend") {
      if (durationValue === "" || durationValue <= 0) {
        setError("Duration must be a positive number");
        return;
      }
    }

    try {
      let accountStatus: "active" | "suspended" | "banned";
      if (mode === "activate") {
        accountStatus = "active";
      } else if (mode === "suspend") {
        accountStatus = "suspended";
      } else {
        accountStatus = "banned";
      }

      const payload: StatusChangePayload = {
        accountStatus,
        reason,
      };

      if (mode === "suspend") {
        payload.durationValue = Number(durationValue);
        payload.durationUnit = durationUnit;
      }

      await onConfirm(payload);
      resetForm();
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.message ||
        "An error occurred";
      setError(errorMsg);
    }
  };

  const resetForm = () => {
    setReason("");
    setDurationValue(1);
    setDurationUnit("days");
    setError("");
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  if (!open) return null;

  const getTitle = () => {
    switch (mode) {
      case "suspend":
        return `Suspend User: ${userName}`;
      case "ban":
        return `Ban User: ${userName}`;
      case "activate":
        return `Reactivate User: ${userName}`;
    }
  };

  const getConfirmButtonText = () => {
    switch (mode) {
      case "suspend":
        return "Suspend User";
      case "ban":
        return "Permanently Ban User";
      case "activate":
        return "Reactivate Account";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{getTitle()}</h2>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Reason textarea */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            {mode === "activate" ? "Notes (optional)" : "Reason (required)"}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              mode === "activate"
                ? "Optional notes about reactivation"
                : "Explain the reason for this action"
            }
            disabled={isSubmitting}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            rows={4}
          />
        </div>

        {/* Duration fields (only for suspend) */}
        {mode === "suspend" && (
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Duration (required)
              </label>
              <input
                type="number"
                value={durationValue}
                onChange={(e) =>
                  setDurationValue(
                    e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value, 10))
                  )
                }
                min="1"
                disabled={isSubmitting}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Unit
              </label>
              <select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value as "hours" | "days")}
                disabled={isSubmitting}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`flex-1 rounded-lg px-4 py-2 font-medium text-white transition-colors disabled:opacity-50 ${
              mode === "ban"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSubmitting ? "Processing..." : getConfirmButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
}
