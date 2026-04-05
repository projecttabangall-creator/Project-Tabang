import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Calendar, Clock, DollarSign } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import api from "@/services/api";

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

// Custom hook for map click
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

export function RequestService() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [mapPosition, setMapPosition] = useState<[number, number]>([10.3456, 123.9132]); // Banilad, Cebu
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);

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

  // Update marker when coordinates change
  useEffect(() => {
    if (latitude && longitude) {
      setMarkerPosition([latitude, longitude]);
      setMapPosition([latitude, longitude]);
    }
  }, [latitude, longitude]);

  // Load categories
  useEffect(() => {
    api
      .get("/api/categories")
      .then(({ data }) => {
        setCategories(data.categories);
      })
      .catch(() => toast.error("Failed to load categories"));
  }, []);

  // Update selected category when categoryId changes
  useEffect(() => {
    if (categoryId) {
      const selected = categories.find((c) => c.id === categoryId);
      setSelectedCategory(selected || null);
    }
  }, [categoryId, categories]);

  const handleLocationSelect = (lat: number, lng: number) => {
    setValue("latitude", lat);
    setValue("longitude", lng);
    toast.success("Location selected");
  };

  const onSubmit = async (data: RequestFormData) => {
    setIsLoading(true);
    try {

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
        photoUrls: [],
        schedule: {
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
        },
        paymentMethod: data.paymentMethod,
      });

      toast.success("Service request submitted!");
      navigate("/resident/requests");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to submit request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Request a Service</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Service Category & Item */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-lg">What Service Do You Need?</h3>

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
                    {item.name} (Min: ₱{item.minPrice})
                  </option>
                ))}
              </select>
              {errors.itemId && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.itemId.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Description */}
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

        {/* Location */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <MapPin size={20} /> Location
          </h3>

          <div className="h-80 rounded-lg overflow-hidden border border-gray-200">
            <MapContainer center={mapPosition} zoom={15} style={{ height: "100%" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {markerPosition && <Marker position={markerPosition} />}
              <MapClickHandler onLocationSelect={handleLocationSelect} />
            </MapContainer>
          </div>

          <p className="text-sm text-gray-500">
            Click on the map to select your location
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
                step="0.0001"
                className="input-field"
                {...register("latitude", { required: true, valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="label text-xs">Longitude</label>
              <input
                type="number"
                step="0.0001"
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

        {/* Pricing */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <DollarSign size={20} /> Pricing
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
            {errors.suggestedPrice && (
              <p className="text-red-500 text-xs mt-1">
                {errors.suggestedPrice.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              This will be negotiated with the worker on-site
            </p>
          </div>
        </div>

        {/* Payment Method */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-lg">Payment Method</h3>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="gcash"
                {...register("paymentMethod")}
              />
              <span>GCash</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="cash"
                {...register("paymentMethod")}
              />
              <span>Cash</span>
            </label>
          </div>
        </div>

        {/* Submit */}
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
