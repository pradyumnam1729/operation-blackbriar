import { Router } from "express";
import crypto from "crypto";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity } from "../services/activity";
import { Role } from "../middleware/auth";

// User Management (modeled on Aurigo Essentials' UM module: create/invite
// with activation, role assignment, lock/unlock, delete). Supabase mapping:
// invite → auth.admin.inviteUserByEmail (falls back to a one-time temp
// password when no SMTP is configured), lock → auth admin ban, roles →
// profiles.role. Admin-only end to end.
export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

const ROLES: Role[] = ["admin", "sales", "marketing", "elt"];

interface UserRow {
  id: string;
  email: string;
  fullName: string | null;
  role: Role | null;
  status: "active" | "invited" | "locked";
  lastSignIn: string | null;
  createdAt: string;
}

function tempPassword(): string {
  // Policy-safe one-time password the admin shares out of band.
  return `Hive-${crypto.randomBytes(6).toString("base64url")}-7a`;
}

// GET /api/users — auth users merged with role profiles.
usersRouter.get("/", async (_req, res) => {
  const sb = supabase()!;
  const { data: authList, error } = await sb.auth.admin.listUsers({ perPage: 200 });
  if (error) return res.status(500).json({ error: error.message });
  const { data: profiles } = await sb.from("profiles").select("id, email, full_name, role");
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  const users: UserRow[] = (authList?.users ?? []).map((u) => {
    const profile = byId.get(u.id);
    const banned =
      "banned_until" in u &&
      (u as { banned_until?: string | null }).banned_until != null &&
      new Date((u as { banned_until?: string }).banned_until!).getTime() > Date.now();
    return {
      id: u.id,
      email: u.email ?? profile?.email ?? "(no email)",
      fullName: profile?.full_name ?? (u.user_metadata?.full_name as string | undefined) ?? null,
      role: (profile?.role as Role | undefined) ?? null,
      status: banned ? "locked" : u.last_sign_in_at ? "active" : "invited",
      lastSignIn: u.last_sign_in_at ?? null,
      createdAt: u.created_at,
    };
  });
  users.sort((a, b) => a.email.localeCompare(b.email));
  res.json({ users, roles: ROLES });
});

// POST /api/users/invite { email, full_name, role } — invite email when the
// project can send mail; otherwise a one-time temp password (returned ONCE).
usersRouter.post("/invite", async (req, res) => {
  const { email, full_name, role } = (req.body ?? {}) as {
    email?: string;
    full_name?: string;
    role?: string;
  };
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (!role || !ROLES.includes(role as Role)) {
    return res.status(400).json({ error: `role must be one of ${ROLES.join(", ")}` });
  }
  const sb = supabase()!;
  const cleanEmail = email.trim().toLowerCase();
  const name = full_name?.trim() || null;

  let userId: string | null = null;
  let delivered: "email" | "temp_password" = "email";
  let oneTimePassword: string | null = null;

  const invited = await sb.auth.admin.inviteUserByEmail(cleanEmail, {
    data: name ? { full_name: name } : undefined,
  });
  if (!invited.error && invited.data.user) {
    userId = invited.data.user.id;
  } else {
    // Duplicate → clear error; anything else (usually no SMTP) → temp password.
    if (invited.error?.message.toLowerCase().includes("already")) {
      return res.status(400).json({ error: `${cleanEmail} already has an account` });
    }
    oneTimePassword = tempPassword();
    const created = await sb.auth.admin.createUser({
      email: cleanEmail,
      password: oneTimePassword,
      email_confirm: true,
      user_metadata: name ? { full_name: name } : undefined,
    });
    if (created.error || !created.data.user) {
      return res.status(500).json({
        error: `Could not invite (${invited.error?.message ?? "mail unavailable"}) or create (${created.error?.message ?? "unknown"})`,
      });
    }
    userId = created.data.user.id;
    delivered = "temp_password";
  }

  const { error: pErr } = await sb.from("profiles").upsert({
    id: userId,
    email: cleanEmail,
    full_name: name,
    role,
  });
  if (pErr) return res.status(500).json({ error: `User created but profile failed: ${pErr.message}` });

  void logActivity("user", userId, req.user!.id, "user_invited", {
    email: cleanEmail,
    role,
    delivered,
  });
  res.status(201).json({
    id: userId,
    delivered,
    // Shown exactly once in the UI; never stored or logged.
    tempPassword: oneTimePassword,
  });
});

// PUT /api/users/:id { role?, full_name? }
usersRouter.put("/:id", async (req, res) => {
  const { role, full_name } = (req.body ?? {}) as { role?: string; full_name?: string };
  const sb = supabase()!;

  const patch: Record<string, unknown> = {};
  if (role !== undefined) {
    if (!ROLES.includes(role as Role)) {
      return res.status(400).json({ error: `role must be one of ${ROLES.join(", ")}` });
    }
    // Last-line safety: an admin cannot demote themselves (lockout protection).
    if (req.params.id === req.user!.id && role !== "admin") {
      return res.status(400).json({ error: "You cannot remove your own admin role" });
    }
    patch.role = role;
  }
  if (full_name !== undefined) patch.full_name = full_name.trim() || null;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Nothing to update" });

  const { error } = await sb.from("profiles").update(patch).eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("user", req.params.id, req.user!.id, "user_updated", {
    fields: Object.keys(patch),
  });
  res.json({ ok: true });
});

// POST /api/users/:id/lock { locked } — Supabase ban; locked users cannot sign in.
usersRouter.post("/:id/lock", async (req, res) => {
  const { locked } = (req.body ?? {}) as { locked?: boolean };
  if (typeof locked !== "boolean") return res.status(400).json({ error: "locked boolean required" });
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: "You cannot lock your own account" });
  }
  const sb = supabase()!;
  const { error } = await sb.auth.admin.updateUserById(req.params.id, {
    ban_duration: locked ? "87600h" : "none",
  });
  if (error) return res.status(500).json({ error: error.message });
  void logActivity("user", req.params.id, req.user!.id, locked ? "user_locked" : "user_unlocked", {});
  res.json({ ok: true });
});

// POST /api/users/:id/reset-link — recovery link the admin shares directly
// (works without SMTP; the link signs the user in to set a new password).
usersRouter.post("/:id/reset-link", async (req, res) => {
  const sb = supabase()!;
  const { data: userData, error: uErr } = await sb.auth.admin.getUserById(req.params.id);
  if (uErr || !userData.user?.email) return res.status(404).json({ error: "User not found" });
  const { data, error } = await sb.auth.admin.generateLink({
    type: "recovery",
    email: userData.user.email,
  });
  if (error || !data.properties?.action_link) {
    return res.status(500).json({ error: error?.message ?? "Could not generate a reset link" });
  }
  void logActivity("user", req.params.id, req.user!.id, "reset_link_generated", {});
  res.json({ link: data.properties.action_link });
});

// DELETE /api/users/:id
usersRouter.delete("/:id", async (req, res) => {
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  const sb = supabase()!;
  const { error } = await sb.auth.admin.deleteUser(req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await sb.from("profiles").delete().eq("id", req.params.id);
  void logActivity("user", req.params.id, req.user!.id, "user_deleted", {});
  res.json({ ok: true });
});
