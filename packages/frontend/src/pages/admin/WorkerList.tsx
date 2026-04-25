import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle,
  Clock3,
  XCircle,
  Star,
  Briefcase,
  UserPlus,
  Shield,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import api from "@/services/api";

interface Category {
  id: string;
  name: string;
  isActive?: boolean;
}

interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  contactNumber: string;
  email?: string;
  creditPoints: number;
  isVerified: boolean;
  isActive: boolean;
  accountStatus: string;
  workerData?: {
    specialization: string | string[];
    biometricEnrolled?: boolean;
    averageRating: number;
    completedJobsCount: number;
    acceptanceRate: number;
    isAvailable: boolean;
  };
}

export function WorkerList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const status = searchParams.get("status");
    return status === "pending" || status === "verified" ? status : "all";
  });
  const [biometricFilter, setBiometricFilter] = useState<string>(() => {
    const biometric = searchParams.get("biometric");
    return biometric === "enrolled" || biometric === "not-enrolled"
      ? biometric
      : "all";
  });
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      setLoading(false);
      toast.error("Loading workers took too long. Check if emulators are running.");
    }, 5000);

    fetchWorkers().finally(() => clearTimeout(timeout));
  }, [statusFilter, biometricFilter, categoryFilter, sortBy]);

  useEffect(() => {
    const nextStatus = searchParams.get("status");
    const normalizedStatus =
      nextStatus === "pending" || nextStatus === "verified" ? nextStatus : "all";
    if (normalizedStatus !== statusFilter) {
      setStatusFilter(normalizedStatus);
    }
    const nextBiometric = searchParams.get("biometric");
    const normalizedBiometric =
      nextBiometric === "enrolled" || nextBiometric === "not-enrolled"
        ? nextBiometric
        : "all";
    if (normalizedBiometric !== biometricFilter) {
      setBiometricFilter(normalizedBiometric);
    }
  }, [biometricFilter, searchParams, statusFilter]);

  async function fetchWorkers() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (sortBy !== "name") params.set("sortBy", sortBy);

      const query = params.toString() ? `?${params.toString()}` : "";
      const [{ data: workerData }, { data: categoryData }] = await Promise.all([
        api.get(`/api/workers${query}`),
        api.get("/api/categories"),
      ]);

      setWorkers(workerData.workers || []);
      setCategories(categoryData.categories || []);
    } catch (error) {
      console.error("Failed to load workers:", error);
      setWorkers([]);
      toast.error("Failed to load workers");
    } finally {
      setLoading(false);
    }
  }

  const categoryNameById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name]));
  }, [categories]);

  const visibleWorkers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filteredByBiometric =
      biometricFilter === "all"
        ? workers
        : workers.filter((worker) =>
            biometricFilter === "enrolled"
              ? Boolean(worker.workerData?.biometricEnrolled)
              : !worker.workerData?.biometricEnrolled
          );

    const filtered = query
      ? filteredByBiometric.filter((worker) => {
          const fullName = [
            worker.firstName,
            worker.middleInitial,
            worker.lastName,
            worker.contactNumber,
            worker.email,
            (Array.isArray(worker.workerData?.specialization)
              ? worker.workerData!.specialization
              : worker.workerData?.specialization
              ? [worker.workerData.specialization]
              : []
            ).map((id) => categoryNameById.get(id) || id).join(" "),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return fullName.includes(query);
        })
      : filteredByBiometric;

    if (sortBy !== "name") return filtered;

    return [...filtered].sort((a, b) => {
      const aName = `${a.lastName} ${a.firstName}`.toLowerCase();
      const bName = `${b.lastName} ${b.firstName}`.toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [biometricFilter, categoryNameById, searchQuery, sortBy, workers]);

  async function handleVerify(workerId: string) {
    try {
      await api.patch(`/api/workers/${workerId}/verify`);
      toast.success("Worker verified and activated");
      fetchWorkers();
    } catch {
      toast.error("Failed to verify worker");
    }
  }

  function renderWorkerStatus(worker: Worker) {
    if (worker.accountStatus === "banned") {
      return (
        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
          <Ban size={12} /> Banned
        </span>
      );
    }

    if (worker.accountStatus === "suspended") {
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full">
          <Clock3 size={12} /> Suspended
        </span>
      );
    }

    if (worker.isVerified) {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          <CheckCircle size={12} /> Verified
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
        <XCircle size={12} /> Pending
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Workers</h2>
        <Link
          to="/admin/workers/register"
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <UserPlus size={16} /> Register Worker
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "verified", label: "Verified" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              const nextParams = new URLSearchParams(searchParams);
              if (tab.value === "all") {
                nextParams.delete("status");
              } else {
                nextParams.set("status", tab.value);
              }
              setSearchParams(nextParams, { replace: true });
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              statusFilter === tab.value
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_190px_180px] gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workers by name, contact, or category"
              className="input-field pl-9"
            />
          </div>

          <label className="block">
            <span className="sr-only">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="sr-only">Biometric enrollment</span>
            <select
              value={biometricFilter}
              onChange={(e) => {
                const value = e.target.value;
                setBiometricFilter(value);
                const nextParams = new URLSearchParams(searchParams);
                if (value === "all") {
                  nextParams.delete("biometric");
                } else {
                  nextParams.set("biometric", value);
                }
                setSearchParams(nextParams, { replace: true });
              }}
              className="input-field"
            >
              <option value="all">All biometrics</option>
              <option value="enrolled">Fingerprint enrolled</option>
              <option value="not-enrolled">No fingerprint yet</option>
            </select>
          </label>

          <label className="block">
            <span className="sr-only">Sort workers</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field"
            >
              <option value="name">Sort by name</option>
              <option value="rating">Sort by rating</option>
              <option value="jobs">Sort by jobs</option>
              <option value="credit">Sort by credit</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
          <SlidersHorizontal size={14} />
          Showing {visibleWorkers.length} of {workers.length} worker
          {workers.length !== 1 ? "s" : ""}
        </div>
      </div>

      {visibleWorkers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">No workers found.</p>
          <p className="text-sm text-slate-400 mt-1">
            Try changing the search, biometric, category, sort, or status filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleWorkers.map((worker) => (
            <div
              key={worker.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/admin/workers/${worker.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/admin/workers/${worker.id}`);
                }
              }}
              className="card flex items-center justify-between cursor-pointer transition-all hover:border-primary-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center text-accent-700 font-bold text-sm">
                  {worker.firstName[0]}
                  {worker.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold">
                    {worker.lastName}, {worker.firstName}{" "}
                    {worker.middleInitial ? `${worker.middleInitial}.` : ""}
                  </p>
                  <p className="text-sm text-slate-500">
                    {worker.contactNumber}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-slate-400">
                    {worker.workerData?.specialization && (
                      <span>
                        {(Array.isArray(worker.workerData.specialization)
                          ? worker.workerData.specialization
                          : [worker.workerData.specialization]
                        )
                          .map((id) => categoryNameById.get(id) || id)
                          .join(", ")}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star size={12} />
                      {worker.workerData?.averageRating?.toFixed(1) || "N/A"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase size={12} />
                      {worker.workerData?.completedJobsCount || 0} jobs
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield size={12} />
                      {worker.creditPoints}/5 credit
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        worker.workerData?.biometricEnrolled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {worker.workerData?.biometricEnrolled
                        ? "Fingerprint enrolled"
                        : "No fingerprint"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {renderWorkerStatus(worker)}

                {/* Verify button */}
                {!worker.isVerified && worker.accountStatus === "active" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVerify(worker.id);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="btn-primary text-xs py-1 px-3"
                  >
                    Verify
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
