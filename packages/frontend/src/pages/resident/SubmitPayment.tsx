import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Camera, CheckCircle, Upload, X, Star } from "lucide-react";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";
import { uploadFile } from "@/utils/uploadFile";

interface RequestData {
  id: string;
  categoryName: string;
  itemName: string;
  suggestedPrice: number;
  finalPrice?: number;
  commission: number;
  commissionPercent?: number;
  totalForResident: number;
  assignedWorkerName?: string;
  workerName?: string;
  paymentMethod: string;
  status: string;
}

export function SubmitPayment() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [request, setRequest] = useState<RequestData | null>(null);
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      const { data } = await api.get(`/api/requests/${requestId}`);
      const currentRequest = data.request || data;

      if (currentRequest.status !== "completed") {
        toast.error("Payment can only be submitted for completed jobs");
        navigate("/resident/requests");
        return;
      }

      setRequest(currentRequest);
    } catch {
      toast.error("Failed to load request");
      navigate("/resident/requests");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setProofDataUrl(dataUrl);
      setProofFile(file);
      toast.success("Photo selected");
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const handleRemovePhoto = () => {
    setProofDataUrl(null);
    setProofFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!proofDataUrl) {
      toast.error("Please take or upload a photo");
      return;
    }

    if (rating < 1) {
      toast.error("Please rate the worker");
      return;
    }

    setIsSubmitting(true);
    try {
      const compressedProofUrl = proofFile
        ? await uploadFile(`payments/${requestId}`, proofFile)
        : proofDataUrl;

      await api.post("/api/payments", {
        requestId,
        proofUrl: compressedProofUrl,
        rating,
        ratingComment,
      });
      toast.success("Payment proof and rating submitted. Waiting for admin confirmation.");
      navigate(`/resident/request/${requestId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to submit payment");
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
    return null;
  }

  const finalPrice = request.finalPrice || request.suggestedPrice;
  const commission = request.commission;
  const total = request.totalForResident;
  const commissionPercent = request.commissionPercent || 10;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <BackButton to={`/resident/request/${requestId}`} label="Back to Request" />
      <h2 className="text-2xl font-bold">Submit Payment</h2>

      <div className="card space-y-3">
        <h3 className="font-semibold">Job Summary</h3>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-slate-600">Service:</span>{" "}
            <span className="font-medium">
              {request.categoryName} - {request.itemName}
            </span>
          </p>
          <p>
            <span className="text-slate-600">Worker:</span>{" "}
            <span className="font-medium">
              {request.workerName || request.assignedWorkerName}
            </span>
          </p>
          <p>
            <span className="text-slate-600">Payment Method:</span>{" "}
            <span className="font-medium uppercase">{request.paymentMethod}</span>
          </p>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="text-lg">₱</span> Payment Breakdown
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Worker's Price</span>
            <span className="font-medium">PHP {finalPrice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              Service Fee ({commissionPercent}%)
            </span>
            <span className="font-medium">PHP {commission}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-lg text-primary-600">PHP {total}</span>
          </div>
        </div>
      </div>

      <div className="card bg-primary-50 border-primary-200 space-y-2">
        <h3 className="font-semibold text-primary-800">Payment Instructions</h3>
        {request.paymentMethod === "gcash" ? (
          <div className="text-sm text-primary-700 space-y-1">
            <p>1. Send <strong>₱{total}</strong> via GCash to the worker.</p>
            <p>2. Take a screenshot of your GCash confirmation.</p>
            <p>3. Upload the screenshot below.</p>
          </div>
        ) : (
          <div className="text-sm text-primary-700 space-y-1">
            <p>1. Pay <strong>₱{total}</strong> in cash to the worker.</p>
            <p>2. Take a photo of the cash hand-off or receipt.</p>
            <p>3. Upload the photo below.</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Upload size={18} /> Proof of Payment
        </h3>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />

        {/* Preview or Action Buttons */}
        {!proofDataUrl ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-primary-50 hover:bg-primary-100 disabled:bg-slate-100 text-primary-700 disabled:text-slate-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Camera size={18} />
              Take Photo
            </button>
            <button
              type="button"
              onClick={handleGalleryClick}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 text-slate-700 disabled:text-slate-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              Upload
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
              <img
                src={proofDataUrl}
                alt="Payment proof preview"
                className="w-full h-48 object-cover"
              />
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isSubmitting}
                className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Rating Section */}
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Star size={18} className="text-amber-500" /> Rate Your Worker
          </h3>

          {/* Star Rating */}
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                disabled={isSubmitting}
                className="transition-transform hover:scale-110 disabled:opacity-50"
              >
                <Star
                  size={32}
                  className={`${
                    (hoverRating || rating) >= star
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300"
                  } transition-colors`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <p className="text-sm text-slate-600">
              {rating === 1
                ? "Poor experience"
                : rating === 2
                ? "Needs improvement"
                : rating === 3
                ? "Good service"
                : rating === 4
                ? "Very good"
                : "Excellent work"}
            </p>
          )}

          {/* Comment */}
          <div>
            <label className="label">Comments (Optional)</label>
            <textarea
              placeholder="Share your feedback about the worker's service..."
              className="input-field h-20"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !proofDataUrl || rating < 1}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <CheckCircle size={18} />
          {isSubmitting ? "Submitting..." : "Submit Proof & Rating"}
        </button>
      </form>
    </div>
  );
}
