import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Star, MessageSquare } from "lucide-react";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";
import { useAuth } from "@/contexts/AuthContext";

interface Survey {
  id: string;
  status: "pending" | "submitted";
  role: "resident" | "worker";
  categoryName?: string;
  finalPrice?: number | null;
  ratings?: Record<string, number>;
  comment?: string;
  createdAt?: any;
  submittedAt?: any;
}

const QUESTIONS: Array<{ key: string; label: string }> = [
  { key: "overallSatisfaction", label: "Overall satisfaction with the service" },
  { key: "easeOfUse", label: "How easy is the app to use?" },
  { key: "communicationQuality", label: "Quality of communication on this job" },
  { key: "wouldRecommend", label: "Would you recommend Project Tabang to others?" },
];

function StarRow({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`transition-colors ${
            n <= value ? "text-amber-500" : "text-slate-300"
          } ${disabled ? "cursor-default" : "hover:text-amber-500"}`}
        >
          <Star size={22} fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export function FeedbackSurveys() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const role = userProfile?.role;
  const homePath =
    role === "worker"
      ? "/worker/home"
      : role === "resident"
        ? "/resident/requests"
        : "/admin/dashboard";

  useEffect(() => {
    fetchSurveys();
  }, []);

  async function fetchSurveys() {
    try {
      const { data } = await api.get("/api/feedback-surveys/my");
      setSurveys(data.surveys || []);
    } catch {
      toast.error("Failed to load feedback surveys");
    } finally {
      setLoading(false);
    }
  }

  function startSurvey(s: Survey) {
    setActiveId(s.id);
    setRatings({});
    setComment("");
  }

  async function submit() {
    if (!activeId) return;
    if (Object.keys(ratings).length === 0) {
      toast.error("Please rate at least one question");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/api/feedback-surveys/${activeId}/submit`, {
        ratings,
        comment,
      });
      toast.success("Thanks for your feedback!");
      setActiveId(null);
      await fetchSurveys();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const pending = surveys.filter((s) => s.status === "pending");
  const submitted = surveys.filter((s) => s.status === "submitted");
  const active = surveys.find((s) => s.id === activeId) || null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <BackButton to={homePath} label="Back" />

      <div>
        <h2 className="text-2xl font-bold mb-1">Feedback &amp; Surveys</h2>
        <p className="text-sm text-slate-500">
          Share your experience after each completed and confirmed job. Your
          input helps Project Tabang improve.
        </p>
      </div>

      {active ? (
        <div className="card space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Job: {active.categoryName || "Service"}
            </p>
            <h3 className="text-lg font-semibold">Rate your experience</h3>
          </div>
          {QUESTIONS.map((q) => (
            <div
              key={q.key}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <p className="text-sm font-medium mb-2">{q.label}</p>
              <StarRow
                value={ratings[q.key] || 0}
                onChange={(v) => setRatings((cur) => ({ ...cur, [q.key]: v }))}
              />
            </div>
          ))}
          <div>
            <label className="label">Additional comments (optional)</label>
            <textarea
              className="input-field"
              rows={4}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything else you'd like the admin to know?"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setActiveId(null)}
              disabled={submitting}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit feedback"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Pending ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-500">
                No pending surveys. We'll send you one once admin confirms a payment.
              </p>
            ) : (
              pending.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => startSurvey(s)}
                  className="card w-full text-left hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {s.categoryName || "Completed job"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Tap to share your experience
                      </p>
                    </div>
                    <span className="text-xs rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                      Pending
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Submitted ({submitted.length})
            </h3>
            {submitted.map((s) => (
              <div key={s.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">
                    {s.categoryName || "Completed job"}
                  </p>
                  <span className="text-xs rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                    Submitted
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  {QUESTIONS.map((q) => (
                    <div key={q.key} className="flex items-center justify-between">
                      <span className="text-slate-600">{q.label}</span>
                      <StarRow
                        value={s.ratings?.[q.key] || 0}
                        onChange={() => {}}
                        disabled
                      />
                    </div>
                  ))}
                  {s.comment && (
                    <p className="mt-2 flex items-start gap-2 text-slate-700">
                      <MessageSquare size={14} className="mt-0.5 shrink-0" />
                      <span className="text-xs">{s.comment}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
