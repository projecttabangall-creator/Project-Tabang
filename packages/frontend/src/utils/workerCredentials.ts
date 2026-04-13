import {
  ADMIN_WORKER_CREDENTIAL_OPTIONS,
  WORKER_CREDENTIAL_TYPES,
  canUploadMultipleWorkerCredentials,
  getWorkerCredentialDefinition,
  getWorkerCredentialLabel,
} from "@/constants/workerCredentials";

export interface WorkerCredentialRecord {
  type: string;
  name?: string;
  fileUrl?: string;
  uploadedAt?: unknown;
}

export interface WorkerCredentialDraft {
  id: string;
  type: string;
  name: string;
  file: File | null;
  existingUrl?: string;
  uploadedAt?: unknown;
}

function createDraftId(): string {
  return `credential_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getDefaultWorkerCredentialName(type: string): string {
  if (type === WORKER_CREDENTIAL_TYPES.SKILLS_CERTIFICATE) {
    return "";
  }

  return getWorkerCredentialLabel(type);
}

export function createWorkerCredentialDraft(
  overrides: Partial<WorkerCredentialDraft> = {}
): WorkerCredentialDraft {
  const type = overrides.type || WORKER_CREDENTIAL_TYPES.NATIONAL_ID;

  return {
    id: overrides.id || createDraftId(),
    type,
    name:
      overrides.name !== undefined
        ? overrides.name
        : getDefaultWorkerCredentialName(type),
    file: overrides.file ?? null,
    existingUrl: overrides.existingUrl,
    uploadedAt: overrides.uploadedAt,
  };
}

export function buildWorkerCredentialDrafts(
  credentials: WorkerCredentialRecord[] = []
): WorkerCredentialDraft[] {
  return credentials.map((credential) =>
    createWorkerCredentialDraft({
      type: credential.type,
      name:
        credential.name || getDefaultWorkerCredentialName(credential.type),
      existingUrl: credential.fileUrl,
      uploadedAt: credential.uploadedAt,
    })
  );
}

export function getSelectableWorkerCredentialOptions(
  drafts: WorkerCredentialDraft[],
  draftId: string
) {
  const currentDraft = drafts.find((draft) => draft.id === draftId);
  const usedSingleValueTypes = new Set(
    drafts
      .filter(
        (draft) =>
          draft.id !== draftId &&
          draft.type &&
          !canUploadMultipleWorkerCredentials(draft.type)
      )
      .map((draft) => draft.type)
  );

  const options = ADMIN_WORKER_CREDENTIAL_OPTIONS.filter(
    (option) =>
      option.value === currentDraft?.type ||
      option.allowMultiple ||
      !usedSingleValueTypes.has(option.value)
  );

  if (
    currentDraft?.type &&
    !options.some((option) => option.value === currentDraft.type)
  ) {
    const currentDefinition = getWorkerCredentialDefinition(currentDraft.type);
    if (currentDefinition) {
      return [currentDefinition, ...options];
    }
  }

  return options;
}

export function getNextWorkerCredentialType(
  drafts: WorkerCredentialDraft[]
): string {
  const usedSingleValueTypes = new Set(
    drafts
      .filter((draft) => draft.type && !canUploadMultipleWorkerCredentials(draft.type))
      .map((draft) => draft.type)
  );

  return (
    ADMIN_WORKER_CREDENTIAL_OPTIONS.find(
      (option) => option.allowMultiple || !usedSingleValueTypes.has(option.value)
    )?.value || WORKER_CREDENTIAL_TYPES.SKILLS_CERTIFICATE
  );
}

export function sanitizeCredentialStorageSegment(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "credential";
}
