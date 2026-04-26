import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Plus,
  User,
  XCircle,
} from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import api from "@/services/api";
import { TimeInput } from "@/components/common/TimeInput";
import { format12hRange } from "@/utils/time";
import { useRequestDocumentLiveRefresh } from "@/hooks/useRequestLiveRefresh";

interface Request {
  id: string;
  categoryName: string;
  itemName: string;
  description: string;
  suggestedPrice: number;
  minPrice: number;
  finalPrice?: number;
  pendingFinalPrice?: number;
  commission: number;
  commissionPercent?: number;
  totalForResident: number;
  tipAmount?: number;
  priceChangeReason?: string;
  location: any;
  schedule: {
    date: any;
    startTime: string;
    endTime: string;
    numberOfDays?: number;
    workingSchedule?: Array<{ date: string; startTime: string; endTime: string }>;
  };
  status: string;
  residentName: string;
  residentPhone: string;
  photoUrls?: string[];
  proofOfWorkPhotoUrls?: string[];
  priceOverrideRequired?: boolean;
  assignedWorkerId?: string;
}

const getLat = (location: any) =>
  location?._latitude ?? location?.latitude ?? 0;
const getLng = (location: any) =>
  location?._longitude ?? location?.longitude ?? 0;
const formatDate = (value: any) =>
  typeof value === "object" && value?._seconds
    ? new Date(value._seconds * 1000).toLocaleDateString()
    : String(value);
const toDateInputValue = (value: any) =>
  typeof value === "object" && value?._seconds
    ? new Date(value._seconds * 1000).toISOString().split("T")[0]
    : String(value || toLocalDateInputValue());
const formatReadableDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
const toLocalDateInputValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};
const addDaysToInputDate = (date: string, days: number) => {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return toLocalDateInputValue(base);
};
const normalizeFutureDates = (dates: string[]) => {
  const today = toLocalDateInputValue();
  return [...new Set(dates.filter((date) => date && date >= today))].sort();
};
const getInitialWorkingDates = (requestDate: string, savedDates: string[] = []) => {
  const futureSavedDates = normalizeFutureDates(savedDates);
  if (futureSavedDates.length > 0) return futureSavedDates;

  const today = toLocalDateInputValue();
  return [requestDate >= today ? requestDate : today];
};

const DISPUTABLE_STATUSES = [
  "price_confirmed",
  "in_progress",
  "completed",
  "payment_submitted",
  "payment_confirmed",
];

// Green marker for worker's current location
const workerIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function MapBoundsAdjuster({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      try {
        map.fitBounds(
          L.latLngBounds(positions),
          { padding: [40, 40] }
        );
      } catch {}
    }
  }, [positions.length]);
  return null;
}

