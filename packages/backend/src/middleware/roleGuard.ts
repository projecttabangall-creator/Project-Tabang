import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { UserRole } from "@tabang/shared";

/**
 * Middleware factory: restricts access to specified roles.
 * Must be used AFTER verifyToken middleware.
 *
 * Usage: router.get("/admin-only", verifyToken, roleGuard("admin"), handler)
 *        router.get("/multi", verifyToken, roleGuard("admin", "worker"), handler)
 */
export function roleGuard(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // superadmin inherits all admin permissions automatically
    const effectiveRoles: UserRole[] = allowedRoles.includes("admin")
      ? Array.from(new Set([...allowedRoles, "superadmin"]))
      : allowedRoles;

    if (!effectiveRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Insufficient permissions",
        required: allowedRoles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}
