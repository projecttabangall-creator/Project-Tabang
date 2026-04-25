import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface ChangePasswordForm {
  newPassword: string;
  confirmPassword: string;
}

export function ChangePassword() {
  const navigate = useNavigate();
  const { signOut, userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordForm>();

  async function onSubmit(data: ChangePasswordForm) {
    setIsSubmitting(true);
    try {
      await api.post("/api/auth/change-password", {
        newPassword: data.newPassword,
      });
      toast.success("Password updated. Please sign in again.");
      await signOut();
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Change Password</h1>
            <p className="mt-2 text-sm text-slate-600">
              {userProfile?.firstName
                ? `${userProfile.firstName}, you must set a new password before continuing.`
                : "You must set a new password before continuing."}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="label">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                className="input-field"
                placeholder="Enter a new password"
                {...register("newPassword", {
                  required: "New password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                })}
              />
              {errors.newPassword && (
                <p className="mt-1 text-xs text-red-500">{errors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="input-field"
                placeholder="Re-enter your new password"
                {...register("confirmPassword", {
                  required: "Please confirm your password",
                  validate: (value) =>
                    value === watch("newPassword") || "Passwords do not match",
                })}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? "Saving..." : "Update Password"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
            Need help with the temporary password?{" "}
            <Link to="/forgot-password" className="font-medium text-primary-600">
              Contact admin through the reset request form
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
