export const WORKER_CREDENTIAL_TYPES = {
  NATIONAL_ID: "national_id",
  DRIVER_LICENSE: "driver_license",
  PRC_ID: "prc_id",
  POLICE_CLEARANCE: "police_clearance",
  NBI_CLEARANCE: "nbi_clearance",
  SKILLS_CERTIFICATE: "skills_certificate",
  LEGACY_PSA: "PSA",
  LEGACY_NBI: "NBI",
  LEGACY_NC2: "NC2",
} as const;

export const ALL_WORKER_CREDENTIAL_OPTIONS = [
  {
    value: WORKER_CREDENTIAL_TYPES.NATIONAL_ID,
    label: "National ID",
    allowMultiple: false,
    legacy: false,
  },
  {
    value: WORKER_CREDENTIAL_TYPES.DRIVER_LICENSE,
    label: "Driver's License",
    allowMultiple: false,
    legacy: false,
  },
  {
    value: WORKER_CREDENTIAL_TYPES.PRC_ID,
    label: "PRC ID",
    allowMultiple: false,
    legacy: false,
  },
  {
    value: WORKER_CREDENTIAL_TYPES.POLICE_CLEARANCE,
    label: "Police Clearance",
    allowMultiple: false,
    legacy: false,
  },
  {
    value: WORKER_CREDENTIAL_TYPES.NBI_CLEARANCE,
    label: "NBI Clearance",
    allowMultiple: false,
    legacy: false,
  },
  {
    value: WORKER_CREDENTIAL_TYPES.SKILLS_CERTIFICATE,
    label: "Skills Certificate",
    allowMultiple: true,
    legacy: false,
  },
  {
    value: WORKER_CREDENTIAL_TYPES.LEGACY_PSA,
    label: "PSA Birth Certificate",
    allowMultiple: false,
    legacy: true,
  },
  {
    value: WORKER_CREDENTIAL_TYPES.LEGACY_NBI,
    label: "NBI Clearance",
    allowMultiple: false,
    legacy: true,
  },
  {
    value: WORKER_CREDENTIAL_TYPES.LEGACY_NC2,
    label: "NC2 Certificate",
    allowMultiple: false,
    legacy: true,
  },
] as const;

export type WorkerCredentialType =
  (typeof ALL_WORKER_CREDENTIAL_OPTIONS)[number]["value"];

export const ADMIN_WORKER_CREDENTIAL_OPTIONS = [
  ALL_WORKER_CREDENTIAL_OPTIONS[0], // National ID - always first
  ...ALL_WORKER_CREDENTIAL_OPTIONS.slice(1).filter((option) => !option.legacy),
];

export function getWorkerCredentialDefinition(type: string) {
  return ALL_WORKER_CREDENTIAL_OPTIONS.find((option) => option.value === type);
}

export function getWorkerCredentialLabel(type: string): string {
  return getWorkerCredentialDefinition(type)?.label ?? type;
}

export function isWorkerCredentialType(
  type: string
): type is WorkerCredentialType {
  return ALL_WORKER_CREDENTIAL_OPTIONS.some((option) => option.value === type);
}

export function canUploadMultipleWorkerCredentials(type: string): boolean {
  return getWorkerCredentialDefinition(type)?.allowMultiple ?? false;
}
