import { NextFunction, Request, Response } from "express";
import { supabase } from "../services/db";

export type Role = "admin" | "sales" | "marketing" | "elt";

export interface AuthedUser {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

const LOCAL_DEV_USER: AuthedUser = {
  id: "local-dev",
  email: "dev@local",
  fullName: "Local Dev (no Supabase)",
  role: "admin",
};

/** Verifies the Supabase access token and attaches the user's profile (with role). */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sb = supabase();
  // No Supabase configured — local testing mode, skip auth entirely as admin.
  if (!sb) {
    req.user = LOCAL_DEV_USER;
    return next();
  }

  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in" });

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid or expired session" });

  const { data: profile } = await sb
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", data.user.id)
    .single();
  if (!profile) return res.status(403).json({ error: "No profile for this user" });

  req.user = {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as Role,
  };
  next();
}

/** PMMs are admins: full access. Everyone else is a consumer. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin (PMM) access required" });
  }
  next();
}

export function isAdmin(req: Request): boolean {
  return req.user?.role === "admin";
}
