import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import {
  Siren,
  MapPin,
  Users as UsersIcon,
  Clock,
  Gift,
  Camera,
  X,
  Plus,
} from "lucide-react";
import { BackButton } from "@/components/common/BackButton";
import api from "@/services/api";
import { uploadFile } from "@/utils/uploadFile";

interface Category {
  id: string;
  name: string;
}

interface FormData {
  title: string;
  requesterName: string;
  requesterContact: string;
  details: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  affectedFamilies: number;
  durationHours: number;
  creditReward: number;
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

export function EmergencyCreate() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [needsInput, setNeedsInput] = useState("");
  const [needsList, setNeedsList] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      latitude: 10.3456,
      longitude: 123.9132,
      affectedFamilies: 1,
      durationHours: 24,
      creditReward: 2,
    },
  });

  const latitude = watch("latitude");
  const longitude = watch("longitude");

  useEffect(() => {
    if (latitude && longitude) setMarkerPosition([latitude, longitude]);
  }, [latitude, longitude]);

  useEffect(() => {
    api
      .get("/api/categories")
      .then(({ data }) => setCategories(data.categories || []))
      .catch(() => toast.error("Failed to load categories"));
  }, []);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addNeed() {
    const trimmed = needsInput.trim();
    if (!trimmed) return;
    if (needsList.includes(trimmed)) {
      setNeedsInput("");
      return;
    }
    setNeedsList([...needsList, trimmed]);
    setNeedsInput("");
  }

  function removeNeed(n: string) {
    setNeedsList(needsList.filter((x) => x !== n));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await uploadFile("emergencies/temp", file);
      setPhotos([...photos, dataUrl]);
    } catch {
      toast.error("Failed to process photo");
    } finally {
      e.target.value = "";
    }
  }

  function removePhoto(i: number) {
    setPhotos(photos.filter((_, idx) => idx !== i));
  }

  function handleLocationSelect(lat: number, lng: number) {
    const roundedLat = Math.round(lat * 1000000) / 1000000;
    const roundedLng = Math.round(lng * 1000000) / 1000000;
    setValue("latitude", roundedLat);
    setValue("longitude", roundedLng);
  }

  async function onSubmit(data: FormData) {
    if (selectedCategoryIds.length === 0) {
      toast.error("Select at least one worker specialization");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: resp } = await api.post("/api/emergencies", {
        title: data.title,
        requesterName: data.requesterName,
        requesterContact: data.requesterContact,
        categoryIds: selectedCategoryIds,
        details: data.details,
        needsList,
        photoUrls: photos,
        location: { latitude: data.latitude, longitude: data.longitude },
        locationAddress: data.locationAddress,
        affectedFamilies: Number(data.affectedFamilies),
        durationHours: Number(data.durationHours),
        creditReward: Number(data.creditReward),
      });
      toast.success("Emergency broadcasted to community");
      navigate(`/admin/emergencies/${resp.id}`);
    } catch (err: any) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.details?.[0]?.message ||
          "Failed to create emergency"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton to="/admin/emergencies" label="Back to Emergencies" />

      <div className="mb-6">
        <h2 className="page-title flex items-center gap-2">
          <Siren size={28} className="text-rose-600" />
          Create Emergency Broadcast
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Notify residents and eligible workers about an emergency or bayanihan
          effort.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="card space-y-4">
          <h3 className="section-title">Basic Information</h3>
          <div>
            <label className="label">Title</label>
            <input
              className="input-field"
              placeholder="e.g., Flooding at Sitio Malubog"
              {...register("title", {
                required: "Title is required",
                minLength: { value: 3, message: "Minimum 3 characters" },
              })}
            />
            {errors.title && (
              <p className="text-rose-500 text-xs mt-1">
                {errors.title.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Requester Name</label>
              <input
                className="input-field"
                placeholder="Who reported this?"
                {...register("requesterName", {
                  required: "Requester name is required",
                })}
              />
              {errors.requesterName && (
                <p className="text-rose-500 text-xs mt-1">
                  {errors.requesterName.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Requester Contact</label>
              <input
                className="input-field"
                placeholder="09XX-XXX-XXXX"
                {...register("requesterContact", {
                  required: "Contact is required",
                })}
              />
              {errors.requesterContact && (
                <p className="text-rose-500 text-xs mt-1">
                  {errors.requesterContact.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="label">Details</label>
            <textarea
              className="input-field h-24"
              placeholder="Describe the emergency or bayanihan need..."
              {...register("details", {
                required: "Details are required",
                minLength: { value: 10, message: "Minimum 10 characters" },
              })}
            />
            {errors.details && (
              <p className="text-rose-500 text-xs mt-1">
                {errors.details.message}
              </p>
            )}
          </div>
        </div>

        {/* Worker specializations */}
        <div className="card space-y-3">
          <h3 className="section-title">Worker Specializations Needed</h3>
          <p className="text-sm text-slate-500">
            Select one or more. Workers with matching specializations will be
            notified.
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const selected = selectedCategoryIds.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selected
                      ? "bg-primary-600 text-white border-primary-600"
                      : "bg-white text-slate-700 border-slate-300 hover:border-primary-400"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Needs / Donations */}
        <div className="card space-y-3">
          <h3 className="section-title">Needs / Donation Items (for residents)</h3>
          <div className="flex gap-2">
            <input
              className="input-field"
              placeholder="e.g., Bottled water, blankets, rice"
              value={needsInput}
              onChange={(e) => setNeedsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNeed();
                }
              }}
            />
            <button
              type="button"
              onClick={addNeed}
              className="btn-secondary flex items-center gap-1"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          {needsList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {needsList.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1 bg-accent-50 text-accent-800 border border-accent-200 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                >
                  {n}
                  <button type="button" onClick={() => removeNeed(n)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Photos */}
        <div className="card space-y-3">
          <h3 className="section-title flex items-center gap-2">
            <Camera size={18} /> Photos
          </h3>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="input-field"
          />
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img
                    src={p}
                    alt={`emergency-${i}`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div className="card space-y-3">
          <h3 className="section-title flex items-center gap-2">
            <MapPin size={18} /> Location
          </h3>
          <div className="h-80 rounded-lg overflow-hidden border border-slate-200">
            <MapContainer
              center={[10.3456, 123.9132]}
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
          <p className="text-xs text-slate-500">
            Click on the map to set the emergency location.
          </p>
          <div>
            <label className="label">Address / Landmark</label>
            <input
              className="input-field"
              placeholder="Street, purok, landmark..."
              {...register("locationAddress", {
                required: "Location address is required",
              })}
            />
            {errors.locationAddress && (
              <p className="text-rose-500 text-xs mt-1">
                {errors.locationAddress.message}
              </p>
            )}
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

        {/* Scope + Duration + Reward */}
        <div className="card space-y-4">
          <h3 className="section-title">Scope & Duration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label flex items-center gap-1">
                <UsersIcon size={14} /> Affected Families
              </label>
              <input
                type="number"
                min={0}
                className="input-field"
                {...register("affectedFamilies", {
                  required: "Required",
                  valueAsNumber: true,
                  min: { value: 0, message: "Must be >= 0" },
                })}
              />
            </div>
            <div>
              <label className="label flex items-center gap-1">
                <Clock size={14} /> Duration (hours)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                className="input-field"
                {...register("durationHours", {
                  required: "Required",
                  valueAsNumber: true,
                  min: { value: 1, message: "Min 1 hour" },
                  max: { value: 168, message: "Max 7 days" },
                })}
              />
            </div>
            <div>
              <label className="label flex items-center gap-1">
                <Gift size={14} /> Credit Reward
                <span className="text-xs text-slate-400 font-normal">
                  (admin-only)
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={5}
                className="input-field"
                {...register("creditReward", {
                  required: "Required",
                  valueAsNumber: true,
                  min: { value: 1, message: "Min 1" },
                  max: { value: 5, message: "Max 5" },
                })}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Credit reward is stored on the broadcast but hidden from residents
            and workers until awarded.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full text-lg py-3"
        >
          {isSubmitting ? "Broadcasting..." : "Broadcast Emergency"}
        </button>
      </form>
    </div>
  );
}
