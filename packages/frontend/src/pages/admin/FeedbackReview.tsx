import { useEffect, useMemo, useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";

interface Survey {
  id: string;
  userId: string;
  userName: string;
  userContact: string;
  role: "resident" | "worker";
  status: "pending" | "submitted";
  categoryName?: string;
  finalPrice?: number | null;
  ratings?: Record<string, number>;
  comment?: string;
  createdAt?: any;
  submittedAt?: any;
  requestId: string;
}

const QUESTIONS: Array<{ key: string; label: string }> = [
  { key: "overallSatisfaction", label: "Overall satisfaction" },
  { key: "easeOfUse", label: "Ease of use" },
  { key: "communicationQuality", label: "Communication quality" },
  { key: "wouldRecommend", label: "Would recommend" },
];

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmtTimestamp(v: any) {
  const ms = v?._seconds
    ? v._seconds * 1000
    : typeof v?.toMillis === "function"
      ? v.toMillis()
      : null;
  return ms ? new Date(ms).toLocaleString() : "";
}

export function FeedbackReview() {
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [filter, setFilter] = useState<"all" | "resident" | "worker">("all");

  useEffect(() => {
    fetchSurveys();
  }, []);

  async function fetchSurveys() {
    try {
      const { data } = await api.get("/api/feedback-surveys");
      setSurveys(data.surveys || []);
    } catch {
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => (filter === "all" ? surveys : surveys.filter((s) => s.role === filter)),
    [surveys, filter]
  );

  const stats = useMemo(() => {
    const out: Record<string, { sum: number; count: number }> = {};
    for (const s of filtered) {
      if (!s.ratings) continue;
      for (const q of QUESTIONS) {
        const v = s.ratings[q.key];
        if (typeof v !== "number") continue;
        if (!out[q.key]) out[q.key] = { sum: 0, count: 0 };
        out[q.key].sum += v;
        out[q.key].count += 1;
      }
    }
    return QUESTIONS.map((q) => ({
      key: q.key,
      label: q.label,
      avg: out[q.key] ? out[q.key].sum / out[q.key].count : 0,
      count: out[q.key]?.count ?? 0,
    }));
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />

      <div>
        <h2 className="text-2xl font-bold">Feedback Review</h2>
        <p className="text-sm text-slate-500">
          Survey responses from residents and workers after their payments are
          confirmed.
        </p>
      </div>

      <div className="flex gap-2">
        {(["all", "resident", "worker"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === f
                ? "bg-primary-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="card text-center">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-2xl font-bold text-primary-600">
              {s.avg.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400">{s.count} response(s)</p>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">No submitted feedback yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div key={s.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {s.userName}{" "}
                    <span className="text-xs uppercase rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      {s.role}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.categoryName || "Service"} · Submitted{" "}
                    {fmtTimestamp(s.submittedAt) || fmtTimestamp(s.createdAt)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-primary-600">
                  Avg{" "}
                  {avg(
                    QUESTIONS.map((q) => s.ratings?.[q.key] || 0).filter(
                      (n) => n > 0
                    )
                  ).toFixed(2)}
                </p>
              </div>
              <div className="grid gap-1.5 text-sm md:grid-cols-2">
                {QUESTIONS.map((q) => (
                  <div
                    key={q.key}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1"
                  >
                    <span className="text-slate-600">{q.label}</span>
                    <span className="flex items-center gap-1 font-medium">
                      {s.ratings?.[q.key] || "—"}
                      <Star size={14} className="text-amber-500" fill="currentColor" />
                    </span>
                  </div>
                ))}
              </div>
              {s.comment && (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-start gap-2">
                  <MessageSquare size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>{s.comment}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
