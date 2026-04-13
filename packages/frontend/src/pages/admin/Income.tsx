import { useState, useEffect } from "react";
import { toast } from "sonner";
import { TrendingUp, Users, Wallet, ArrowUpRight, ArrowDownRight, PiggyBank } from "lucide-react";
import api from "@/services/api";

type Period = "daily" | "weekly" | "monthly";

interface IncomeSummary {
  totalIncome: number;
  totalWorkerPayouts: number;
  totalCollected: number;
  totalTransactions: number;
}

interface IncomeBreakdown {
  label: string;
  income: number;
  workerPayouts: number;
  totalCollected: number;
  transactions: number;
}

export function Income() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [summary, setSummary] = useState<IncomeSummary | null>(null);
  const [breakdown, setBreakdown] = useState<IncomeBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchIncome();
  }, [period]);

  const fetchIncome = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get(`/api/admin/income?period=${period}`);
      setSummary(data.summary);
      setBreakdown(data.breakdown || []);
    } catch {
      toast.error("Failed to load income data");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    `₱ ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatLabel = (label: string) => {
    if (period === "daily") {
      const d = new Date(label + "T00:00:00");
      return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    }
    if (period === "weekly") {
      const d = new Date(label + "T00:00:00");
      return `Week of ${d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    // monthly: "2026-04" -> "April 2026"
    const [y, m] = label.split("-");
    const d = new Date(Number(y), Number(m) - 1);
    return d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Project Income</h1>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              period === p
                ? "bg-white text-primary-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                label="Commission Income"
                value={formatCurrency(summary.totalIncome)}
                icon={<TrendingUp size={20} />}
                color="emerald"
              />
              <SummaryCard
                label="Total Collected"
                value={formatCurrency(summary.totalCollected)}
                icon={<PiggyBank size={20} />}
                color="primary"
              />
              <SummaryCard
                label="Worker Payouts"
                value={formatCurrency(summary.totalWorkerPayouts)}
                icon={<Wallet size={20} />}
                color="accent"
              />
              <SummaryCard
                label="Transactions"
                value={summary.totalTransactions.toString()}
                icon={<Users size={20} />}
                color="slate"
              />
            </div>
          )}

          {/* Breakdown Table */}
          {breakdown.length === 0 ? (
            <div className="card text-center py-12">
              <div className="mx-auto mb-3 text-5xl text-slate-300 font-light">₱</div>
              <p className="text-slate-500 font-medium">No confirmed payments yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Income data will appear here once payments are confirmed.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-4 py-3 font-semibold text-slate-600">Period</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-right">Commission</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-right">Worker Payouts</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-right">Total Collected</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-right">Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row, i) => (
                      <tr
                        key={row.label}
                        className={`border-b border-slate-100 ${
                          i % 2 === 0 ? "bg-white" : "bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {formatLabel(row.label)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <ArrowUpRight size={14} />
                            {formatCurrency(row.income)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                            <ArrowDownRight size={14} />
                            {formatCurrency(row.workerPayouts)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          {formatCurrency(row.totalCollected)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {row.transactions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    primary: "bg-primary-50 text-primary-600",
    accent: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${colorMap[color] || colorMap.slate}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
