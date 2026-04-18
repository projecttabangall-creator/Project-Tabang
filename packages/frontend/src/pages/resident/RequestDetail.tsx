import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  MapPin,
  MessageCircle,
  Star,
  Trash2,
  User,
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
  schedule: { date: any; startTime: string; endTime: string };
  status: string;
  workerName?: string;
  workerPhone?: string;
  workerRating?: number;
  yourRating?: number;
  photoUrls?: string[];
  priceOverrideRequired?: boolean;
}

const getLat = (location: any) =>
  location?._latitude ?? location?.latitude ?? 0;
const getLng = (location: any) =>
  location?._longitude ?? location?.longitude ?? 0;
const formatDate = (value: any) =>
  typeof value === "object" && value?._seconds
    ? new Date(value._seconds * 1000).toLocaleDateString()
    : String(value);

const DISPUTABLE_STATUSES = [
  "in_progress",
  "completed",
  "payment_submitted",
  "payment_confirmed",
];

export function RequestDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showRatingForm, setShowRatingForm] = useState(false);

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      const { data } = await api.get(`/api/requests/${requestId}`);
      setRequest(data.request || null);
      if (data.request && typeof data.request.yourRating === "number") {
        setRating(data.request.yourRating);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to load request details";
      console.error("Request detail error:", errorMsg, error.response?.status);
      toast.error(errorMsg);
      setTimeout(() => navigate("/resident/requests"), 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this request?")) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${requestId}/cancel`, {
        reason: "Cancelled by resident",
      });
      toast.success("Request cancelled");
      navigate("/resident/requests");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to cancel request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRateWorker = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating < 1 || rating > 5) {
      toast.error("Please select a rating between 1 and 5");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/api/requests/${requestId}/rate`, {
        rating,
        ratingComment: comment,
      });
      toast.success("Thank you for rating the worker.");
      await fetchRequest();
      setShowRatingForm(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to submit rating");
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
    return <div className="text-center py-12 text-slate-500">Request not found</div>;
  }

  const statusBadgeColor = {
    pending: "bg-slate-100 text-slate-700",
    assigned: "bg-yellow-50 text-yellow-700",
    accepted: "bg-primary-50 text-primary-700",
    worker_arrived: "bg-purple-50 text-purple-700",
    price_confirmed: "bg-indigo-50 text-indigo-700",
    in_progress: "bg-accent-50 text-accent-700",
    completed: "bg-emerald-50 text-emerald-700",
    payment_submitted: "bg-emerald-50 text-emerald-700",
    payment_confirmed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-50 text-red-700",
    under_dispute: "bg-orange-50 text-orange-700",
  } as const;

  const canCancel = [
    "pending",
    "assigned",
    "accepted",
    "worker_arrived",
    "price_confirmed",
    "in_progress",
  ].includes(request.status);
  const canRate = request.status === "payment_confirmed";
  const workerPrice = request.finalPrice || request.suggestedPrice;
  const commissionPercent = request.commissionPercent || 10;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <BackButton to="/resident/requests" label="Back to Requests" />

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{request.categoryName}</h2>
            <p className="text-slate-600">{request.itemName}</p>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              statusBadgeColor[
                request.status as keyof typeof statusBadgeColor
              ] || "bg-slate-100 text-slate-700"
            }`}
          >
            {request.status.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
        <p className="text-slate-700">{request.description}</p>
      </div>

      {request.photoUrls && request.photoUrls.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold">Your Request Photos</h3>
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

      {request.workerName && (
        <div className="card space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <User size={18} /> Assigned Worker
          </h3>
          <div className="space-y-2 text-sm">
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
            {typeof request.workerRating === "number" && (
              <div className="flex items-center gap-1">
                <span className="text-slate-600">Rating:</span>
                <span className="font-medium flex items-center gap-1">
                  <Star size={14} fill="currentColor" className="text-yellow-400" />
                  {request.workerRating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

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
            <p className="text-xs text-slate-600">
              {request.finalPrice ? "Final Price" : "Current Worker Price"}
            </p>
            <p className="text-xl font-bold text-accent-600">PHP {workerPrice}</p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Barangay Fee ({commissionPercent}%)</span>
            <span className="font-medium">PHP {request.commission}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total You Pay</span>
            <span>PHP {request.totalForResident}</span>
          </div>
        </div>
      </div>

      {request.priceOverrideRequired && request.status === "worker_arrived" && (
        <div className="card bg-amber-50 border border-amber-200 text-amber-800">
          The worker submitted a final price that needs admin approval before the
          job can continue.
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock size={18} /> Schedule
        </h3>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-slate-600">Date:</span>{" "}
            <span className="font-medium">{formatDate(request.schedule.date)}</span>
          </p>
          <p>
            <span className="text-slate-600">Time:</span>{" "}
            <span className="font-medium">
              {request.schedule.startTime} - {request.schedule.endTime}
            </span>
          </p>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin size={18} /> Location
        </h3>
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
          </MapContainer>
        </div>
        <p className="text-xs text-slate-500">
          Coordinates: {getLat(request.location).toFixed(4)},{" "}
          {getLng(request.location).toFixed(4)}
        </p>
      </div>

      {canRate && request.yourRating === undefined && (
        <div className="card space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Star size={18} /> Rate the Worker
          </h3>
          {!showRatingForm ? (
            <button
              onClick={() => setShowRatingForm(true)}
              className="btn-primary w-full"
            >
              Leave a Rating
            </button>
          ) : (
            <form onSubmit={handleRateWorker} className="space-y-3">
              <div>
                <label className="label mb-2">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-2 rounded-lg transition-colors ${
                        rating >= star
                          ? "bg-yellow-100 text-yellow-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <Star size={24} fill="currentColor" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label flex items-center gap-1">
                  <MessageCircle size={14} /> Comment (Optional)
                </label>
                <textarea
                  placeholder="Share your experience..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input-field h-20"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting || rating === 0}
                  className="btn-primary flex-1"
                >
                  {isSubmitting ? "Submitting..." : "Submit Rating"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRatingForm(false);
                    setRating(0);
                    setComment("");
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {typeof request.yourRating === "number" && request.yourRating > 0 && (
        <div className="card bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <Star size={18} fill="currentColor" className="text-yellow-400" />
            <span className="font-semibold">Your Rating</span>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={18}
                fill={star <= request.yourRating! ? "currentColor" : "none"}
                className={
                  star <= request.yourRating!
                    ? "text-yellow-400"
                    : "text-slate-300"
                }
              />
            ))}
          </div>
        </div>
      )}

      {request.status === "completed" && (
        <Link
          to={`/resident/request/${requestId}/pay`}
          className="w-full py-3 btn-primary flex items-center justify-center gap-2"
        >
          <CreditCard size={18} />
          Submit Payment Proof
        </Link>
      )}

      {DISPUTABLE_STATUSES.includes(request.status) && (
        <Link
          to={`/resident/request/${requestId}/dispute`}
          className="w-full py-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <AlertTriangle size={18} />
          File a Dispute
        </Link>
      )}

      {canCancel && (
        <button
          onClick={handleCancel}
          disabled={isSubmitting}
          className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 size={18} />
          {isSubmitting ? "Cancelling..." : "Cancel Request"}
        </button>
      )}
    </div>
  );
}
