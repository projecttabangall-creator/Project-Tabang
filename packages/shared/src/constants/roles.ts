export const ROLES = {
  RESIDENT: "resident",
  WORKER: "worker",
  ADMIN: "admin",
} as const;

export const ALL_ROLES = [ROLES.RESIDENT, ROLES.WORKER, ROLES.ADMIN] as const;
