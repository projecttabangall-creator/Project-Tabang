import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import {
  AlertCircle,
  Ban,
  Clock,
  HeartHandshake,
  MapPin,
  TriangleAlert,
  User,
  Wrench,
} from "lucide-react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import api from "@/services/api";

interface Request {
  id: string;
  categoryName: string;
  itemName: string;
  description: string;
  suggestedPrice: number;
  finalPrice?: number;
  commission: number;
  commissionPercent?: number;
  totalForResident: number;
  location: any;
  locationAddress?: string;
  schedule: { date: any; startTime: string; endTime: string; numberOfDays?: number };
  status: string;
  paymentMethod: string;
  residentName?: string;
  workerName?: string;
  workerPhone?: string;
  photoUrls?: string[];
  isSpecialRequest?: boolean;
  beneficiary?: { firstName: string; lastName: string; contactNumber: string };
  specialRequestNote?: string;
  cancelledBy?: string;
  priceOverrideRequired?: boolean;
  pendingFinalPrice?: number;
  createdAt?: any;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  assigned: "bg-yellow-50 text-yellow-700",
  accepted: "bg-primary-50 text-primary-700",
  worker_arrived: "bg-purple-50 text-purple-700",
  price_confirmed: "bg-indigo-50 text-indigo-700",
  in_progress: "bg-accent-50 text-accent-700",
  completed: "bg-emerald-50 text-emerald-700",
  payment_submitted: "bg-emerald-50 text-emerald-700",
  payment_confirmed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-50 text-rose-700",
  under_dispute: "bg-orange-50 text-orange-700",
  resolved: "bg-slate-100 text-slate-600",
};

const getLat = (location: any) =>
  location?._latitude ?? location?.latitude ?? 0;
const getLng = (location: any) =>
  location?._longitude ?? location?.longitude ?? 0;
const formatDate = (value: any) =>
  typeof value === "object" && value?._seconds
    ? new Date(value._seconds * 1000).toLocaleDateString()
    : String(value ?? "");

const CANCELLABLE_STATUSES = [
  "pending",
  "assigned",
  "accepted",
  "worker_arrived",
  "price_confirmed",
  "in_progress",
];

