import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import { firebaseAuth } from "@/config/firebase";
import logoWithText from "@Assets/logo-with-text.png";
import { normalizePhilippinePhoneNumber } from "@/utils/phone";
import { isSeedAuthEmail } from "@/utils/auth";
import { Fingerprint, Loader } from "lucide-react";

interface LoginForm {
  identifier: string;
  password: string;
}

export function Login() {
  const { signIn, signInWithFingerprintToken } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFingerprintLoading, setIsFingerprintLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const fpUrl = import.meta.env.VITE_FINGERPRINT_URL || "http://localhost:5000";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  function normalizeIdentifierInput(value: string) {
    const trimmed = value.trimStart();
    if (/[a-zA-Z@._-]/.test(trimmed)) {
      return trimmed;
    }

    const raw = trimmed.replace(/[^\d+]/g, "");
    const maxLen = raw.startsWith("+") ? 13 : 11;
    return raw.slice(0, maxLen);
  }

  async function onSubmit(data: LoginForm) {
    setIsLoading(true);
    setNotFound(false);
    try {
      await signIn(
        data.identifier.includes("@")
          ? data.identifier.trim().toLowerCase()
          : normalizePhilippinePhoneNumber(data.identifier, "local"),
        data.password
      );

      if (
        firebaseAuth.currentUser?.email &&
        !firebaseAuth.currentUser.emailVerified &&
        !isSeedAuthEmail(firebaseAuth.currentUser.email)
      ) {
        toast.info("Verify your email to continue.");
        navigate("/verify-email");
        return;
      }

      toast.success("Logged in successfully");
      navigate("/");
    } catch (error: any) {
      if (error.code === "auth/invalid-credential") {
        setNotFound(true);
      } else {
        const message =
          error.code === "auth/too-many-requests"
            ? "Too many attempts. Please try again later."
            : "Login failed. Please try again.";
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFingerprintLogin() {
    setIsFingerprintLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`${fpUrl}/fingerprint/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Fingerprint service unavailable");
      }

      if (!result.success || !result.customToken) {
        toast.error(result.message || "Fingerprint not recognized");
        return;
      }

      await signInWithFingerprintToken(result.customToken);
      toast.success("Fingerprint login successful");
      navigate("/");
    } catch (error: any) {
      toast.error(
        error?.message ||
          "Fingerprint login failed. Check that the Raspberry Pi service is running."
      );
    } finally {
      setIsFingerprintLoading(false);
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
              <label htmlFor="identifier" className="label">
                Email or Contact Number
              </label>
              <input
                id="identifier"
                type="text"
                placeholder="you@example.com or 09171234567"
                className="input-field"
                {...register("identifier", {
                  required: "Email or contact number is required",
                  validate: (value) => {
                    if (/[a-zA-Z@._-]/.test(value.trim())) {
                      return (
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
                        "Enter a valid email address"
                      );
                    }
                    return (
                      /^(\+63|0)\d{10}$/.test(value) ||
                      "Enter a valid PH number (e.g. 09171234567)"
                    );
                  },
                  onChange: (e) => {
                    e.target.value = normalizeIdentifierInput(e.target.value);
                  },
                })}
                inputMode="email"
              />
              {errors.identifier && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.identifier.message}
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

            <button
              type="button"
              onClick={handleFingerprintLogin}
              disabled={isLoading || isFingerprintLoading}
              className="w-full rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 font-semibold text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isFingerprintLoading ? (
                <Loader size={18} className="animate-spin" />
              ) : (
                <Fingerprint size={18} />
              )}
              {isFingerprintLoading
                ? "Scanning fingerprint..."
                : "Sign In with Fingerprint"}
            </button>

            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Forgot password?
              </Link>
            </div>

            {notFound && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4 text-center">
                <p className="text-sm font-medium text-red-700">
                  Invalid email/contact number or password.
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Please check your number and password, or{" "}
                  <Link to="/register" className="font-semibold underline">
                    create a new account
                  </Link>
                  .
                </p>
                <Link
                  to="/"
                  className="mt-3 inline-block rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Back to Landing Page
                </Link>
              </div>
            )}
          </form>

          <div className="mt-4 text-center text-sm text-slate-500">
            Password recovery is handled through an admin review request.
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
