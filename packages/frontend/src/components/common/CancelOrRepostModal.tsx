import { useState } from "react";
import { TimeInput } from "@/components/common/TimeInput";

export const CANCEL_REASON_CATEGORIES = [
  "Schedule conflict",
  "Worker unresponsive",
  "Found another option",
  "Wrong category or item",
  "Service no longer needed",
];

export interface CancelOrRepostPayload {
  mode: "cancel" | "repost";
  reasonCategories: string[];
  reasonOther: string;
  schedule?: { date: string; startTime: string; endTime: string };
}

interface Props {
  open: boolean;
  hasAssignedWorker: boolean;
  defaultDate?: string;
  defaultStart?: string;
  defaultEnd?: string;
  onClose: () => void;
  onSubmit: (payload: CancelOrRepostPayload) => Promise<void> | void;
  submitting?: boolean;
}

const todayStr = () => new Date().toISOString().split("T")[0];

export function CancelOrRepostModal({
  open,
  hasAssignedWorker,
  defaultDate,
  defaultStart,
  defaultEnd,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const [reschedule, setReschedule] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const [includeOther, setIncludeOther] = useState(false);
  const [date, setDate] = useState(defaultDate || todayStr());
  const [startTime, setStartTime] = useState(defaultStart || "08:00");
  const [endTime, setEndTime] = useState(defaultEnd || "17:00");
  const [error, setError] = useState("");

  if (!open) return null;

  const toggleReason = (r: string) =>
    setReasons((cur) =>
      cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]
    );

  async function handleSubmit() {
    setError("");
    if (reasons.length === 0 && !(includeOther && otherText.trim())) {
      setError("Pick at least one reason or fill in 'Other'.");
      return;
    }
    if (reschedule && date < todayStr()) {
      setError("Reschedule date cannot be in the past.");
      return;
    }
    if (reschedule && startTime >= endTime) {
      setError("End time must be after start time.");
      return;
    }
    const finalReasons = [...reasons];
    if (includeOther && otherText.trim()) finalReasons.push("Other");
    await onSubmit({
      mode: reschedule ? "repost" : "cancel",
      reasonCategories: finalReasons,
      reasonOther: includeOther ? otherText.trim() : "",
      schedule: reschedule
        ? { date, startTime, endTime }
        : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-bold mb-1">
          {reschedule ? "Reschedule request" : "Cancel request"}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          {reschedule
            ? "Pick a new date/time. The previously assigned worker will not be reassigned."
            : "Tell us why so we can improve the matching."}
        </p>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold mb-2">Reason</p>
            <div className="space-y-2">
              {CANCEL_REASON_CATEGORIES.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-2 text-sm cursor-pointer rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={reasons.includes(r)}
                    onChange={() => toggleReason(r)}
                    className="h-4 w-4 accent-primary-600"
                  />
                  <span>{r}</span>
                </label>
              ))}
              <label className="flex items-start gap-2 text-sm cursor-pointer rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={includeOther}
                  onChange={(e) => setIncludeOther(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary-600"
                />
                <div className="flex-1">
                  <span>Other</span>
                  {includeOther && (
                    <textarea
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="Tell us more..."
                      className="input-field mt-2 text-sm"
                    />
                  )}
                </div>
              </label>
            </div>
          </div>

          {hasAssignedWorker && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={reschedule}
                onChange={(e) => setReschedule(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-600"
              />
              <span className="text-amber-900">
                Reschedule instead of cancelling — repost this request with a new
                date/time. The previously assigned worker won't be reassigned.
              </span>
            </label>
          )}
          {!hasAssignedWorker && (
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={reschedule}
                onChange={(e) => setReschedule(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary-600"
              />
              <span>Reschedule — repost this request with a new date/time.</span>
            </label>
          )}

          {reschedule && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <label className="label">New date</label>
                <input
                  type="date"
                  value={date}
                  min={todayStr()}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start time</label>
                  <TimeInput value={startTime} onChange={setStartTime} />
                </div>
                <div>
                  <label className="label">End time</label>
                  <TimeInput value={endTime} onChange={setEndTime} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary flex-1"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`flex-1 ${reschedule ? "btn-primary" : "rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700 disabled:opacity-50"}`}
          >
            {submitting
              ? reschedule
                ? "Reposting..."
                : "Cancelling..."
              : reschedule
                ? "Repost request"
                : "Cancel request"}
          </button>
        </div>
      </div>
    </div>
  );
}
