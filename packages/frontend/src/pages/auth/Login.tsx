import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import logoWithText from "@Assets/logo-with-text.png";

interface LoginForm {
  contactNumber: string;
  password: string;
}

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  async function onSubmit(data: LoginForm) {
    setIsLoading(true);
    try {
      await signIn(data.contactNumber, data.password);
      toast.success("Logged in successfully");
      // AuthContext will detect the user and redirect via ProtectedRoute
      navigate("/");
    } catch (error: any) {
      const message =
        error.code === "auth/invalid-credential"
          ? "Invalid contact number or password"
          : error.code === "auth/too-many-requests"
            ? "Too many attempts. Please try again later."
            : "Login failed. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <BackButton to="/" label="Back" />
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <img
            src={logoWithText}
            alt="TABANG"
            className="h-24 object-contain mx-auto mb-3"
          />
          <h1 className="text-4xl font-extrabold text-primary-700 font-display tracking-tight mb-2">
            TABANG
          </h1>
          <p className="text-slate-500">Community Service Booking Platform</p>
        </div>

        {/* Login Card */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Sign In</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="contactNumber" className="label">
                Contact Number
              </label>
              <input
                id="contactNumber"
                type="tel"
                placeholder="09171234567"
                className="input-field"
                {...register("contactNumber", {
                  required: "Contact number is required",
                })}
              />
              {errors.contactNumber && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.contactNumber.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                className="input-field"
                {...register("password", {
                  required: "Password is required",
                })}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <Link
              to="/forgot-password"
              className="text-primary-600 hover:text-primary-700"
            >
              Forgot password?
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Register as Resident
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
