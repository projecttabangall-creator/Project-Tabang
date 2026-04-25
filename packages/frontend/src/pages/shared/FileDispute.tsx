import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Upload, Camera, X } from "lucide-react";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { BackButton } from "@/components/common/BackButton";

const DISPUTE_TYPES = [
  { value: "work_quality", label: "Work Quality Issue" },
  { value: "payment", label: "Payment Dispute" },
  { value: "no_show", label: "No-Show" },
  { value: "behavior_safety", label: "Behavior / Safety Concern" },
  { value: "other", label: "Other" },
];

export function FileDispute() {
  const { requestId } = useParams<{ requestId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disputeTypes, setDisputeTypes] = useState<string[]>([]);
  const [otherDetails, setOtherDetails] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<string[]>([]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const backPath =
    userProfile?.role === "worker"
      ? `/worker/job/${requestId}`
      : `/resident/request/${requestId}`;

  const MAX_IMAGES = 3;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Check max images
    if (evidenceFiles.length >= MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setEvidenceFiles((prev) => [...prev, base64]);
      toast.success("Image added");
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

  const removeImage = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const hasOtherType = disputeTypes.includes("other");

  function toggleDisputeType(value: string) {
    setDisputeTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (disputeTypes.length === 0) {
      toast.error("Please select at least one dispute type");
      return;
    }
    if (hasOtherType && otherDetails.trim().length < 5) {
      toast.error("Please provide more details for 'Other'");
      return;
    }
    if (description.length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/api/disputes", {
        requestId,
        disputeTypes,
        otherDetails: otherDetails.trim(),
        description,
        evidenceUrls: evidenceFiles,
      });

      toast.success(
        "Dispute filed successfully. Admin review will begin shortly."
      );
      navigate(backPath);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to file dispute");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <BackButton to={backPath} label="Back" />
      <div className="flex items-center gap-3">
        <AlertTriangle size={28} className="text-red-500" />
        <h2 className="text-2xl font-bold">File a Dispute</h2>
      </div>

      <div className="card bg-yellow-50 border-yellow-200">
        <p className="text-sm text-yellow-800">
          Filing a dispute will pause the current transaction. You can raise a
          dispute while the work is active or within <strong>24 hours</strong>{" "}
          after completion. Please provide as much detail and evidence as
          possible.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dispute Type */}
        <div className="card space-y-4">
          <h3 className="font-semibold">Type of Dispute</h3>
          <div className="space-y-2">
            {DISPUTE_TYPES.map((type) => (
              <label
                key={type.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  disputeTypes.includes(type.value)
                    ? "border-primary-300 bg-primary-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  name="disputeTypes"
                  value={type.value}
                  checked={disputeTypes.includes(type.value)}
                  onChange={() => toggleDisputeType(type.value)}
                  className="accent-primary-600"
                />
                <span className="text-sm font-medium">{type.label}</span>
              </label>
            ))}
          </div>
          {hasOtherType && (
            <div>
              <label className="label">Other Dispute Details</label>
              <textarea
                placeholder="Describe the other dispute type in sentences or paragraphs..."
                className="input-field h-24"
                value={otherDetails}
                onChange={(e) => setOtherDetails(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Description */}
        <div className="card space-y-4">
          <h3 className="font-semibold">Description</h3>
          <textarea
            placeholder="Describe the issue in detail. What happened? When? What was expected?"
            className="input-field h-32"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="text-xs text-slate-500">Minimum 10 characters</p>
        </div>

        {/* Evidence - Photo Upload */}
        <div className="card space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Upload size={18} /> Evidence (Optional)
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

          {/* Upload Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={evidenceFiles.length >= MAX_IMAGES}
              className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Camera size={18} />
              Take Photo
            </button>
            <button
              type="button"
              onClick={handleGalleryClick}
              disabled={evidenceFiles.length >= MAX_IMAGES}
              className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              Upload Photo
            </button>
          </div>

          {/* Image Previews */}
          {evidenceFiles.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {evidenceFiles.length}/{MAX_IMAGES} images
              </p>
              <div className="grid grid-cols-3 gap-2">
                {evidenceFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={file}
                      alt={`Evidence ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          {isSubmitting ? "Filing Dispute..." : "File Dispute"}
        </button>
      </form>

    </div>
  );
}
