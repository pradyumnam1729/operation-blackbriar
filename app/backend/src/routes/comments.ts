import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";
import { logActivity, notify } from "../services/activity";

// Collaboration backend: threaded comments with @mentions (users + team tags),
// notifications, and the per-entity activity feed.
export const commentsRouter = Router();

const ENTITY_TYPES = ["artifact", "request"];

// Team tag → platform role that receives the notification. Product has no
// dedicated role, so PMM admins act as its proxy.
const TEAM_ROLE: Record<string, string> = {
  sales: "sales",
  marketing: "marketing",
  elt: "elt",
  product: "admin",
};

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface TeamRow {
  id: string;
  name: string;
}

interface CommentOut {
  id: string;
  parent_id: string | null;
  body: string;
  resolved: boolean;
  created_at: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  resolved_by_name: string | null;
  mentions: { label: string; type: "user" | "team" }[];
  children: CommentOut[];
}

/** Match @tokens against profiles (email prefix or first word of full name) and team tags. */
function parseMentions(body: string, profiles: ProfileRow[], teams: TeamRow[]) {
  const tokens = Array.from(body.matchAll(/@([A-Za-z0-9._'-]+)/g)).map((m) => m[1].toLowerCase());
  const users = new Map<string, ProfileRow>();
  const matchedTeams = new Map<string, TeamRow>();
  for (const token of tokens) {
    for (const p of profiles) {
      const emailPrefix = p.email.split("@")[0].toLowerCase();
      const firstWord = (p.full_name ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      if (token === emailPrefix || (firstWord !== "" && token === firstWord)) {
        users.set(p.id, p);
      }
    }
    for (const t of teams) {
      if (t.name.toLowerCase() === token) matchedTeams.set(t.id, t);
    }
  }
  return { users: [...users.values()], teams: [...matchedTeams.values()] };
}

// GET /?entity_type=&entity_id= — threaded comments with author + mentions.
commentsRouter.get("/", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { entity_type, entity_id } = req.query as Record<string, string | undefined>;
  if (!entity_type || !ENTITY_TYPES.includes(entity_type) || !entity_id) {
    return res.status(400).json({ error: "entity_type (artifact|request) and entity_id are required" });
  }

  const { data, error } = await sb
    .from("comments")
    .select(
      "id, parent_id, body, resolved, created_at, author_id, " +
        "author:profiles!comments_author_id_fkey(full_name, email, role), " +
        "resolver:profiles!comments_resolved_by_fkey(full_name)"
    )
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const rows = (data ?? []) as unknown as {
    id: string;
    parent_id: string | null;
    body: string;
    resolved: boolean;
    created_at: string;
    author_id: string | null;
    author: { full_name: string | null; email: string; role: string } | null;
    resolver: { full_name: string | null } | null;
  }[];

  let mentionRows: { comment_id: string; user: { full_name: string | null } | null; team: { name: string } | null }[] = [];
  if (rows.length > 0) {
    const { data: mData } = await sb
      .from("mentions")
      .select("comment_id, user:profiles(full_name), team:team_tags(name)")
      .in("comment_id", rows.map((r) => r.id));
    mentionRows = (mData ?? []) as unknown as typeof mentionRows;
  }

  const byId = new Map<string, CommentOut>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      parent_id: r.parent_id,
      body: r.body,
      resolved: r.resolved,
      created_at: r.created_at,
      author_id: r.author_id,
      author_name: r.author?.full_name ?? r.author?.email ?? "Unknown",
      author_role: r.author?.role ?? "",
      resolved_by_name: r.resolver?.full_name ?? null,
      mentions: [],
      children: [],
    });
  }
  for (const m of mentionRows) {
    const c = byId.get(m.comment_id);
    if (!c) continue;
    if (m.user?.full_name) c.mentions.push({ label: m.user.full_name, type: "user" });
    if (m.team?.name) c.mentions.push({ label: m.team.name, type: "team" });
  }
  const top: CommentOut[] = [];
  for (const c of byId.values()) {
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
    if (parent) parent.children.push(c);
    else top.push(c);
  }
  res.json({ comments: top });
});

// GET /activity?entity_type=&entity_id= — activity feed for the entity, newest first.
commentsRouter.get("/activity", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { entity_type, entity_id } = req.query as Record<string, string | undefined>;
  if (!entity_type || !entity_id) {
    return res.status(400).json({ error: "entity_type and entity_id are required" });
  }
  const { data, error } = await sb
    .from("activity_log")
    .select("id, action, detail, created_at, actor:profiles(full_name, email)")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  const rows = (data ?? []) as unknown as {
    id: string;
    action: string;
    detail: Record<string, unknown>;
    created_at: string;
    actor: { full_name: string | null; email: string } | null;
  }[];
  res.json({
    activity: rows.map((r) => ({
      id: r.id,
      action: r.action,
      detail: r.detail,
      created_at: r.created_at,
      actor_name: r.actor?.full_name ?? r.actor?.email ?? "System",
    })),
  });
});

// GET /notifications — current user's notifications, newest first.
commentsRouter.get("/notifications", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { data, error } = await sb
    .from("notifications")
    .select("id, type, payload, read, created_at")
    .eq("user_id", req.user!.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ notifications: data ?? [] });
});

