export const ROLES = {
  RESIDENT: "resident",
  WORKER: "worker",
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
} as const;

export const ALL_ROLES = [ROLES.RESIDENT, ROLES.WORKER, ROLES.ADMIN, ROLES.SUPERADMIN] as const;
