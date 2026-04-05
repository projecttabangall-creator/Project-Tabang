import { Request, Response, NextFunction } from "express";
import { auth, db } from "../config/firebase";
import { UserRole } from "@tabang/shared";

// Extend Express Request to include user info
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    role: UserRole;
    contactNumber: string;
    accountStatus: string;
  };
}

/**
 * Middleware: Verify Firebase ID token from Authorization header.
 * Attaches user info (uid, role, contactNumber, accountStatus) to req.user.
 */
export async function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Fetch user document for role and status
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      res.status(401).json({ error: "User account not found" });
      return;
    }

    const userData = userDoc.data()!;

    // Check account status
    if (userData.accountStatus === "suspended") {
      res.status(403).json({ error: "Account is suspended" });
      return;
    }
    if (userData.accountStatus === "banned") {
      res.status(403).json({ error: "Account is banned" });
      return;
    }

    req.user = {
      uid,
      role: userData.role as UserRole,
      contactNumber: userData.contactNumber,
      accountStatus: userData.accountStatus,
    };

    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