// POST /notifications/read-all — mark every notification read.
commentsRouter.post("/notifications/read-all", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { error } = await sb
    .from("notifications")
    .update({ read: true })
    .eq("user_id", req.user!.id)
    .eq("read", false);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /notifications/:id/read
commentsRouter.post("/notifications/:id/read", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { error } = await sb
    .from("notifications")
    .update({ read: true })
    .eq("id", req.params.id)
    .eq("user_id", req.user!.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// GET /mention-targets — labels the composer can insert after "@".
commentsRouter.get("/mention-targets", requireAuth, async (_req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const [{ data: profiles }, { data: teams }] = await Promise.all([
    sb.from("profiles").select("full_name, email").order("full_name"),
    sb.from("team_tags").select("name").order("name"),
  ]);
  const targets = [
    ...((profiles ?? []) as { full_name: string | null; email: string }[]).map((p) => ({
      label: p.full_name && p.full_name.trim() !== "" ? p.full_name : p.email.split("@")[0],
      type: "user" as const,
    })),
    ...((teams ?? []) as { name: string }[]).map((t) => ({ label: t.name, type: "team" as const })),
  ];
  res.json({ targets });
});

// POST / — new comment (or reply). Parses @mentions, notifies, logs activity.
commentsRouter.post("/", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const user = req.user!;
  const { entity_type, entity_id, parent_id, body } = req.body as {
    entity_type?: string;
    entity_id?: string;
    parent_id?: string;
    body?: string;
  };
  if (!entity_type || !ENTITY_TYPES.includes(entity_type) || !entity_id) {
    return res.status(400).json({ error: "entity_type (artifact|request) and entity_id are required" });
  }
  if (!body || body.trim() === "") return res.status(400).json({ error: "body is required" });

  const [{ data: profiles }, { data: teams }] = await Promise.all([
    sb.from("profiles").select("id, email, full_name, role"),
    sb.from("team_tags").select("id, name"),
  ]);
  const mentions = parseMentions(body, (profiles ?? []) as ProfileRow[], (teams ?? []) as TeamRow[]);

  const { data: comment, error } = await sb
    .from("comments")
    .insert({
      entity_type,
      entity_id,
      parent_id: parent_id && parent_id.trim() !== "" ? parent_id : null,
      body: body.trim(),
      author_id: user.id,
    })
    .select("id, parent_id, body, resolved, created_at")
    .single();
  if (error || !comment) return res.status(500).json({ error: error?.message ?? "Insert failed" });

  const mentionRows = [
    ...mentions.users.map((u) => ({ comment_id: comment.id, mentioned_user: u.id })),
    ...mentions.teams.map((t) => ({ comment_id: comment.id, mentioned_team: t.id })),
  ];
  if (mentionRows.length > 0) {
    const { error: mErr } = await sb.from("mentions").insert(mentionRows);
    if (mErr) console.error("mentions insert failed:", mErr.message);
  }

  // ---- notifications ----
  const authorName = user.fullName ?? user.email;
  const basePayload = {
    entity_type,
    entity_id,
    comment_id: comment.id,
    by: authorName,
    snippet: body.trim().slice(0, 140),
  };
  const notified = new Set<string>([user.id]); // never notify the author

  for (const u of mentions.users) {
    if (notified.has(u.id)) continue;
    notified.add(u.id);
    void notify(u.id, "mention", basePayload);
  }
  for (const t of mentions.teams) {
    const role = TEAM_ROLE[t.name.toLowerCase()];
    if (!role) continue;
    const members = ((profiles ?? []) as ProfileRow[]).filter((p) => p.role === role);
    for (const m of members) {
      if (notified.has(m.id)) continue;
      notified.add(m.id);
      void notify(m.id, "mention", { ...basePayload, team: t.name });
    }
  }

  // Entity owner always hears about new comments.
  let ownerId: string | null = null;
  if (entity_type === "artifact") {
    const { data: art } = await sb.from("artifacts").select("created_by, title").eq("id", entity_id).single();
    ownerId = (art?.created_by as string | null) ?? null;
    if (ownerId && !notified.has(ownerId)) {
      notified.add(ownerId);
      void notify(ownerId, "comment", { ...basePayload, entity_title: art?.title });
    }
  } else {
    const { data: reqRow } = await sb.from("requests").select("requester_id, title").eq("id", entity_id).single();
    ownerId = (reqRow?.requester_id as string | null) ?? null;
    if (ownerId && !notified.has(ownerId)) {
      notified.add(ownerId);
      void notify(ownerId, "comment", { ...basePayload, entity_title: reqRow?.title });
    }
  }

  void logActivity(entity_type, entity_id, user.id, "commented", {
    comment_id: comment.id,
    snippet: body.trim().slice(0, 140),
    mentioned_users: mentions.users.map((u) => u.full_name ?? u.email),
    mentioned_teams: mentions.teams.map((t) => t.name),
  });

  res.status(201).json({ comment });
});

// POST /:id/resolve — anyone can resolve; we record who did.
commentsRouter.post("/:id/resolve", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { data, error } = await sb
    .from("comments")
    .update({ resolved: true, resolved_by: req.user!.id })
    .eq("id", req.params.id)
    .select("id, entity_type, entity_id")
    .single();
  if (error || !data) return res.status(404).json({ error: "Comment not found" });
  void logActivity(data.entity_type, data.entity_id, req.user!.id, "comment_resolved", { comment_id: data.id });
  res.json({ ok: true });
});

// POST /:id/unresolve
commentsRouter.post("/:id/unresolve", requireAuth, async (req, res) => {
  const sb = supabase();
  if (!sb) return res.status(503).json({ error: "Database not configured" });
  const { data, error } = await sb
    .from("comments")
    .update({ resolved: false, resolved_by: null })
    .eq("id", req.params.id)
    .select("id, entity_type, entity_id")
    .single();
  if (error || !data) return res.status(404).json({ error: "Comment not found" });
  void logActivity(data.entity_type, data.entity_id, req.user!.id, "comment_unresolved", { comment_id: data.id });
  res.json({ ok: true });
});