export function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [finalPrice, setFinalPrice] = useState("");
  const [priceChangeReason, setPriceChangeReason] = useState("");
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [capacityConfirmed, setCapacityConfirmed] = useState(false);
  const [selectedWorkingDates, setSelectedWorkingDates] = useState<string[]>([]);
  const [workingStart, setWorkingStart] = useState("08:00");
  const [workingEnd, setWorkingEnd] = useState("17:00");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [workerLocation, setWorkerLocation] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [visibleDateCount, setVisibleDateCount] = useState(3);

  useEffect(() => {
    fetchRequest();
  }, [jobId]);

  useRequestDocumentLiveRefresh(jobId, fetchRequest, Boolean(jobId));

  async function fetchRequest() {
    try {
      const { data } = await api.get(`/api/requests/${jobId}`);
      const currentRequest = data.request || null;
      setRequest(currentRequest);

      if (currentRequest?.pendingFinalPrice) {
        setFinalPrice(currentRequest.pendingFinalPrice.toString());
      } else if (currentRequest?.finalPrice) {
        setFinalPrice(currentRequest.finalPrice.toString());
      } else {
        setFinalPrice("");
      }

      setPriceChangeReason(currentRequest?.priceChangeReason || "");

      if (["assigned", "worker_arrived"].includes(currentRequest?.status)) {
        const requestedDate = toDateInputValue(currentRequest.schedule?.date);
        const savedWorkingDates = currentRequest.schedule?.workingSchedule?.map(
          (slot: { date: string }) => slot.date
        );
        const initial = getInitialWorkingDates(requestedDate, savedWorkingDates);
        setSelectedWorkingDates(initial);
        // Expand the visible window so any pre-selected dates remain visible.
        const today = toLocalDateInputValue();
        const maxOffset = initial.reduce((acc, date) => {
          if (date < today) return acc;
          const days = Math.round(
            (new Date(`${date}T00:00:00`).getTime() -
              new Date(`${today}T00:00:00`).getTime()) /
              86400000
          );
          return Math.max(acc, days);
        }, 0);
        const needed = maxOffset + 1;
        setVisibleDateCount((c) => Math.max(c, Math.max(3, needed)));
        setWorkingStart(currentRequest.schedule?.startTime || "08:00");
        setWorkingEnd(currentRequest.schedule?.endTime || "17:00");
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 403 || status === 404) {
        toast.info("This job is no longer available to you.");
      } else {
        toast.error("Failed to load job details");
      }
      navigate("/worker/home");
    } finally {
      setIsLoading(false);
    }
  }

  // Request worker's current location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }

    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setWorkerLocation([coords.latitude, coords.longitude]);
        setLocationStatus("granted");
        toast.success("Location shared! Route calculated.");
      },
      () => {
        setLocationStatus("denied");
        toast.error("Location access denied. Unable to get directions.");
      }
    );
  };

  // Fetch route from OSRM when we have both locations
  useEffect(() => {
    if (!workerLocation || !request) return;
    const jobLat = getLat(request.location);
    const jobLng = getLng(request.location);
    const [wLat, wLng] = workerLocation;

    const url = `https://router.project-osrm.org/route/v1/driving/${wLng},${wLat};${jobLng},${jobLat}?overview=full&geometries=geojson`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          setRouteCoords(
            route.geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
            )
          );
          setRouteInfo({ distance: route.distance, duration: route.duration });
        }
      })
      .catch(() => {}); // silently fail if routing fails
  }, [workerLocation, request?.id]);

  const handleAccept = async () => {
    const wasPendingClaim =
      request?.status === "pending" && !request?.assignedWorkerId;
    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/accept`);
      toast.success(
        wasPendingClaim
          ? "Job claimed. Confirm by accepting it below."
          : "Job accepted. You can now proceed to the location."
      );
      await fetchRequest();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          (wasPendingClaim ? "Failed to claim job" : "Failed to accept job")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Are you sure you want to reject this job?")) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/reject`);
      toast.success("Job rejected. The system will reassign it.");
      navigate("/worker/home");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to reject job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkArrived = async () => {
    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/arrived`);
      toast.success("Arrival confirmed. Set the final price next.");
      await fetchRequest();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to mark arrival");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWorkerCancel = async () => {
    setCancelSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/worker-cancel`);
      toast.success("Job cancelled. Request returned to queue.");
      navigate("/worker/home");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to cancel job");
    } finally {
      setCancelSubmitting(false);
      setShowCancelConfirm(false);
    }
  };

  const submitFinalPrice = async () => {
    if (!request) return;

    const numericFinalPrice = Number(finalPrice);
    if (!numericFinalPrice || numericFinalPrice <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    if (numericFinalPrice !== request.suggestedPrice && !priceChangeReason.trim()) {
      toast.error("Please explain why the final price changed");
      return;
    }

    if (selectedWorkingDates.length === 0) {
      toast.error("Select at least one working date.");
      return;
    }

    const today = toLocalDateInputValue();
    if (selectedWorkingDates.some((date) => date < today)) {
      toast.error("Working dates cannot be in the past.");
      return;
    }

    if (new Set(selectedWorkingDates).size !== selectedWorkingDates.length) {
      toast.error("Select each working date only once.");
      return;
    }

    if (workingStart >= workingEnd) {
      toast.error("Working start time must be before end time.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.patch(`/api/requests/${jobId}/final-price`, {
        finalPrice: numericFinalPrice,
        priceChangeReason: priceChangeReason.trim(),
        finalSchedule: {
          workingSchedule: selectedWorkingDates
            .slice()
            .sort()
            .map((date) => ({
              date,
              startTime: workingStart,
              endTime: workingEnd,
            })),
        },
      });

      if (data.requiresAdminApproval) {
        toast.success("Final price submitted for admin approval.");
      } else {
        toast.success("Final price confirmed. You can now start the work.");
      }

      await fetchRequest();
      setShowPriceForm(false);
      setShowSummary(false);
      setCapacityConfirmed(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to set final price");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetFinalPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericFinalPrice = Number(finalPrice);
    if (!numericFinalPrice || numericFinalPrice <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (numericFinalPrice !== request!.suggestedPrice && !priceChangeReason.trim()) {
      toast.error("Please explain why the final price changed");
      return;
    }
    if (selectedWorkingDates.length === 0) {
      toast.error("Select at least one working date.");
      return;
    }
    const today = toLocalDateInputValue();
    if (selectedWorkingDates.some((date) => date < today)) {
      toast.error("Working dates cannot be in the past.");
      return;
    }
    if (new Set(selectedWorkingDates).size !== selectedWorkingDates.length) {
      toast.error("Select each working date only once.");
      return;
    }
    if (workingStart >= workingEnd) {
      toast.error("Working start time must be before end time.");
      return;
    }
    setShowSummary(true);
  };

  const handleComplete = async () => {
    if (!confirm("Mark this job as complete?")) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/complete`);
      toast.success("Job completed. Waiting for resident payment submission.");
      await fetchRequest();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to complete job");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!request) {
    return <div className="text-center py-12 text-slate-500">Job not found</div>;
  }

  const statusBadgeColor = {
    assigned: "bg-yellow-50 text-yellow-700",
    accepted: "bg-primary-50 text-primary-700",
    worker_arrived: "bg-purple-50 text-purple-700",
    price_confirmed: "bg-indigo-50 text-indigo-700",
    in_progress: "bg-accent-50 text-accent-700",
    completed: "bg-emerald-50 text-emerald-700",
    payment_submitted: "bg-emerald-50 text-emerald-700",
    payment_confirmed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-50 text-red-700",
  } as const;

  const numericFinalPrice = Number(finalPrice || 0);
  const previewCommissionPercent = request.commissionPercent || 10;
  const previewCommission = numericFinalPrice
    ? Math.round(numericFinalPrice * (previewCommissionPercent / 100))
    : 0;
  const previewTotal = numericFinalPrice ? numericFinalPrice + previewCommission : 0;
  const requestedDate = toDateInputValue(request.schedule.date);
  const shownWorkingSchedule =
    request.schedule.workingSchedule && request.schedule.workingSchedule.length > 0
      ? request.schedule.workingSchedule
      : request.schedule.startTime
        ? [
            {
              date: requestedDate,
              startTime: request.schedule.startTime,
              endTime: request.schedule.endTime,
            },
          ]
        : [];
  const previewWorkingSchedule = selectedWorkingDates
    .slice()
    .sort()
    .map((date) => ({
      date,
      startTime: workingStart,
      endTime: workingEnd,
    }));

  const visibleWorkingDateOptions = (() => {
    const today = toLocalDateInputValue();
    return Array.from({ length: visibleDateCount }, (_, i) =>
      addDaysToInputDate(today, i)
    );
  })();

  const toggleWorkingDate = (date: string) => {
    setSelectedWorkingDates((current) =>
      current.includes(date)
        ? current.filter((d) => d !== date)
        : [...current, date].sort()
    );
  };

  const addMoreDays = () => {
    setVisibleDateCount((c) => c + 3);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <BackButton to="/worker/home" label="Back to Jobs" />

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{request.categoryName}</h2>
            <p className="text-slate-600">{request.itemName}</p>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              statusBadgeColor[request.status as keyof typeof statusBadgeColor] ||
              "bg-slate-100 text-slate-700"
            }`}
          >
            {request.status.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
        <p className="text-slate-700">{request.description}</p>
      </div>

      {request.photoUrls && request.photoUrls.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold">Photos from Resident</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {request.photoUrls.map((photoUrl, index) => (
              <a
                key={index}
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 w-32 h-32 rounded-lg overflow-hidden border border-slate-200 hover:border-primary-400 transition-colors"
              >
                <img
                  src={photoUrl}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <User size={18} /> Resident Information
        </h3>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-slate-600">Name:</span>{" "}
            <span className="font-medium">{request.residentName}</span>
          </p>
          <p className="flex items-center gap-2">
            <Phone size={14} className="text-slate-600" />
            <span className="font-medium">{request.residentPhone}</span>
          </p>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="text-lg">₱</span> Pricing
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-600">Suggested Price</p>
            <p className="text-xl font-bold text-primary-600">
              PHP {request.suggestedPrice}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600">Minimum Price</p>
            <p className="text-xl font-bold text-slate-700">PHP {request.minPrice}</p>
          </div>
        </div>

        {(request.finalPrice || request.pendingFinalPrice) && (
          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs text-slate-600">
              {request.priceOverrideRequired ? "Pending Final Price" : "Final Price"}
            </p>
            <p className="text-xl font-bold text-accent-600">
              PHP {request.pendingFinalPrice || request.finalPrice}
            </p>
          </div>
        )}

        {(request.tipAmount ?? 0) > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">🎁 Tip from Resident</p>
              <p className="text-xs text-amber-600 mt-0.5">Does not affect service fee</p>
            </div>
            <p className="text-xl font-bold text-amber-700">PHP {request.tipAmount}</p>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Final price must be at least the item minimum. Above 2x the suggested
          price needs admin approval.
        </p>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock size={18} /> Working Schedule
        </h3>
        <div className="space-y-2 text-sm">
          {shownWorkingSchedule.length > 0 ? (
            shownWorkingSchedule.map((slot) => (
              <div
                key={`${slot.date}-${slot.startTime}-${slot.endTime}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="font-medium">{formatReadableDate(slot.date)}</span>
                <span className="text-slate-600">
                  {format12hRange(slot.startTime, slot.endTime)}
                </span>
              </div>
            ))
          ) : (
            <p>
              <span className="text-slate-600">Requested date:</span>{" "}
              <span className="font-medium">{formatDate(request.schedule.date)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin size={18} /> Location
          {request.status === "accepted" && (
            <span className="ml-auto text-xs font-normal text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
              Navigation Mode
            </span>
          )}
        </h3>

        {routeInfo && (
          <div className="flex gap-6 text-sm bg-primary-50 rounded-lg px-4 py-3">
            <div>
              <span className="text-slate-600">Distance: </span>
              <span className="font-semibold">{(routeInfo.distance / 1000).toFixed(1)} km</span>
            </div>
            <div>
              <span className="text-slate-600">ETA: </span>
              <span className="font-semibold">{Math.ceil(routeInfo.duration / 60)} min</span>
            </div>
          </div>
        )}

        <div className="h-64 rounded-lg overflow-hidden border border-slate-200">
          <MapContainer
            center={[getLat(request.location), getLng(request.location)]}
            zoom={15}
            style={{ height: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <Marker position={[getLat(request.location), getLng(request.location)]} />
            {workerLocation && <Marker position={workerLocation} icon={workerIcon} />}
            {routeCoords.length > 0 && (
              <Polyline
                positions={routeCoords}
                color="#3b82f6"
                weight={4}
                opacity={0.8}
              />
            )}
            {workerLocation && (
              <MapBoundsAdjuster
                positions={[
                  workerLocation,
                  [getLat(request.location), getLng(request.location)],
                ]}
              />
            )}
          </MapContainer>
        </div>

        <p className="text-xs text-slate-500">
          Coordinates: {getLat(request.location).toFixed(4)},{" "}
          {getLng(request.location).toFixed(4)}
        </p>

        {request.status === "accepted" && (
          <>
            {locationStatus === "idle" && (
              <button
                onClick={requestLocation}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                📍 Share Your Location
              </button>
            )}

            {locationStatus === "loading" && (
              <div className="w-full py-3 bg-primary-50 text-primary-700 font-medium rounded-lg flex items-center justify-center gap-2">
                <div className="h-4 w-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                Getting your location...
              </div>
            )}

            {locationStatus === "denied" && (
              <div className="space-y-2">
                <div className="w-full py-3 bg-rose-50 text-rose-700 font-medium rounded-lg text-center text-sm">
                  ⚠️ Location access denied
                </div>
                <button
                  onClick={requestLocation}
                  className="btn-secondary w-full"
                >
                  Retry Location
                </button>
              </div>
            )}

            {locationStatus === "granted" && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${workerLocation![0]},${workerLocation![1]}&destination=${getLat(request.location)},${getLng(request.location)}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <Navigation size={18} />
                Open in Google Maps
              </a>
            )}
          </>
        )}
      </div>

      {request.status === "worker_arrived" && request.priceOverrideRequired && (
        <div className="card bg-amber-50 border border-amber-200 text-amber-800">
          Waiting for admin approval on the submitted final price before work can
          continue.
        </div>
      )}

      {request.status === "worker_arrived" && !request.priceOverrideRequired && (
        <div className="card space-y-4">
          <h3 className="font-semibold">Set Final Price</h3>
          {!showPriceForm ? (
            <button
              onClick={() => setShowPriceForm(true)}
              className="btn-primary w-full"
            >
              Set Final Price
            </button>
          ) : (
            <form onSubmit={handleSetFinalPrice} className="space-y-3">
              <div>
                <label className="label">Final Price (PHP)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Enter agreed price"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  className="input-field"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Any positive amount. Above PHP {request.suggestedPrice * 2} will be sent for admin approval.
                </p>
              </div>

              <div>
                <label className="label">Reason for Price Change</label>
                <textarea
                  placeholder="Explain why the final price differs from the suggested price."
                  value={priceChangeReason}
                  onChange={(e) => setPriceChangeReason(e.target.value)}
                  className="input-field h-20"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Required when the final price changes from the suggested price.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Calendar size={16} />
                  Final Working Schedule
                </div>
                <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    Tick the days you'll work on this job.
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {visibleWorkingDateOptions.map((date) => {
                      const checked = selectedWorkingDates.includes(date);
                      return (
                        <label
                          key={date}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            checked
                              ? "border-primary-500 bg-primary-50 text-primary-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-primary-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleWorkingDate(date)}
                            className="h-4 w-4 accent-primary-600"
                          />
                          <span className="font-medium">
                            {formatReadableDate(date)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={addMoreDays}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-primary-400 hover:text-primary-600"
                  >
                    <Plus size={16} />
                    Add days
                  </button>
                  {selectedWorkingDates.length === 0 && (
                    <p className="text-xs text-rose-500">
                      Select at least one working date.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Start Time</label>
                    <TimeInput value={workingStart} onChange={setWorkingStart} />
                  </div>
                  <div>
                    <label className="label">End Time</label>
                    <TimeInput value={workingEnd} onChange={setWorkingEnd} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!finalPrice || Number(finalPrice) <= 0}
                  className="btn-primary flex-1"
                >
                  Review & Confirm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPriceForm(false);
                    setFinalPrice(request.finalPrice?.toString() || "");
                    setPriceChangeReason("");
                    setSelectedWorkingDates(
                      getInitialWorkingDates(
                        requestedDate,
                        request.schedule.workingSchedule?.map((slot) => slot.date)
                      )
                    );
                    setVisibleDateCount(3);
                  }}
                  className="btn-secondary flex-1"
                >
                  Back
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {request.status === "worker_arrived" && !request.priceOverrideRequired && (
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="w-full py-3 border border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
        >
          Cancel Job
        </button>
      )}

      <div className="card space-y-3">
        {request.status === "assigned" && (
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={isSubmitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              {isSubmitting ? "Accepting..." : "Accept Job"}
            </button>
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              className="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <XCircle size={18} />
              {isSubmitting ? "Rejecting..." : "Reject Job"}
            </button>
          </div>
        )}

        {request.status === "pending" && !request.assignedWorkerId && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              No worker has accepted this yet. Claim it first to take the job.
            </p>
            <button
              onClick={handleAccept}
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              {isSubmitting ? "Claiming..." : "Claim Job"}
            </button>
          </div>
        )}

        {request.status === "accepted" && (
          <div className="space-y-2">
            <button
              onClick={handleMarkArrived}
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? "Marking..." : "Mark as Arrived"}
            </button>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full py-3 border border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
            >
              Cancel Job
            </button>
          </div>
        )}

        {["in_progress", "price_confirmed"].includes(request.status) && (
          <button
            onClick={handleComplete}
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <CheckCircle size={18} />
            {isSubmitting ? "Completing..." : "Complete Job"}
          </button>
        )}

        {request.status === "completed" && (
          <p className="text-sm text-slate-600 text-center py-2">
            Waiting for the resident to submit payment proof.
          </p>
        )}

        {request.status === "payment_submitted" && (
          <p className="text-sm text-slate-600 text-center py-2">
            Payment submitted. Waiting for admin confirmation.
          </p>
        )}

        {request.status === "payment_confirmed" && (
          <p className="text-sm text-emerald-700 text-center py-2 font-medium">
            Payment confirmed.
          </p>
        )}
      </div>

      {DISPUTABLE_STATUSES.includes(request.status) && (
        <Link
          to={`/worker/job/${jobId}/dispute`}
          className="w-full py-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <AlertTriangle size={18} />
          File a Dispute
        </Link>
      )}

      {/* Cancel Job Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4 relative z-[1001]">
            <h3 className="font-bold text-red-600 text-lg">Cancel This Job?</h3>
            <p className="text-sm text-slate-700">
              The request will return to the queue and a different worker will be assigned.
              This cancellation will be recorded on your profile.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleWorkerCancel}
                disabled={cancelSubmitting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {cancelSubmitting ? "Cancelling..." : "Yes, Cancel Job"}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelSubmitting}
                className="flex-1 py-2 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Summary / Confirmation Modal */}
      {showSummary && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto relative z-[1001]">
            <h3 className="font-bold text-slate-800 text-lg">Review & Confirm</h3>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-1">
              <p className="font-semibold text-slate-700 mb-2">Price Breakdown</p>
              <div className="flex justify-between">
                <span className="text-slate-600">Worker Price</span>
                <span className="font-medium">PHP {numericFinalPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Barangay Fee ({previewCommissionPercent}%)</span>
                <span className="font-medium">PHP {previewCommission}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold">
                <span>Total Resident Pays</span>
                <span>PHP {previewTotal}</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-1">
              <p className="font-semibold text-slate-700 mb-2">Working Schedule</p>
              {previewWorkingSchedule.map((slot) => (
                <div
                  key={`${slot.date}-${slot.startTime}-${slot.endTime}-summary`}
                  className="flex justify-between"
                >
                  <span className="text-slate-600">{formatReadableDate(slot.date)}</span>
                  <span className="font-medium">
                    {format12hRange(slot.startTime, slot.endTime)}
                  </span>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={capacityConfirmed}
                onChange={(e) => setCapacityConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary-600 shrink-0"
              />
              <span className="text-sm text-slate-700">
                I confirm I have the necessary skills, equipment, and materials to complete this job.
              </span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={submitFinalPrice}
                disabled={!capacityConfirmed || isSubmitting}
                className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Confirming..." : "Confirm"}
              </button>
              <button
                onClick={() => { setShowSummary(false); setCapacityConfirmed(false); }}
                disabled={isSubmitting}
                className="flex-1 py-2 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
