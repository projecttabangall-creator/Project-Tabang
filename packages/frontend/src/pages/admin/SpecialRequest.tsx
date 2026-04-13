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
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import api from "@/services/api";

interface Category {
  id: string;
  name: string;
  items: Array<{ id: string; name: string; minPrice: number; isFree: boolean }>;
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

export function SpecialRequest() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [is501, setIs501] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [mapPosition] = useState<[number, number]>([10.3456, 123.9132]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    null
  );

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

  const handleLocationSelect = (lat: number, lng: number) => {
    const roundedLat = Math.round(lat * 1000000) / 1000000;
    const roundedLng = Math.round(lng * 1000000) / 1000000;
    setValue("latitude", roundedLat);
    setValue("longitude", roundedLng);
    toast.success("Location selected");
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
          startTime: data.startTime,
          endTime: data.endTime,
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
                {...register("beneficiaryFirstName", {
                  required: "First name is required",
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
                {...register("beneficiaryLastName", {
                  required: "Last name is required",
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
              {...register("beneficiaryContact", {
                required: "Contact number is required",
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
                    {item.name}
                    {item.isFree ? " (Free)" : ` (Min: ₱${item.minPrice})`}
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
          <h3 className="section-title flex items-center gap-2">
            <MapPin size={18} /> Location
          </h3>

          <div className="h-96 rounded-lg overflow-hidden border border-slate-200">
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
            </MapContainer>
          </div>

          <p className="text-sm text-slate-500">
            Click on the map to select the beneficiary's location
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1">
                <Clock size={14} /> Start Time
              </label>
              <input
                type="time"
                className="input-field"
                {...register("startTime", {
                  required: "Start time is required",
                })}
              />
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
            </div>
          </div>
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
              })}
            />
            <p className="text-xs text-slate-500 mt-2">
              Set to 0 for free/bayanihan services
            </p>
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
