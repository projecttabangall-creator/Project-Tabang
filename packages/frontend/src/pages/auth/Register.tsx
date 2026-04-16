import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";
import logoWithText from "@Assets/logo-with-text.png";

interface RegisterForm {
  firstName: string;
  lastName: string;
  birthday: string;
  contactNumber: string;
  password: string;
  confirmPassword: string;
  street: string;
  houseLot: string;
  blockNo: string;
  barangay: string;
}

export function Register() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    defaultValues: {
      barangay: "Banilad",
    },
  });

  const password = watch("password");

  async function onSubmit(data: RegisterForm) {
    setIsLoading(true);
    try {
      const response = await api.post("/api/auth/register", {
        firstName: data.firstName,
        lastName: data.lastName,
        birthday: data.birthday,
        contactNumber: data.contactNumber,
        password: data.password,
        address: {
          street: data.street,
          houseLot: data.houseLot,
          blockNo: data.blockNo || "",
          barangay: data.barangay,
        },
      });

      toast.success("Registration successful! Please verify your OTP.");

      // In dev mode, show the OTP
      if (response.data.devOtp) {
        toast.info(`Dev OTP: ${response.data.devOtp}`, { duration: 10000 });
      }

      navigate("/verify-otp", {
        state: { contactNumber: data.contactNumber },
      });
    } catch (error: any) {
      const message =
        error.response?.data?.error || "Registration failed. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        <BackButton to="/" label="Back" />
        <div className="text-center mb-8">
          <img
            src={logoWithText}
            alt="TABANG"
            className="h-24 object-contain mx-auto mb-3"
          />
          <h1 className="text-4xl font-extrabold text-primary-700 font-display tracking-tight mb-2">
            TABANG
          </h1>
          <p className="text-slate-500">Create your account</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Resident Registration</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="label">
                  First Name
                </label>
                <input
                  id="firstName"
                  className="input-field"
                  {...register("firstName", { required: "Required" })}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="lastName" className="label">
                  Last Name
                </label>
                <input
                  id="lastName"
                  className="input-field"
                  {...register("lastName", { required: "Required" })}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Birthday */}
            <div>
              <label htmlFor="birthday" className="label">
                Birthday
              </label>
              <input
                id="birthday"
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

            {/* Contact */}
            <div>
              <label htmlFor="contactNumber" className="label">
                Contact Number
              </label>
              <input
                id="contactNumber"
                type="tel"
                placeholder="09171234567"
                className="input-field"
                autoComplete="tel"
                {...register("contactNumber", {
                  required: "Required",
                  pattern: {
                    value: /^(\+63|0)\d{10}$/,
                    message: "Enter a valid PH number (e.g. 09171234567)",
                  },
                })}
              />
              {errors.contactNumber && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.contactNumber.message}
                </p>
              )}
            </div>

            {/* Address */}
            <fieldset className="space-y-3">
              <legend className="label">Barangay Address</legend>
              <div>
                <label htmlFor="street" className="label">
                  Street
                </label>
                <input
                  id="street"
                  placeholder="Street"
                  className="input-field"
                  autoComplete="address-line1"
                  {...register("street", { required: "Street is required" })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="houseLot" className="label">
                    House/Lot No.
                  </label>
                  <input
                    id="houseLot"
                    placeholder="House/Lot No."
                    className="input-field"
                    autoComplete="address-line2"
                    {...register("houseLot", { required: "Required" })}
                  />
                </div>
                <div>
                  <label htmlFor="blockNo" className="label">
                    Block No.
                  </label>
                  <input
                    id="blockNo"
                    placeholder="Block No. (optional)"
                    className="input-field"
                    autoComplete="off"
                    {...register("blockNo")}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="barangay" className="label">
                  Barangay
                </label>
                <input
                  id="barangay"
                  placeholder="Barangay"
                  className="input-field"
                  autoComplete="address-level4"
                  {...register("barangay", {
                    required: "Barangay is required",
                  })}
                />
              </div>
            </fieldset>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
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
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                className="input-field"
                {...register("confirmPassword", {
                  required: "Required",
                  validate: (value) =>
                    value === password || "Passwords do not match",
                })}
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? "Registering..." : "Register"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
