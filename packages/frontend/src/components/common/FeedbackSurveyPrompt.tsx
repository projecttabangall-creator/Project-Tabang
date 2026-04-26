import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HandHeart, Star, X, Sun } from "lucide-react";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface Survey {
  id: string;
  status: "pending" | "submitted" | "dismissed";
  role: "resident" | "worker";
  categoryName?: string;
  finalPrice?: number | null;
  createdAt?: any;
}

const QUESTIONS: Array<{ key: string; label: string }> = [
  { key: "overallSatisfaction", label: "Overall, how was your experience?" },
  { key: "easeOfUse", label: "Was the app easy to use?" },
  { key: "communicationQuality", label: "How was the communication on this job?" },
  { key: "wouldRecommend", label: "Would you recommend Project Tabang to others?" },
];

// Logo-derived gradient: deep blue → vivid orange, with a sun-yellow stop
const LOGO_GRADIENT =
  "linear-gradient(135deg, #1d4ed8 0%, #2563eb 35%, #fbbf24 65%, #f97316 100%)";

function StarRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`transition-transform duration-150 hover:scale-110 ${
            n <= value
              ? "text-amber-500 drop-shadow-[0_1px_0_rgba(251,146,60,0.4)]"
              : "text-slate-300 hover:text-amber-400"
          }`}
        >
          <Star size={28} fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

const SESSION_DEFER_KEY = "tabang.feedbackPromptDeferred";

export function FeedbackSurveyPrompt() {
  const { userProfile } = useAuth();
  const [queue, setQueue] = useState<Survey[]>([]);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");

  const role = userProfile?.role;
  const canSurvey = role === "resident" || role === "worker";
  const current = queue[0] || null;

  useEffect(() => {
    if (!canSurvey) return;
    if (sessionStorage.getItem(SESSION_DEFER_KEY) === "1") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/feedback-surveys/my", {
          params: { status: "pending" },
        });
        if (!cancelled) {
          setQueue((data.surveys || []) as Survey[]);
        }
      } catch {
        // silent — feature is optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canSurvey, userProfile?.uid]);

  function reset() {
    setShowForm(false);
    setRatings({});
    setComment("");
  }

  function popQueue() {
    setQueue((q) => q.slice(1));
    reset();
  }

  function deferForSession() {
    sessionStorage.setItem(SESSION_DEFER_KEY, "1");
    setQueue([]);
    reset();
  }

  async function dismiss() {
    if (!current) return;
    setBusy(true);
    try {
      await api.patch(`/api/feedback-surveys/${current.id}/dismiss`);
      toast.success("No worries — maybe next time.");
      popQueue();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!current) return;
    if (Object.keys(ratings).length === 0) {
      toast.error("Tap at least one star to share your experience.");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/api/feedback-surveys/${current.id}/submit`, {
        ratings,
        comment,
      });
      toast.success("Salamat! Your feedback helps us improve.");
      popQueue();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  if (!canSurvey || !current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-hidden rounded-[20px] bg-white shadow-2xl">
        {/* Animated gradient ring at the top edge */}
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: LOGO_GRADIENT }}
        />

        {/* Header banner — Tabang logo gradient */}
        <div
          className="relative px-5 pt-7 pb-6 text-white"
          style={{ background: LOGO_GRADIENT }}
        >
          {/* Soft radial highlight to give depth */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 20% 10%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
            }}
          />
          <button
            type="button"
            onClick={deferForSession}
            disabled={busy}
            className="absolute right-3 top-3 rounded-full bg-white/15 p-1.5 backdrop-blur-sm hover:bg-white/25 transition-colors"
            title="Maybe later"
          >
            <X size={16} />
          </button>

          <div className="relative flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <HandHeart size={20} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-95">
              A quick favor
            </p>
          </div>

          <h3 className="relative mt-3 text-xl font-bold leading-snug">
            How did{" "}
            <span className="inline-flex items-center gap-1">
              Tabang
              <Sun size={16} className="text-amber-200" fill="currentColor" />
            </span>{" "}
            do for you?
          </h3>
          <p className="relative mt-1.5 text-sm text-white/95">
            Your payment for{" "}
            <span className="font-semibold">
              {current.categoryName || "your service"}
            </span>{" "}
            was just confirmed. Two minutes of feedback goes a long way.
          </p>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 max-h-[calc(90vh-180px)]">
          {!showForm ? (
            <>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  We use your input to make Project Tabang better for{" "}
                  {current.role === "resident" ? "residents" : "workers"} like
                  you.
                </p>
                <ul className="space-y-1 pl-1 text-slate-500">
                  <li className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "#1d4ed8" }}
                    />
                    Four short star questions
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "#fbbf24" }}
                    />
                    Optional comment box
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "#f97316" }}
                    />
                    Anonymous to other users
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  disabled={busy}
                  className="relative w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:translate-y-[-1px] active:translate-y-0 disabled:opacity-60"
                  style={{ background: LOGO_GRADIENT }}
                >
                  Yes, I'll share my feedback
                </button>
                <button
                  type="button"
                  onClick={deferForSession}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Maybe later
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  disabled={busy}
                  className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:text-slate-600"
                >
                  No thanks, don't ask again for this job
                </button>
              </div>
            </>
          ) : (
            <>
              {QUESTIONS.map((q, idx) => (
                <div
                  key={q.key}
                  className="relative rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
                >
                  {/* Tiny gradient bar to mark each question */}
                  <span
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-r"
                    style={{
                      background:
                        idx % 2 === 0
                          ? "linear-gradient(180deg, #1d4ed8, #2563eb)"
                          : "linear-gradient(180deg, #fbbf24, #f97316)",
                    }}
                  />
                  <p className="ml-2 text-sm font-medium text-slate-700 mb-2">
                    {q.label}
                  </p>
                  <div className="ml-2">
                    <StarRow
                      value={ratings[q.key] || 0}
                      onChange={(v) =>
                        setRatings((cur) => ({ ...cur, [q.key]: v }))
                      }
                    />
                  </div>
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Anything else? (optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what worked, or what we can do better."
                  className="input-field mt-1 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={busy}
                  className="btn-secondary flex-1"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="relative flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:translate-y-[-1px] active:translate-y-0 disabled:opacity-60"
                  style={{ background: LOGO_GRADIENT }}
                >
                  {busy ? "Sending..." : "Send feedback"}
                </button>
              </div>
            </>
          )}
          {queue.length > 1 && (
            <p className="text-center text-xs text-slate-400">
              {queue.length - 1} more job{queue.length - 1 === 1 ? "" : "s"} to
              review after this.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
