import fs from "fs";
import os from "os";
import path from "path";
import { supabase } from "./db";
import { extractText } from "./extract";
import { flagEnabled } from "./activity";
import { ingestDocument } from "./ingestion";
import { classifyContent, detectDocType, matchProductByFilename } from "./localFolders";

// Microsoft Graph SharePoint connector (app-only, client-credentials flow).
// Credentials come from the admin UI (stored as the sharepoint_credentials row
// in the integrations table), with MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET
// env vars as a fallback. The app registration needs the Sites.Read.All
// *application* permission, admin-consented. Until credentials exist, every
// call reports "not configured".

const GRAPH = "https://graph.microsoft.com/v1.0";

export interface GraphCreds {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  source: "database" | "env";
}

let cachedCreds: GraphCreds | null = null;

export async function getGraphCreds(): Promise<GraphCreds | null> {
  if (cachedCreds) return cachedCreds;
  const sb = supabase();
  if (sb) {
    // limit(1) instead of maybeSingle(): duplicate rows must degrade to
    // "use the oldest", never to an error that reads as "not configured".
    const { data } = await sb
      .from("integrations")
      .select("config")
      .eq("kind", "sharepoint_credentials")
      .order("created_at", { ascending: true })
      .limit(1);
    const cfg = data?.[0]?.config as
      | { tenantId?: string; clientId?: string; clientSecret?: string }
      | undefined;
    if (cfg?.tenantId && cfg?.clientId && cfg?.clientSecret) {
      cachedCreds = {
        tenantId: cfg.tenantId,
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        source: "database",
      };
      return cachedCreds;
    }
  }
  if (process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET) {
    cachedCreds = {
      tenantId: process.env.MS_TENANT_ID,
      clientId: process.env.MS_CLIENT_ID,
      clientSecret: process.env.MS_CLIENT_SECRET,
      source: "env",
    };
    return cachedCreds;
  }
  return null;
}

export async function graphConfigured(): Promise<boolean> {
  return (await getGraphCreds()) !== null;
}

