import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  MapPin,
  Clock,
  DollarSign,
  User,
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle,
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
  residentName: string;
  residentPhone: string;
  assignedWorkerId?: string;
  proofOfWorkPhotoUrls?: string[];
}

export function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [finalPrice, setFinalPrice] = useState("");
  const [showPriceForm, setShowPriceForm] = useState(false);

  useEffect(() => {
    fetchRequest();
  }, [jobId]);

  const fetchRequest = async () => {
    try {
      const { data } = await api.get(`/api/requests/${jobId}`);
      setRequest(data);
      if (data.finalPrice) {
        setFinalPrice(data.finalPrice.toString());
      }
    } catch {
      toast.error("Failed to load job details");
      navigate("/worker/home");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/accept`);
      toast.success("Job accepted! You can now proceed to the location.");
      fetchRequest();
    } catch {
      toast.error("Failed to accept job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Are you sure you want to reject this job?")) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/reject`);
      toast.success("Job rejected. You will be offered another one soon.");
      navigate("/worker/home");
    } catch {
      toast.error("Failed to reject job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkArrived = async () => {
    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/arrived`);
      toast.success("Arrival confirmed! Now set the final price.");
      fetchRequest();
    } catch {
      toast.error("Failed to mark arrival");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetFinalPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalPrice || Number(finalPrice) <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/final-price`, {
        finalPrice: Number(finalPrice),
      });
      toast.success("Final price set! Proceed with the work.");
      fetchRequest();
      setShowPriceForm(false);
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to set final price"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm("Mark this job as complete?")) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${jobId}/complete`);
      toast.success(
        "Job completed! Waiting for resident to submit payment proof."
      );
      fetchRequest();
    } catch {
      toast.error("Failed to complete job");
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
    return <div className="text-center py-12 text-gray-500">Job not found</div>;
  }

  const statusBadgeColor = {
    assigned: "bg-yellow-50 text-yellow-700",
    accepted: "bg-blue-50 text-blue-700",
    worker_arrived: "bg-purple-50 text-purple-700",
    price_confirmed: "bg-indigo-50 text-indigo-700",
    in_progress: "bg-accent-50 text-accent-700",
    completed: "bg-green-50 text-green-700",
  } as const;

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
              statusBadgeColor[request.status as keyof typeof statusBadgeColor] ||
              "bg-gray-100 text-gray-700"
            }`}
          >
            {request.status.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
        <p className="text-gray-700">{request.description}</p>
      </div>

      {/* Resident Info */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <User size={18} /> Resident Information
        </h3>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-gray-600">Name:</span>{" "}
            <span className="font-medium">{request.residentName}</span>
          </p>
          <p className="flex items-center gap-2">
            <Phone size={14} className="text-gray-600" />
            <span className="font-medium">{request.residentPhone}</span>
          </p>
        </div>
      </div>

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
        <p className="text-xs text-gray-500">
          Final price will be negotiated on-site and cannot exceed 2x the
          suggested price
        </p>
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
            <Marker position={[request.location.latitude, request.location.longitude]} />
          </MapContainer>
        </div>
        <p className="text-xs text-gray-500">
          Coordinates: {request.location.latitude.toFixed(4)},{" "}
          {request.location.longitude.toFixed(4)}
        </p>
      </div>

      {/* Final Price Form */}
      {request.status === "worker_arrived" && (
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
                <label className="label">Final Price (₱)</label>
                <input
                  type="number"
                  min={request.suggestedPrice}
                  max={request.suggestedPrice * 2}
                  step="50"
                  placeholder="Enter agreed price"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be between ₱{request.suggestedPrice} and ₱
                  {request.suggestedPrice * 2}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1"
                >
                  {isSubmitting ? "Saving..." : "Confirm Price"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPriceForm(false);
                    setFinalPrice(request.finalPrice?.toString() || "");
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

      {/* Action Buttons */}
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

        {request.status === "accepted" && (
          <button
            onClick={handleMarkArrived}
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? "Marking..." : "Mark as Arrived"}
          </button>
        )}

        {request.status === "price_confirmed" && (
          <button
            onClick={handleComplete}
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <CheckCircle size={18} />
            {isSubmitting ? "Completing..." : "Complete Job"}
          </button>
        )}

        {request.status === "in_progress" && (
          <p className="text-sm text-gray-600 text-center py-2">
            Waiting for payment from resident...
          </p>
        )}
      </div>

      {/* File Dispute Button */}
      {["worker_arrived", "price_confirmed", "in_progress", "completed"].includes(request.status) && (
        <Link
          to={`/worker/job/${jobId}/dispute`}
          className="w-full py-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <AlertTriangle size={18} />
          File a Dispute
        </Link>
      )}

      {/* Back Button */}
      <button
        onClick={() => navigate("/worker/home")}
        className="w-full py-2 text-gray-700 hover:text-gray-900 font-medium"
      >
        ← Back to Jobs
      </button>
    </div>
  );
}
