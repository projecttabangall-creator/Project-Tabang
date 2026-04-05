import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/services/api";

interface WorkerForm {
  firstName: string;
  lastName: string;
  middleInitial: string;
  birthday: string;
  specialization: string;
  contactNumber: string;
  email: string;
  password: string;
  street: string;
  houseLot: string;
  blockNo: string;
  barangay: string;
}

interface Category {
  id: string;
  name: string;
}

export function WorkerRegistration() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkerForm>();

  useEffect(() => {
    api
      .get("/api/categories")
      .then(({ data }) => setCategories(data.categories))
      .catch(() => toast.error("Failed to load categories"));
  }, []);

  async function onSubmit(data: WorkerForm) {
    setIsLoading(true);
    try {
      await api.post("/api/workers/register", {
        firstName: data.firstName,
        lastName: data.lastName,
        middleInitial: data.middleInitial || undefined,
        birthday: data.birthday,
        specialization: data.specialization,
        contactNumber: data.contactNumber,
        email: data.email || undefined,
        password: data.password,
        address: {
          street: data.street,
          houseLot: data.houseLot,
          blockNo: data.blockNo || "",
          barangay: data.barangay,
        },
      });

      toast.success("Worker registered successfully! Pending verification.");
      navigate("/admin/workers");
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to register worker"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Register Skilled Worker</h2>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2">
              <label className="label">First Name</label>
              <input
                className="input-field"
                {...register("firstName", { required: "Required" })}
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="label">Last Name</label>
              <input
                className="input-field"
                {...register("lastName", { required: "Required" })}
              />
              {errors.lastName && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.lastName.message}
                </p>
              )}
            </div>
            <div className="col-span-1">
              <label className="label">M.I.</label>
              <input
                maxLength={1}
                className="input-field"
                {...register("middleInitial")}
              />
            </div>
          </div>

          {/* Birthday */}
          <div>
            <label className="label">Birthday</label>
            <input
              type="date"
              className="input-field"
              {...register("birthday", { required: "Required" })}
            />
            {errors.birthday && (
              <p className="text-red-500 text-xs mt-1">
                {errors.birthday.message}
              </p>
            )}
          </div>

          {/* Specialization */}
          <div>
            <label className="label">Primary Specialization</label>
            <select
              className="input-field"
              {...register("specialization", { required: "Required" })}
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.specialization && (
              <p className="text-red-500 text-xs mt-1">
                {errors.specialization.message}
              </p>
            )}
            {categories.length === 0 && (
              <p className="text-yellow-600 text-xs mt-1">
                No categories found. Please add categories in Data Entry first.
              </p>
            )}
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Number</label>
              <input
                type="tel"
                placeholder="09171234567"
                className="input-field"
                {...register("contactNumber", {
                  required: "Required",
                  pattern: {
                    value: /^(\+63|0)\d{10}$/,
                    message: "Invalid PH number",
                  },
                })}
              />
              {errors.contactNumber && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.contactNumber.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input
                type="email"
                placeholder="worker@email.com"
                className="input-field"
                {...register("email")}
              />
            </div>
          </div>

          {/* Address */}
          <fieldset className="space-y-3">
            <legend className="label">Barangay Address</legend>
            <input
              placeholder="Street"
              className="input-field"
              {...register("street", { required: "Street is required" })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="House/Lot No."
                className="input-field"
                {...register("houseLot", { required: "Required" })}
              />
              <input
                placeholder="Block No. (optional)"
                className="input-field"
                {...register("blockNo")}
              />
            </div>
            <input
              placeholder="Barangay"
              className="input-field"
              {...register("barangay", { required: "Required" })}
            />
          </fieldset>

          {/* Temporary Password */}
          <div>
            <label className="label">Temporary Password</label>
            <input
              type="password"
              placeholder="Minimum 8 characters"
              className="input-field"
              {...register("password", {
                required: "Required",
                minLength: { value: 8, message: "Minimum 8 characters" },
              })}
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">
                {errors.password.message}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Share this with the worker. They can change it after first login.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? "Registering..." : "Register Worker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