/** Call after credentials are saved or removed so the next request re-reads them. */
export function invalidateGraphCreds(): void {
  cachedCreds = null;
  cachedToken = null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const creds = await getGraphCreds();
  if (!creds) {
    throw new Error(
      "SharePoint is not configured. Save the tenant ID, client ID, and client secret in the Integrations page (app registration with admin-consented Sites.Read.All application permission)."
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const res = await fetch(
    `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(`Graph token request failed: ${body.error_description ?? res.statusText}`);
  }
  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function graphGet<T>(url: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface SiteRef {
  siteId: string;
  driveId: string;
  webUrl: string;
  /** For sharing links pointing at a folder, the folder path inside the library. */
  suggestedFolderPath?: string;
}

/** Graph Shares API encoding: "u!" + base64url of the sharing URL. */
function encodeShareUrl(url: string): string {
  return (
    "u!" +
    Buffer.from(url)
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\//g, "_")
      .replace(/\+/g, "-")
  );
}

/** Sharing links look like https://tenant.sharepoint.com/:f:/s/Site/Exxxx or /:f:/r/sites/... */
function isSharingLink(u: URL): boolean {
  return /^\/:[a-z]:\//i.test(u.pathname);
}

/**
 * Resolve any pasted SharePoint URL to a document library:
 * - sharing links ("Copy link" URLs with /:f:/ etc.) via the Shares API,
 *   which also yields the exact folder the link points at;
 * - plain site URLs, including ones with extra segments pasted from the
 *   browser (/sites/PMM/Shared Documents/Forms/AllItems.aspx), normalized
 *   down to the /sites/<name> part;
 * - tenant root URLs with no /sites/ path.
 */
export async function resolveSite(siteUrl: string): Promise<SiteRef> {
  const u = new URL(siteUrl);

  if (isSharingLink(u)) {
    const item = await graphGet<{
      webUrl?: string;
      name?: string;
      folder?: unknown;
      parentReference?: { driveId?: string; siteId?: string; path?: string };
    }>(`${GRAPH}/shares/${encodeShareUrl(siteUrl)}/driveItem`);
    const driveId = item.parentReference?.driveId;
    if (!driveId) {
      throw new Error(
        "Could not resolve this sharing link to a document library. Paste the site URL instead (https://tenant.sharepoint.com/sites/YourSite)."
      );
    }
    // parentReference.path looks like "/drives/{id}/root:/Sub/Folder"
    const rel = (item.parentReference?.path ?? "").split("root:")[1] ?? "";
    const folder = item.folder
      ? `${rel}/${item.name ?? ""}`.replace(/^\/+/, "")
      : rel.replace(/^\/+/, "");
    return {
      siteId: item.parentReference?.siteId ?? "",
      driveId,
      webUrl: item.webUrl ?? siteUrl,
      suggestedFolderPath: decodeURIComponent(folder),
    };
  }

  const segments = u.pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) =>
    ["sites", "teams", "personal"].includes(s.toLowerCase())
  );
  const sitePath =
    idx >= 0 && segments[idx + 1] ? `/${segments[idx]}/${segments[idx + 1]}` : "";

  const site = await graphGet<{ id: string; webUrl: string }>(
    sitePath ? `${GRAPH}/sites/${u.hostname}:${sitePath}` : `${GRAPH}/sites/${u.hostname}`
  );
  const drive = await graphGet<{ id: string }>(`${GRAPH}/sites/${site.id}/drive`);
  return { siteId: site.id, driveId: drive.id, webUrl: site.webUrl };
}

export interface DriveItem {
  id: string;
  name: string;
  webUrl?: string;
  folder?: unknown;
  file?: { mimeType: string };
  parentReference?: { path?: string };
  deleted?: unknown;
  lastModifiedDateTime?: string;
}

/** Browse a folder ("" = library root) — used by the admin UI to pick folders. */
export async function listChildren(driveId: string, folderPath: string): Promise<DriveItem[]> {
  const base =
    folderPath && folderPath !== "/"
      ? `${GRAPH}/drives/${driveId}/root:/${encodeURI(folderPath.replace(/^\/+/, ""))}:/children`
      : `${GRAPH}/drives/${driveId}/root/children`;
  const res = await graphGet<{ value: DriveItem[] }>(`${base}?$top=200`);
  return res.value;
}

/** Delta sync: returns changed items since the stored token plus the next token. */
export async function deltaSync(
  driveId: string,
  deltaLink: string | null
): Promise<{ items: DriveItem[]; nextDeltaLink: string }> {
  let url = deltaLink ?? `${GRAPH}/drives/${driveId}/root/delta`;
  const items: DriveItem[] = [];
  for (;;) {
    const page = await graphGet<{
      value: DriveItem[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    }>(url);
    items.push(...page.value);
    if (page["@odata.nextLink"]) url = page["@odata.nextLink"];
    else return { items, nextDeltaLink: page["@odata.deltaLink"] ?? url };
  }
}

async function downloadToTemp(driveId: string, item: DriveItem): Promise<string> {
  const token = await getToken();
  const res = await fetch(`${GRAPH}/drives/${driveId}/items/${item.id}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`download failed ${res.status} for ${item.name}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hive-sp-"));
  const filePath = path.join(dir, item.name);
  fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  return filePath;
}

const SUPPORTED = [".pdf", ".docx", ".txt", ".md", ".vtt", ".srt", ".csv", ".xlsx", ".xls", ".pptx"];

interface SpIntegrationConfig {
  siteUrl: string;
  folderPath: string;
  doc_type: string;
  product_line?: string;
  siteId?: string;
  driveId?: string;
  deltaLink?: string | null;
  lastSync?: string;
  lastResult?: string;
}

/** Ingest one downloaded file through the same pipeline as the local Input
 *  folder: per-file type + product classification, chunked into the knowledge
 *  base (Ask Hive / generation retrieval), then routed to the release-note
 *  review queue or mirrored into context_docs for the questionnaire. */
async function ingestFile(
  localPath: string,
  item: DriveItem,
  cfg: SpIntegrationConfig
): Promise<string> {
  const sb = supabase()!;
  const { status, text } = await extractText(localPath);
  if (status !== "done" || text.trim() === "") return `skipped ${item.name} (${status})`;

  const { data: products } = await sb.from("products").select("id, name, line");
  let docType = detectDocType(item.name);
  let product = matchProductByFilename(item.name, products ?? []);
  if (!docType || !product) {
    const cls = await classifyContent(text, (products ?? []).map((p) => p.name));
    docType = docType ?? cls.docType;
    product = product ?? products?.find((p) => p.name === cls.productName) ?? null;
  }
  docType = docType ?? cfg.doc_type;
  const lineDefault =
    products?.find(
      (p) => cfg.product_line && p.line.toLowerCase() === cfg.product_line!.toLowerCase()
    ) ?? null;

  const ingest = await ingestDocument({
    title: item.name,
    filename: item.name,
    text,
    source: "sharepoint",
    docType,
    productId: product?.id ?? null,
    productName: product?.name ?? null,
    aiEnabled: true,
  });
  if (ingest.deduped) {
    return `duplicate skipped: ${item.name} matches existing document "${ingest.duplicateOf}"`;
  }

  if (docType === "release_note") {
    const releaseProduct = product ?? lineDefault ?? products?.[0];
    if (!releaseProduct) return `no product match for ${item.name}`;
    const { data: rn } = await sb
      .from("release_notes")
      .insert({
        product_id: releaseProduct.id,
        filename: item.name,
        source_path: item.webUrl ?? `sharepoint:${item.id}`,
        raw_text: text,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    await sb.from("feature_reviews").insert({
      release_note_id: rn?.id,
      product_id: releaseProduct.id,
      proposed: {
        note: "Release note synced from SharePoint — run Process to extract features.",
        filename: item.name,
        snippet: text.slice(0, 1500),
      },
      change_type: "added",
      confidence: 0.1,
      status: "pending",
    });
    return `release note ingested: ${item.name} (${ingest.chunkCount} chunks)`;
  }

  await sb.from("context_docs").delete().eq("title", item.name).eq("source", "folder_watch");
  await sb.from("context_docs").insert({
    title: item.name,
    source: "folder_watch",
    doc_type: docType,
    product_id: product?.id ?? null,
    content: text.slice(0, 200_000),
    approved: false,
  });
  return `${docType} ingested: ${item.name} (${ingest.chunkCount} chunks, AI-enabled)`;
}

/** Run a delta sync for one sharepoint_graph integration row. */
export async function syncIntegration(integrationId: string): Promise<string[]> {
  const sb = supabase()!;
  const { data: integ, error } = await sb
    .from("integrations")
    .select("id, name, config, enabled")
    .eq("id", integrationId)
    .eq("kind", "sharepoint_graph")
    .single();
  if (error || !integ) throw new Error("SharePoint connection not found");

  const cfg = integ.config as SpIntegrationConfig;
  const log: string[] = [];

  if (!cfg.driveId) {
    const site = await resolveSite(cfg.siteUrl);
    cfg.siteId = site.siteId;
    cfg.driveId = site.driveId;
    // A sharing link that points at a folder implies the folder scope.
    if (!cfg.folderPath && site.suggestedFolderPath) {
      cfg.folderPath = site.suggestedFolderPath;
      log.push(`folder scope from sharing link: ${cfg.folderPath}`);
    }
    log.push(`resolved site ${site.webUrl}`);
  }

  const { items, nextDeltaLink } = await deltaSync(cfg.driveId!, cfg.deltaLink ?? null);
  const folderNeedle = cfg.folderPath.replace(/^\/+|\/+$/g, "").toLowerCase();
  const relevant = items.filter((it) => {
    if (it.deleted || it.folder || !it.file) return false;
    if (!SUPPORTED.includes(path.extname(it.name).toLowerCase())) return false;
    if (folderNeedle === "") return true;
    const parent = (it.parentReference?.path ?? "").toLowerCase();
    return parent.includes(folderNeedle);
  });

  for (const item of relevant) {
    try {
      const local = await downloadToTemp(cfg.driveId!, item);
      log.push(await ingestFile(local, item, cfg));
      fs.rmSync(path.dirname(local), { recursive: true, force: true });
    } catch (err) {
      log.push(`failed ${item.name}: ${(err as Error).message}`);
    }
  }

  cfg.deltaLink = nextDeltaLink;
  cfg.lastSync = new Date().toISOString();
  cfg.lastResult = `${relevant.length} file(s) processed`;
  await sb.from("integrations").update({ config: cfg }).eq("id", integrationId);
  log.push(`delta sync complete: ${relevant.length} file(s)`);
  return log;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Poll all enabled sharepoint_graph connections every 5 minutes while the flag is on. */
export function startSharePointPolling(): void {
  if (pollTimer) return;
  const tick = async () => {
    try {
      if (!(await graphConfigured()) || !(await flagEnabled("sharepoint_graph"))) return;
      const sb = supabase();
      if (!sb) return;
      const { data } = await sb
        .from("integrations")
        .select("id, name")
        .eq("kind", "sharepoint_graph")
        .eq("enabled", true);
      for (const integ of data ?? []) {
        try {
          const log = await syncIntegration(integ.id);
          console.log(`[sharepoint] ${integ.name}: ${log[log.length - 1]}`);
        } catch (err) {
          console.error(`[sharepoint] ${integ.name} sync failed: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      console.error("[sharepoint] poll error:", (err as Error).message);
    }
  };
  pollTimer = setInterval(() => void tick(), 5 * 60 * 1000);
  void tick();
  console.log("[sharepoint] polling scheduler armed (5 min interval, gated on flag + credentials)");
}
