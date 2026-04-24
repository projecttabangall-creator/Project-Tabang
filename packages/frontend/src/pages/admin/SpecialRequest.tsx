import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import {
  MapPin,
  Calendar,
  Clock,
  HeartHandshake,
  AlertCircle,
  LocateFixed,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import api from "@/services/api";

interface Category {
  id: string;
  name: string;
  items: Array<{ id: string; name: string; minPrice: number }>;
}

interface SpecialRequestFormData {
  // Beneficiary info
  beneficiaryFirstName: string;
  beneficiaryLastName: string;
  beneficiaryContact: string;
  specialRequestNote: string;
  // Service request fields (same as resident)
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
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
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

export function SpecialRequest() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [is501, setIs501] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [mapPosition, setMapPosition] = useState<[number, number]>([10.3456, 123.9132]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [noSpecifiedTime, setNoSpecifiedTime] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SpecialRequestFormData>({
    defaultValues: {
      latitude: 10.3456,
      longitude: 123.9132,
      date: new Date().toISOString().split("T")[0],
      startTime: "09:00",
      endTime: "17:00",
      paymentMethod: "cash",
      suggestedPrice: 0,
    },
  });

  const categoryId = watch("categoryId");
  const latitude = watch("latitude");
  const longitude = watch("longitude");

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
      .catch(() => toast.error("Failed to load categories"));
  }, []);

  useEffect(() => {
    if (categoryId) {
      const selected = categories.find((c) => c.id === categoryId);
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

  const onSubmit = async (data: SpecialRequestFormData) => {
    setIsLoading(true);
    try {
      await api.post("/api/admin/special-request", {
        beneficiary: {
          firstName: data.beneficiaryFirstName,
          lastName: data.beneficiaryLastName,
          contactNumber: data.beneficiaryContact,
        },
        specialRequestNote: data.specialRequestNote,
        categoryId: data.categoryId,
        itemId: data.itemId,
        description: data.description,
        suggestedPrice: Number(data.suggestedPrice),
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
        },
        locationAddress: data.locationAddress,
        photoUrls: [],
        schedule: {
          date: data.date,
          startTime: noSpecifiedTime ? "" : data.startTime,
          endTime: noSpecifiedTime ? "" : data.endTime,
        },
        paymentMethod: data.paymentMethod,
        isSpecialRequest: true,
      });

      toast.success("Special request submitted successfully!");
      navigate("/admin/requests");
    } catch (error: any) {
      if (error.response?.status === 501) {
        setIs501(true);
        toast.error(
          "This feature is not yet available on the backend. Your form data has been preserved."
        );
      } else {
        toast.error(
          error.response?.data?.error || "Failed to submit special request"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />
      <div className="mb-6">
        <h2 className="page-title flex items-center gap-2">
          <HeartHandshake size={28} className="text-accent-500" />
          Special Request
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Submit a service request on behalf of Senior Citizens, PWDs, or
          residents without system access.
        </p>
      </div>

      {is501 && (
        <div className="card !bg-accent-50 !border-accent-200 mb-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-accent-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-accent-800 text-sm">
              Backend Not Ready
            </p>
            <p className="text-sm text-accent-700">
              The special request endpoint is not yet implemented. Your form data
              is preserved below.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Beneficiary Information */}
        <div className="card space-y-4 !border-accent-200 !bg-accent-50/30">
          <h3 className="section-title flex items-center gap-2">
            <HeartHandshake size={18} className="text-accent-600" />
            Beneficiary Information
          </h3>
          <p className="text-sm text-slate-500">
            Enter the details of the person requesting assistance.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input
                className="input-field"
                placeholder="First name"
                onKeyDown={(e) => { if (e.key.length === 1 && !/[a-zA-ZÀ-ÿÑñ\s'\-.]/.test(e.key)) e.preventDefault(); }}
                onPaste={(e) => { if (!/^[a-zA-ZÀ-ÿÑñ\s'\-.]*$/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
                {...register("beneficiaryFirstName", {
                  required: "First name is required",
                  pattern: { value: /^[a-zA-ZÀ-ÿÑñ\s'\-.]+$/, message: "Letters only" },
                })}
              />
              {errors.beneficiaryFirstName && (
                <p className="text-rose-500 text-xs mt-1">
                  {errors.beneficiaryFirstName.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                className="input-field"
                placeholder="Last name"
                onKeyDown={(e) => { if (e.key.length === 1 && !/[a-zA-ZÀ-ÿÑñ\s'\-.]/.test(e.key)) e.preventDefault(); }}
                onPaste={(e) => { if (!/^[a-zA-ZÀ-ÿÑñ\s'\-.]*$/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
                {...register("beneficiaryLastName", {
                  required: "Last name is required",
                  pattern: { value: /^[a-zA-ZÀ-ÿÑñ\s'\-.]+$/, message: "Letters only" },
                })}
              />
              {errors.beneficiaryLastName && (
                <p className="text-rose-500 text-xs mt-1">
                  {errors.beneficiaryLastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="label">Contact Number</label>
            <input
              className="input-field"
              placeholder="09XX-XXX-XXXX"
              maxLength={13}
              onKeyDown={(e) => { if (e.key.length === 1 && !/[\d+]/.test(e.key)) e.preventDefault(); }}
              onPaste={(e) => { if (!/^[\d+]*$/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
              {...register("beneficiaryContact", {
                required: "Contact number is required",
                pattern: { value: /^(\+63|0)\d{10}$/, message: "Enter a valid PH number (e.g. 09171234567)" },
              })}
            />
            {errors.beneficiaryContact && (
              <p className="text-rose-500 text-xs mt-1">
                {errors.beneficiaryContact.message}
              </p>
            )}
          </div>

          <div>
            <label className="label">Reason for Special Request</label>
            <textarea
              className="input-field h-20"
              placeholder="e.g., Senior citizen, PWD, no smartphone access..."
              {...register("specialRequestNote", {
                required: "Please provide a reason",
              })}
            />
            {errors.specialRequestNote && (
              <p className="text-rose-500 text-xs mt-1">
                {errors.specialRequestNote.message}
              </p>
            )}
          </div>
        </div>

        {/* Service Category & Item */}
        <div className="card space-y-4">
          <h3 className="section-title">What Service Is Needed?</h3>

          <div>
            <label className="label">Service Category</label>
            <select
              className="input-field"
              {...register("categoryId", { required: "Category is required" })}
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-rose-500 text-xs mt-1">
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
                    {item.name} (Min: ₱{item.minPrice})
                  </option>
                ))}
              </select>
              {errors.itemId && (
                <p className="text-rose-500 text-xs mt-1">
                  {errors.itemId.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="card">
          <h3 className="section-title mb-4">Problem Description</h3>
          <textarea
            placeholder="Describe the issue in detail..."
            className="input-field h-24"
            {...register("description", {
              required: "Description is required",
              minLength: { value: 10, message: "Minimum 10 characters" },
            })}
          />
          {errors.description && (
            <p className="text-rose-500 text-xs mt-1">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Location */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title flex items-center gap-2">
              <MapPin size={18} /> Location
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

          <div className="h-96 rounded-lg overflow-hidden border border-slate-200 isolate">
            <MapContainer
              center={mapPosition}
              zoom={15}
              style={{ height: "100%" }}
            >
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
            Click on the map or use "Use My Location" to set the beneficiary's location
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
                {...register("latitude", {
                  required: true,
                  valueAsNumber: true,
                })}
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

        {/* Schedule */}
        <div className="card space-y-4">
          <h3 className="section-title flex items-center gap-2">
            <Calendar size={18} /> Preferred Schedule
          </h3>

          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input-field"
              {...register("date", { required: "Date is required" })}
            />
            {errors.date && (
              <p className="text-rose-500 text-xs mt-1">
                {errors.date.message}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={noSpecifiedTime}
              onChange={(e) => {
                setNoSpecifiedTime(e.target.checked);
                if (e.target.checked) {
                  setValue("startTime", "");
                  setValue("endTime", "");
                } else {
                  setValue("startTime", "09:00");
                  setValue("endTime", "17:00");
                }
              }}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">No specified time (match any available worker)</span>
          </label>

          {!noSpecifiedTime && (
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
                  <p className="text-rose-500 text-xs mt-1">
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
                  <p className="text-rose-500 text-xs mt-1">
                    {errors.endTime.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="card space-y-4">
          <h3 className="section-title flex items-center gap-2">
            <span className="text-lg">₱</span> Pricing
          </h3>

          <div>
            <label className="label">Suggested Price (₱)</label>
            <input
              type="number"
              placeholder="0"
              className="input-field"
              {...register("suggestedPrice", {
                required: "Price is required",
                valueAsNumber: true,
                min: { value: 0, message: "Price cannot be negative" },
              })}
            />
            {errors.suggestedPrice && (
              <p className="text-rose-500 text-xs mt-1">
                {errors.suggestedPrice.message}
              </p>
            )}
          </div>
        </div>

        {/* Payment Method */}
        <div className="card space-y-4">
          <h3 className="section-title">Payment Method</h3>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="gcash"
                className="text-primary-600 focus:ring-primary-500"
                {...register("paymentMethod")}
              />
              <span className="text-sm font-medium">GCash</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="cash"
                className="text-primary-600 focus:ring-primary-500"
                {...register("paymentMethod")}
              />
              <span className="text-sm font-medium">Cash</span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-accent w-full text-lg py-3"
        >
          {isLoading ? "Submitting..." : "Submit Special Request"}
        </button>
      </form>
    </div>
  );
}
