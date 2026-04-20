import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, X, Fingerprint, FileCheck, Plus } from "lucide-react";
import api from "@/services/api";
import { uploadFile } from "@/utils/uploadFile";
import { BackButton } from "@/components/common/BackButton";
import {
  WorkerCredentialDraft,
  createWorkerCredentialDraft,
  getNextWorkerCredentialType,
  getSelectableWorkerCredentialOptions,
  sanitizeCredentialStorageSegment,
} from "@/utils/workerCredentials";

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
  biometricEnrolled: boolean;
  termsAccepted: boolean;
}

interface Category {
  id: string;
  name: string;
}

export function WorkerRegistration() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [credentialDrafts, setCredentialDrafts] = useState<WorkerCredentialDraft[]>(
    []
  );

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkerForm>({
    defaultValues: {
      barangay: "Banilad",
    },
  });

  useEffect(() => {
    api
      .get("/api/categories")
      .then(({ data }) => setCategories(data.categories || []))
      .catch((error) => {
        console.error("Failed to load categories:", error);
        setCategories([]);
        toast.error("Failed to load categories");
      });
  }, []);

  function addCredentialDraft() {
    const nextType = getNextWorkerCredentialType(credentialDrafts);
    setCredentialDrafts((current) => [
      ...current,
      createWorkerCredentialDraft({ type: nextType }),
    ]);
  }

  function updateCredentialDraft(
    draftId: string,
    updates: Partial<WorkerCredentialDraft>
  ) {
    setCredentialDrafts((current) =>
      current.map((credential) =>
        credential.id === draftId ? { ...credential, ...updates } : credential
      )
    );
  }

  function handleCredentialTypeChange(draftId: string, type: string) {
    updateCredentialDraft(draftId, {
      type,
      name: createWorkerCredentialDraft({ type }).name,
      file: null,
    });

    const input = fileInputRefs.current[draftId];
    if (input) {
      input.value = "";
    }
  }

  function handleFileSelect(draftId: string, file: File | null) {
    updateCredentialDraft(draftId, { file });
  }

  function removeCredentialDraft(draftId: string) {
    setCredentialDrafts((current) =>
      current.filter((credential) => credential.id !== draftId)
    );

    const input = fileInputRefs.current[draftId];
    if (input) {
      input.value = "";
    }
  }

  function clearSelectedFile(draftId: string) {
    updateCredentialDraft(draftId, { file: null });

    const input = fileInputRefs.current[draftId];
    if (input) {
      input.value = "";
    }
  }

  async function onSubmit(data: WorkerForm) {
    if (!data.termsAccepted) {
      toast.error("Worker must accept the Terms and Conditions");
      return;
    }

    const invalidCredential = credentialDrafts.find(
      (credential) =>
        !credential.type || !credential.name.trim() || credential.file === null
    );
    if (invalidCredential) {
      toast.error(
        "Each added credential needs a certificate type, file name, and uploaded file."
      );
      return;
    }

    setIsLoading(true);
    let workerId: string | null = null;

    try {
      const { data: result } = await api.post("/api/workers/register", {
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
        biometricEnrolled: data.biometricEnrolled || false,
        termsAcceptedAt: new Date().toISOString(),
      });

      workerId = result.uid;

      const filesToUpload = credentialDrafts.filter(
        (credential) => credential.file !== null
      );

      if (filesToUpload.length > 0 && workerId) {
        const uploadedCredentials = await Promise.all(
          filesToUpload.map(async (credential) => {
            const path = `workers/${workerId}/credentials/${sanitizeCredentialStorageSegment(
              credential.type
            )}/${credential.id}_${sanitizeCredentialStorageSegment(
              credential.name
            )}`;
            const fileUrl = await uploadFile(path, credential.file!);
            return {
              type: credential.type,
              name: credential.name.trim(),
              fileUrl,
            };
          })
        );

        await api.patch(`/api/workers/${workerId}/credentials`, {
          credentials: uploadedCredentials,
        });
      }

      toast.success("Worker registered successfully! Pending verification.");
      navigate(`/admin/workers/${workerId}`);
    } catch (error: any) {
      if (workerId) {
        toast.warning(
          error.response?.data?.error ||
            "Worker was created, but the credential upload failed."
        );
        navigate(`/admin/workers/${workerId}`);
        return;
      }

      const message =
        error.response?.data?.error ||
        "Failed to register worker or upload credentials";
      toast.error(message);
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton to="/admin/workers" label="Back to Workers" />
      <h2 className="text-2xl font-bold mb-6">Register Skilled Worker</h2>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2">
              <label className="label">First Name</label>
              <input
                className="input-field"
                onKeyDown={(e) => { if (e.key.length === 1 && !/[a-zA-ZÀ-ÿÑñ\s'\-.]/.test(e.key)) e.preventDefault(); }}
                onPaste={(e) => { if (!/^[a-zA-ZÀ-ÿÑñ\s'\-.]*$/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
                {...register("firstName", {
                  required: "Required",
                  pattern: { value: /^[a-zA-ZÀ-ÿÑñ\s'\-.]+$/, message: "Letters only" },
                })}
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
                onKeyDown={(e) => { if (e.key.length === 1 && !/[a-zA-ZÀ-ÿÑñ\s'\-.]/.test(e.key)) e.preventDefault(); }}
                onPaste={(e) => { if (!/^[a-zA-ZÀ-ÿÑñ\s'\-.]*$/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
                {...register("lastName", {
                  required: "Required",
                  pattern: { value: /^[a-zA-ZÀ-ÿÑñ\s'\-.]+$/, message: "Letters only" },
                })}
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
                maxLength={2}
                className="input-field"
                onKeyDown={(e) => { if (e.key.length === 1 && !/[a-zA-ZÑñ.]/.test(e.key)) e.preventDefault(); }}
                onPaste={(e) => { if (!/^[a-zA-ZÑñ.]\.?$/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
                {...register("middleInitial", {
                  pattern: { value: /^[a-zA-ZÑñ]\.?$/, message: "Single letter" },
                })}
              />
              {errors.middleInitial && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.middleInitial.message}
                </p>
              )}
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Number</label>
              <input
                type="tel"
                placeholder="09171234567"
                className="input-field"
                autoComplete="tel"
                maxLength={13}
                onKeyDown={(e) => { if (e.key.length === 1 && (!/[\d+]/.test(e.key) || e.currentTarget.value.length >= 13)) e.preventDefault(); }}
                onPaste={(e) => { const text = e.clipboardData.getData("text"); if (!/^[\d+]*$/.test(text) || text.length > 13) e.preventDefault(); }}
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
                {...register("barangay", { required: "Required" })}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="label flex items-center gap-2">
              <FileCheck size={16} className="text-primary-600" />
              Credentials
            </legend>
            <p className="text-xs text-slate-400">
              Add the worker's certificates and IDs with a document type,
              certificate or file name, and uploaded photo or PDF.
            </p>

            {credentialDrafts.length === 0 && (
              <p className="text-sm text-slate-500">
                No credentials added yet. This section is optional during
                registration.
              </p>
            )}

            {credentialDrafts.map((credential) => {
              const options = getSelectableWorkerCredentialOptions(
                credentialDrafts,
                credential.id
              );

              return (
                <div
                  key={credential.id}
                  className="rounded-lg border border-slate-200 p-4 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-sm">Credential Entry</p>
                    <button
                      type="button"
                      onClick={() => removeCredentialDraft(credential.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">Certificate Type</label>
                      <select
                        value={credential.type}
                        onChange={(event) =>
                          handleCredentialTypeChange(credential.id, event.target.value)
                        }
                        className="input-field"
                      >
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Certificate/File Name</label>
                      <input
                        value={credential.name}
                        onChange={(event) =>
                          updateCredentialDraft(credential.id, {
                            name: event.target.value,
                          })
                        }
                        className="input-field"
                        placeholder="Enter certificate or file name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Upload Photo / File</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      ref={(element) => {
                        fileInputRefs.current[credential.id] = element;
                      }}
                      onChange={(event) =>
                        handleFileSelect(
                          credential.id,
                          event.target.files?.[0] || null
                        )
                      }
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[credential.id]?.click()}
                        className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
                      >
                        <Upload size={14} />
                        Upload Photo
                      </button>
                      {credential.file && (
                        <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                          <span className="truncate max-w-xs">
                            {credential.file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => clearSelectedFile(credential.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addCredentialDraft}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Plus size={14} />
              Add Credential
            </button>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="label flex items-center gap-2">
              <Fingerprint size={16} className="text-primary-600" />
              Biometric Enrollment
            </legend>
            <p className="text-xs text-slate-400">
              Fingerprint enrollment requires the Raspberry Pi biometric device.
              This can be done after the worker is created.
            </p>
            <label className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                {...register("biometricEnrolled")}
              />
              <span className="text-sm text-slate-700 font-medium">
                Fingerprint has been enrolled on the biometric device
              </span>
            </label>
          </fieldset>

          <div>
            <label className="label">Temporary Password</label>
            <input
              type="password"
              placeholder="Minimum 8 characters"
              className="input-field"
              autoComplete="new-password"
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
            <p className="text-xs text-slate-400 mt-1">
              Share this with the worker. They can change it after first login.
            </p>
          </div>

          <fieldset className="space-y-2 pt-2 border-t border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                {...register("termsAccepted", {
                  required: "Worker must accept the Terms and Conditions",
                })}
              />
              <span className="text-sm text-slate-700">
                Worker has read and accepted the{" "}
                <span className="text-primary-600 font-medium">
                  Terms and Conditions
                </span>
              </span>
            </label>
            {errors.termsAccepted && (
              <p className="text-red-500 text-xs ml-7">
                {errors.termsAccepted.message}
              </p>
            )}
          </fieldset>

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
