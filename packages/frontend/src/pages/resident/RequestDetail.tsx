import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  MapPin,
  Clock,
  DollarSign,
  User,
  Star,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import api from "@/services/api";

interface Request {
  id: string;
  categoryName: string;
  itemName: string;
  description: string;
  suggestedPrice: number;
  finalPrice?: number;
  location: { latitude: number; longitude: number };
  schedule: { date: string; startTime: string; endTime: string };
  status: string;
  workerName?: string;
  workerPhone?: string;
  workerRating?: number;
  yourRating?: number;
}

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
      setRequest(data);
      if (data.yourRating) {
        setRating(data.yourRating);
      }
    } catch {
      toast.error("Failed to load request details");
      navigate("/resident/requests");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${requestId}/cancel`, {
        reason: "Cancelled by resident",
      });
      toast.success("Request cancelled");
      navigate("/resident/requests");
    } catch {
      toast.error("Failed to cancel request");
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
      toast.success("Thank you for rating the worker!");
      fetchRequest();
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
    return <div className="text-center py-12 text-gray-500">Request not found</div>;
  }

  const statusBadgeColor = {
    assigned: "bg-yellow-50 text-yellow-700",
    accepted: "bg-blue-50 text-blue-700",
    worker_arrived: "bg-purple-50 text-purple-700",
    price_confirmed: "bg-indigo-50 text-indigo-700",
    in_progress: "bg-accent-50 text-accent-700",
    completed: "bg-green-50 text-green-700",
    payment_submitted: "bg-green-50 text-green-700",
    payment_confirmed: "bg-green-100 text-green-800",
    cancelled: "bg-red-50 text-red-700",
  } as const;

  const canCancel =
    ["assigned", "accepted", "worker_arrived"].includes(request.status);
  const canRate = ["completed", "payment_submitted", "payment_confirmed"].includes(
    request.status
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{request.categoryName}</h2>
            <p className="text-gray-600">{request.itemName}</p>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              statusBadgeColor[
                request.status as keyof typeof statusBadgeColor
              ] || "bg-gray-100 text-gray-700"
            }`}
          >
            {request.status.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
        <p className="text-gray-700">{request.description}</p>
      </div>

      {/* Worker Info (if assigned) */}
      {request.workerName && (
        <div className="card space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <User size={18} /> Assigned Worker
          </h3>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-gray-600">Name:</span>{" "}
              <span className="font-medium">{request.workerName}</span>
            </p>
            {request.workerPhone && (
              <p>
                <span className="text-gray-600">Phone:</span>{" "}
                <span className="font-medium">{request.workerPhone}</span>
              </p>
            )}
            {request.workerRating && (
              <div className="flex items-center gap-1">
                <span className="text-gray-600">Rating:</span>
                <span className="font-medium flex items-center gap-1">
                  <Star size={14} fill="currentColor" className="text-yellow-400" />
                  {request.workerRating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <DollarSign size={18} /> Pricing
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600">Suggested Price</p>
            <p className="text-xl font-bold text-primary-600">
              ₱{request.suggestedPrice}
            </p>
          </div>
          {request.finalPrice && (
            <div>
              <p className="text-xs text-gray-600">Final Price (Negotiated)</p>
              <p className="text-xl font-bold text-accent-600">
                ₱{request.finalPrice}
              </p>
            </div>
          )}
        </div>
        {request.finalPrice && (
          <div>
            <p className="text-xs text-gray-600">Commission (10%)</p>
            <p className="text-sm font-medium text-gray-700">
              ₱{(request.finalPrice * 0.1).toFixed(2)}
            </p>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">Total You Pay</p>
              <p className="text-lg font-bold">
                ₱{(request.finalPrice * 1.1).toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock size={18} /> Schedule
        </h3>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-gray-600">Date:</span>{" "}
            <span className="font-medium">{request.schedule.date}</span>
          </p>
          <p>
            <span className="text-gray-600">Time:</span>{" "}
            <span className="font-medium">
              {request.schedule.startTime} - {request.schedule.endTime}
            </span>
          </p>
        </div>
      </div>

      {/* Location Map */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin size={18} /> Location
        </h3>
        <div className="h-64 rounded-lg overflow-hidden border border-gray-200">
          <MapContainer
            center={[request.location.latitude, request.location.longitude]}
            zoom={15}
            style={{ height: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <Marker
              position={[request.location.latitude, request.location.longitude]}
            />
          </MapContainer>
        </div>
        <p className="text-xs text-gray-500">
          Coordinates: {request.location.latitude.toFixed(4)},{" "}
          {request.location.longitude.toFixed(4)}
        </p>
      </div>

      {/* Rating Form */}
      {canRate && !request.yourRating && (
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
                          : "bg-gray-100 text-gray-400"
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

      {request.yourRating !== undefined && request.yourRating > 0 && (
        <div className="card bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Star size={18} fill="currentColor" className="text-yellow-400" />
            <span className="font-semibold">Your Rating</span>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={18}
                fill={star <= (request.yourRating || 0) ? "currentColor" : "none"}
                className={
                  star <= (request.yourRating || 0)
                    ? "text-yellow-400"
                    : "text-gray-300"
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
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

      {/* Back Button */}
      <button
        onClick={() => navigate("/resident/requests")}
        className="w-full py-2 text-gray-700 hover:text-gray-900 font-medium"
      >
        ← Back to Requests
      </button>
    </div>
  );
}
