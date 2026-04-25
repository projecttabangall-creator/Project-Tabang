import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import api from "@/services/api";

interface ForgotPasswordForm {
  firstName: string;
  lastName: string;
  role: "resident" | "worker";
  contactNumber: string;
  note: string;
}

export function ForgotPassword() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    defaultValues: {
      role: "resident",
      note: "",
    },
  });

  function normalizePhoneInput(value: string) {
    const raw = value.replace(/[^\d+]/g, "");
    const maxLen = raw.startsWith("+") ? 13 : 11;
    return raw.slice(0, maxLen);
  }

  async function onSubmit(data: ForgotPasswordForm) {
    setIsSubmitting(true);
    try {
      await api.post("/api/auth/request-password-reset", data);
      setSubmitted(true);
      toast.success("Password reset request submitted");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <BackButton to="/" label="Back" />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700">Reset Password</h1>
          <p className="text-slate-500 mt-2">
            Submit a request so an administrator can issue a temporary password.
          </p>
        </div>

        <div className="card">
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                Your request is now pending admin review.
              </div>
              <p className="text-sm text-slate-600">
                An administrator will verify your details and provide a temporary password.
              </p>
              <Link to="/login" className="btn-primary inline-block w-full">
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="firstName" className="label">
                  First Name
                </label>
                <input
                  id="firstName"
                  className="input-field"
                  {...register("firstName", { required: "First name is required" })}
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="label">
                  Last Name
                </label>
                <input
                  id="lastName"
                  className="input-field"
                  {...register("lastName", { required: "Last name is required" })}
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="role" className="label">
                  Account Type
                </label>
                <select
                  id="role"
                  className="input-field"
                  {...register("role", { required: "Role is required" })}
                >
                  <option value="resident">Resident</option>
                  <option value="worker">Worker</option>
                </select>
              </div>

              <div>
                <label htmlFor="contactNumber" className="label">
                  Contact Number
                </label>
                <input
                  id="contactNumber"
                  type="tel"
                  className="input-field"
                  placeholder="09171234567"
                  inputMode="tel"
                  maxLength={13}
                  {...register("contactNumber", {
                    required: "Contact number is required",
                    pattern: {
                      value: /^(\+63|0)\d{10}$/,
                      message: "Enter a valid PH number (e.g. 09171234567)",
                    },
                    onChange: (e) => {
                      e.target.value = normalizePhoneInput(e.target.value);
                    },
                  })}
                />
                {errors.contactNumber && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.contactNumber.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="note" className="label">
                  Additional Note
                </label>
                <textarea
                  id="note"
                  rows={4}
                  className="input-field resize-none"
                  placeholder="Add any details that can help the admin verify your request."
                  {...register("note")}
                />
              </div>

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting ? "Submitting..." : "Submit Reset Request"}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
            Remembered it?{" "}
            <Link
              to="/login"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