export function AdminRequestDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [request, setRequest] = useState<Request | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  async function fetchRequest() {
    try {
      const { data } = await api.get(`/api/requests/${requestId}`);
      setRequest(data.request);
    } catch {
      toast.error("Failed to load request details");
      navigate("/admin/requests");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancel() {
    if (!requestId) return;
    setIsCancelling(true);
    try {
      await api.patch(`/api/requests/${requestId}/cancel`);
      toast.success("Request cancelled");
      setCancelConfirm(false);
      await fetchRequest();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to cancel request");
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!request) {
    return <div className="text-center py-12 text-slate-500">Request not found</div>;
  }

  const workerPrice = request.finalPrice || request.suggestedPrice;
  const commissionPercent = request.commissionPercent || 10;
  const canCancel = CANCELLABLE_STATUSES.includes(request.status);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <BackButton to="/admin/requests" label="Back to Requests" />

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-2xl font-bold">{request.categoryName}</h2>
              {request.isSpecialRequest && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-50 text-accent-700">
                  <HeartHandshake size={12} />
                  SPECIAL REQUEST
                </span>
              )}
            </div>
            <p className="text-slate-600">{request.itemName}</p>
            <p className="text-xs text-slate-400 mt-1">ID: {request.id}</p>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
              STATUS_COLORS[request.status] || "bg-slate-100 text-slate-700"
            }`}
          >
            {request.status.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
        <p className="text-slate-700">{request.description}</p>
      </div>

      {/* Photos from Resident */}
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

      {/* Special Request Beneficiary */}
      {request.isSpecialRequest && request.beneficiary && (
        <div className="card space-y-3 border-accent-200 bg-accent-50/30">
          <h3 className="font-semibold flex items-center gap-2 text-accent-700">
            <HeartHandshake size={18} /> Beneficiary
          </h3>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-slate-600">Name:</span>{" "}
              <span className="font-medium">
                {request.beneficiary.firstName} {request.beneficiary.lastName}
              </span>
            </p>
            <p>
              <span className="text-slate-600">Contact:</span>{" "}
              <span className="font-medium">{request.beneficiary.contactNumber}</span>
            </p>
            {request.specialRequestNote && (
              <p>
                <span className="text-slate-600">Reason:</span>{" "}
                <span className="font-medium">{request.specialRequestNote}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Resident Info */}
      {request.residentName && (
        <div className="card space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <User size={18} /> Resident
          </h3>
          <p className="text-sm font-medium">{request.residentName}</p>
        </div>
      )}

      {/* Assigned Worker */}
      {request.workerName && (
        <div className="card space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Wrench size={18} /> Assigned Worker
          </h3>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-slate-600">Name:</span>{" "}
              <span className="font-medium">{request.workerName}</span>
            </p>
            {request.workerPhone && (
              <p>
                <span className="text-slate-600">Phone:</span>{" "}
                <span className="font-medium">{request.workerPhone}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pricing */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="text-lg">₱</span> Pricing
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-600">Suggested Price</p>
            <p className="text-xl font-bold text-primary-600">
              ₱{request.suggestedPrice?.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600">
              {request.finalPrice ? "Final Price" : "Worker Price"}
            </p>
            <p className="text-xl font-bold text-accent-600">
              ₱{workerPrice?.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              Barangay Commission ({commissionPercent}%)
            </span>
            <span className="font-medium">₱{request.commission?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>₱{request.totalForResident?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Payment Method</span>
            <span className="font-medium uppercase">{request.paymentMethod}</span>
          </div>
        </div>
      </div>

      {/* Price Override Warning */}
      {request.priceOverrideRequired && request.pendingFinalPrice && (
        <div className="card bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2 text-amber-800">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Price override pending approval</p>
              <p className="mt-1">
                Requested final price: ₱{request.pendingFinalPrice?.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Schedule */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock size={18} /> Schedule
        </h3>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-slate-600">Date:</span>{" "}
            <span className="font-medium">{formatDate(request.schedule?.date)}</span>
          </p>
          <p>
            <span className="text-slate-600">Time:</span>{" "}
            <span className="font-medium">
              {request.schedule?.startTime ? `${request.schedule.startTime} – ${request.schedule.endTime}` : "No specified time"}
            </span>
          </p>
          {request.schedule?.numberOfDays && (
            <p>
              <span className="text-slate-600">Duration:</span>{" "}
              <span className="font-medium">{request.schedule.numberOfDays} day(s)</span>
            </p>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin size={18} /> Location
        </h3>
        {getLat(request.location) !== 0 && getLng(request.location) !== 0 && (
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
              <Marker
                position={[getLat(request.location), getLng(request.location)]}
              />
            </MapContainer>
          </div>
        )}
        {request.locationAddress && (
          <p className="text-sm text-slate-700">{request.locationAddress}</p>
        )}
        <p className="text-xs text-slate-400">
          {getLat(request.location).toFixed(6)},{" "}
          {getLng(request.location).toFixed(6)}
        </p>
      </div>

      {/* Cancel Button */}
      {canCancel && (
        <button
          onClick={() => setCancelConfirm(true)}
          className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Ban size={18} />
          Cancel This Request
        </button>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-6 py-6">
              <div className="flex items-start gap-3">
                <TriangleAlert size={32} className="text-white shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-lg text-white">Cancel Request?</h3>
                  <p className="text-rose-100 text-sm mt-1">
                    This action cannot be undone
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div className="bg-rose-50 border-l-4 border-rose-600 px-4 py-3 rounded">
                <p className="text-sm text-rose-800 font-medium">⚠️ Warning</p>
                <p className="text-sm text-rose-700 mt-2">
                  Cancelling this request will:
                </p>
                <ul className="text-xs text-rose-700 mt-2 space-y-1 ml-2">
                  <li>• Notify the resident of the cancellation</li>
                  <li>• Release the assigned worker (if any)</li>
                  <li>• Apply cancellation penalties if applicable</li>
                  <li>• Mark the request as cancelled permanently</li>
                </ul>
              </div>
              <div className="bg-slate-50 px-4 py-3 rounded text-xs text-slate-600">
                <span className="font-semibold">Request:</span>{" "}
                {request.categoryName} — {request.itemName}
              </div>
            </div>

            <div className="flex gap-2 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setCancelConfirm(false)}
                className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
              >
                Keep Request
              </button>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Ban size={16} />
                    Cancel Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
