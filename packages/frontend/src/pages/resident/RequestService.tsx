import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import { Calendar, Camera, Clock, LocateFixed, MapPin, Upload, X } from "lucide-react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFile } from "@/utils/uploadFile";

const DEFAULT_COMMISSION_PERCENT = 10;

interface Category {
  id: string;
  name: string;
  items: Array<{ id: string; name: string; minPrice: number }>;
}

interface RequestFormData {
  categoryId: string;
  itemId: string;
  description: string;
  suggestedPrice: number;
  latitude: number;
  longitude: number;
  locationAddress: string;
  date: string;
  startTime: string;
  endTime: string;
  paymentMethod: "gcash" | "cash";
}

function MapClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      onLocationSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function FlyToLocation({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 16);
    }
  }, [position, map]);
  return null;
}

export function RequestService() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [mapPosition, setMapPosition] = useState<[number, number]>([
    10.3456,
    123.9132,
  ]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    null
  );
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoDataUrls, setPhotoDataUrls] = useState<string[]>([]);
  const [isLocating, setIsLocating] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RequestFormData>({
    defaultValues: {
      latitude: 10.3456,
      longitude: 123.9132,
      date: new Date().toISOString().split("T")[0],
      startTime: "09:00",
      endTime: "17:00",
      paymentMethod: "gcash",
    },
  });

  const categoryId = watch("categoryId");
  const latitude = watch("latitude");
  const longitude = watch("longitude");
  const suggestedPrice = Number(watch("suggestedPrice") || 0);
  const commissionEstimate = Math.round(
    suggestedPrice * (DEFAULT_COMMISSION_PERCENT / 100)
  );
  const totalEstimate = suggestedPrice + commissionEstimate;

  useEffect(() => {
    if (latitude && longitude) {
      setMarkerPosition([latitude, longitude]);
      setMapPosition([latitude, longitude]);
    }
  }, [latitude, longitude]);


  useEffect(() => {
    api
      .get("/api/categories")
      .then(({ data }) => setCategories(data.categories || []))
      .catch((error) => {
        console.error("Failed to load categories:", error);
        setCategories([]);
        toast.error("Failed to load categories");
      });
  }, []);

  useEffect(() => {
    if (categoryId) {
      const selected = categories.find((category) => category.id === categoryId);
      setSelectedCategory(selected || null);
    }
  }, [categoryId, categories]);

  const handleLocationSelect = async (lat: number, lng: number) => {
    const roundedLat = Math.round(lat * 1000000) / 1000000;
    const roundedLng = Math.round(lng * 1000000) / 1000000;

    setValue("latitude", roundedLat);
    setValue("longitude", roundedLng);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();

      if (data.address) {
        const addressParts = [
          data.address.road,
          data.address.suburb || data.address.village,
          data.address.city || data.address.town,
        ]
          .filter(Boolean)
          .join(", ");

        if (addressParts) {
          setValue("locationAddress", addressParts);
        }
      }

      toast.success("Location selected");
    } catch {
      toast.success("Location selected (address lookup failed)");
    }
  };

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await handleLocationSelect(pos.coords.latitude, pos.coords.longitude);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location permission denied. Please allow access in your browser settings.");
        } else {
          toast.error("Unable to retrieve your location");
        }
      }
    );
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

    if (photoFiles.length >= 3) {
      toast.error("Maximum 3 photos allowed");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPhotoFiles((prev) => [...prev, file]);
      setPhotoDataUrls((prev) => [...prev, dataUrl]);
      toast.success("Photo added");
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

  const handleRemovePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoDataUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: RequestFormData) => {
    setIsLoading(true);
    try {
      // Upload photos to Firebase Storage first; store download URLs (not base64)
      const uid = userProfile?.uid || "unknown";
      const uploadTimestamp = Date.now();
      const uploadedUrls = await Promise.all(
        photoFiles.map((file, i) =>
          uploadFile(
            `users/${uid}/request-photos/${uploadTimestamp}_${i}.jpg`,
            file
          )
        )
      );

      await api.post("/api/requests", {
        categoryId: data.categoryId,
        itemId: data.itemId,
        description: data.description,
        suggestedPrice: Number(data.suggestedPrice),
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
        },
        locationAddress: data.locationAddress,
        photoUrls: uploadedUrls,
        schedule: {
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
        },
        paymentMethod: data.paymentMethod,
      });

      toast.success("Service request submitted.");
      navigate("/resident/requests");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to submit request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <BackButton to="/resident/requests" label="Back to Requests" />
      <h2 className="text-2xl font-bold mb-6">Request a Service</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card space-y-4">
          <h3 className="font-semibold text-lg">What Service Do You Need?</h3>

          <div>
            <label className="label">Service Category</label>
            <select
              className="input-field"
              {...register("categoryId", { required: "Category is required" })}
            >
              <option value="">Select a category...</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-red-500 text-xs mt-1">
                {errors.categoryId.message}
              </p>
            )}
          </div>

          {selectedCategory && (
            <div>
              <label className="label">Specific Service Item</label>
              <select
                className="input-field"
                {...register("itemId", { required: "Item is required" })}
              >
                <option value="">Select an item...</option>
                {selectedCategory.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Min: PHP {item.minPrice})
                  </option>
                ))}
              </select>
              {errors.itemId && (
                <p className="text-red-500 text-xs mt-1">{errors.itemId.message}</p>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Problem Description</h3>
          <textarea
            placeholder="Describe the issue in detail..."
            className="input-field h-24"
            {...register("description", {
              required: "Description is required",
              minLength: {
                value: 10,
                message: "Minimum 10 characters",
              },
            })}
          />
          {errors.description && (
            <p className="text-red-500 text-xs mt-1">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Upload size={20} /> Photos (Optional)
          </h3>
          <p className="text-sm text-slate-600">
            Add up to 3 photos to help the worker understand the job
          </p>

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

          {/* Photo previews */}
          {photoDataUrls.length > 0 ? (
            <div className="space-y-3">
              <div className="flex gap-3 overflow-x-auto pb-2">
                {photoDataUrls.map((dataUrl, index) => (
                  <div key={index} className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={dataUrl} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      disabled={isLoading}
                      className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-full transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {photoDataUrls.length < 3 && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    disabled={isLoading}
                    className="flex-1 py-2 bg-primary-50 hover:bg-primary-100 disabled:bg-slate-100 text-primary-700 disabled:text-slate-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Camera size={16} />
                    Add Photo
                  </button>
                  <button
                    type="button"
                    onClick={handleGalleryClick}
                    disabled={isLoading}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 text-slate-700 disabled:text-slate-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Upload size={16} />
                    Upload
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCameraClick}
                disabled={isLoading}
                className="flex-1 py-3 bg-primary-50 hover:bg-primary-100 disabled:bg-slate-100 text-primary-700 disabled:text-slate-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Camera size={18} />
                Take Photo
              </button>
              <button
                type="button"
                onClick={handleGalleryClick}
                disabled={isLoading}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 text-slate-700 disabled:text-slate-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Upload size={18} />
                Upload
              </button>
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MapPin size={20} /> Location
            </h3>
            <button
              type="button"
              onClick={handleShareLocation}
              disabled={isLocating}
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 transition-colors"
            >
              <LocateFixed size={16} className={isLocating ? "animate-pulse" : ""} />
              {isLocating ? "Locating..." : "Use My Location"}
            </button>
          </div>

          <div className="h-80 rounded-lg overflow-hidden border border-slate-200 isolate">
            <MapContainer center={mapPosition} zoom={15} style={{ height: "100%" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {markerPosition && <Marker position={markerPosition} />}
              <MapClickHandler onLocationSelect={handleLocationSelect} />
              <FlyToLocation position={markerPosition} />
            </MapContainer>
          </div>

          <p className="text-sm text-slate-500">
            Click on the map or use "Use My Location" to set your location
          </p>

          <div>
            <label className="label">Address (Optional)</label>
            <input
              placeholder="Street name, landmark, etc."
              className="input-field"
              {...register("locationAddress")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="label text-xs">Latitude</label>
              <input
                type="number"
                step="any"
                className="input-field"
                {...register("latitude", { required: true, valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="label text-xs">Longitude</label>
              <input
                type="number"
                step="any"
                className="input-field"
                {...register("longitude", {
                  required: true,
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Calendar size={20} /> Preferred Schedule
          </h3>

          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input-field"
              {...register("date", { required: "Date is required" })}
            />
            {errors.date && (
              <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1">
                <Clock size={14} /> Start Time
              </label>
              <input
                type="time"
                className="input-field"
                {...register("startTime", { required: "Start time is required" })}
              />
              {errors.startTime && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.startTime.message}
                </p>
              )}
            </div>
            <div>
              <label className="label flex items-center gap-1">
                <Clock size={14} /> End Time
              </label>
              <input
                type="time"
                className="input-field"
                {...register("endTime", { required: "End time is required" })}
              />
              {errors.endTime && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.endTime.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="text-xl">₱</span> Pricing
          </h3>

          <div>
            <label className="label">Suggested Price (PHP)</label>
            <input
              type="number"
              placeholder="0"
              className="input-field"
              {...register("suggestedPrice", {
                required: "Price is required",
                valueAsNumber: true,
              })}
            />
            {errors.suggestedPrice && (
              <p className="text-red-500 text-xs mt-1">
                {errors.suggestedPrice.message}
              </p>
            )}

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
              <p>This will still be negotiated with the worker on-site.</p>
              <p>Estimated Barangay fee: PHP {commissionEstimate}</p>
              <p className="font-medium text-slate-700">
                Estimated total you pay: PHP {totalEstimate}
              </p>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-lg">Payment Method</h3>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="gcash" {...register("paymentMethod")} />
              <span>GCash</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="cash" {...register("paymentMethod")} />
              <span>Cash</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full text-lg py-3"
        >
          {isLoading ? "Submitting..." : "Submit Service Request"}
        </button>
      </form>
    </div>
  );
}
