import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";

export function AdminRegistration() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    middleInitial: "",
    contactNumber: "",
    email: "",
    password: "",
    assignedBarangay: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.firstName || !form.lastName || !form.contactNumber || !form.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    const namePattern = /^[a-zA-ZÀ-ÿÑñ\s'\-.]+$/;
    if (!namePattern.test(form.firstName)) {
      toast.error("First name should contain letters only");
      return;
    }
    if (!namePattern.test(form.lastName)) {
      toast.error("Last name should contain letters only");
      return;
    }
    if (form.middleInitial && !/^[a-zA-ZÑñ]\.?$/.test(form.middleInitial)) {
      toast.error("Middle initial should be a single letter");
      return;
    }

    if (!/^(\+63|0)\d{10}$/.test(form.contactNumber)) {
      toast.error("Enter a valid PH number (e.g. 09171234567)");
      return;
    }

    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/superadmin/register-admin", form);
      toast.success("Admin account created successfully");
      navigate("/superadmin/admins");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || "Failed to create admin account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div className="flex items-center gap-2">
          <ShieldCheck size={24} className="text-primary-600" />
          <h1 className="page-title">Register Admin</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="card space-y-4">
          <h2 className="section-title">Personal Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name <span className="text-rose-500">*</span></label>
              <input
                className="input-field"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value.replace(/[^a-zA-ZÀ-ÿÑñ\s'\-.]/g, ""))}
                placeholder="Juan"
                required
              />
            </div>
            <div>
              <label className="label">Last Name <span className="text-rose-500">*</span></label>
              <input
                className="input-field"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value.replace(/[^a-zA-ZÀ-ÿÑñ\s'\-.]/g, ""))}
                placeholder="Dela Cruz"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Middle Initial</label>
              <input
                className="input-field"
                value={form.middleInitial}
                onChange={(e) => set("middleInitial", e.target.value.replace(/[^a-zA-ZÑñ.]/g, ""))}
                placeholder="M."
                maxLength={3}
              />
            </div>
            <div>
              <label className="label">Assigned Barangay</label>
              <select
                className="input-field"
                value={form.assignedBarangay}
                onChange={(e) => set("assignedBarangay", e.target.value)}
              >
                <option value="">Select barangay</option>
                <option value="Banilad">Banilad</option>
              </select>
            </div>
          </div>
        </div>

        {/* Account Credentials */}
        <div className="card space-y-4">
          <h2 className="section-title">Account Credentials</h2>

          <div>
            <label className="label">Contact Number <span className="text-rose-500">*</span></label>
            <input
              className="input-field"
              value={form.contactNumber}
              onChange={(e) => set("contactNumber", e.target.value.replace(/[^\d+]/g, ""))}
              placeholder="09XXXXXXXXX"
              required
            />
          </div>

          <div>
            <label className="label">Email (optional)</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="label">Password <span className="text-rose-500">*</span></label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="input-field pr-10"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Creating Account…
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              Register Admin
            </>
          )}
        </button>
      </form>
    </div>
  );
}
