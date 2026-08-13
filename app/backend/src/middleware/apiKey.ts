import { NextFunction, Request, Response } from "express";
import { supabase } from "../services/db";
import { ApiScope, ResolvedApiKey, logApiRequest, resolveApiKey } from "../services/apiKeys";

// The public API key auth domain (blueprint open-api.md §2.2). This is a SIBLING
// of requireAuth, never a wrapper: requireAuth/requireAdmin (the Supabase-JWT
// domain) never appear in the public router. Two auth domains, zero mixing.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: ResolvedApiKey;
    }
  }
}

/** Extract the presented key from either accepted header (decision §0.1-8):
 *  `Authorization: Bearer <key>` OR `X-API-Key: <key>`. Pure — unit-tested. */
export function extractPresentedKey(headers: {
  authorization?: string;
  "x-api-key"?: string | string[];
}): string | null {
  const header = headers.authorization ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const xkey = typeof headers["x-api-key"] === "string" ? headers["x-api-key"] : null;
  return bearer ?? xkey;
}

/** The 401/403/pass decision for a resolved key + required scope. Pure —
 *  unit-tested. `key === null` (unknown OR revoked) is a single 401 that never
 *  distinguishes which (decision §0.1-8). */
export function evaluateApiKeyAccess(
  key: ResolvedApiKey | null,
  scope: ApiScope
): { status: number; error?: string } {
  if (!key) return { status: 401, error: "Invalid or revoked API key" };
  if (!key.scopes.includes(scope)) {
    return { status: 403, error: `This key does not have the '${scope}' scope` };
  }
  return { status: 200 };
}

/** Factory: authenticates the key AND checks one scope. The ONLY auth used by
 *  public data routes. The presented key string is never logged, never echoed in
 *  any error body, never stored beyond the transient `presented` local. */
export function requireApiKey(scope: ApiScope) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!supabase()) return res.status(503).json({ error: "Service unavailable" });

    // Bearer or X-API-Key (decision §0.1-8).
    const presented = extractPresentedKey(req.headers);
    if (!presented) {
      return res.status(401).json({
        error: "Missing API key. Send it as 'Authorization: Bearer <key>' or 'X-API-Key: <key>'.",
      });
    }

    const key = await resolveApiKey(presented); // hash lookup + enabled check + last_used_at
    const decision = evaluateApiKeyAccess(key, scope);
    if (decision.status !== 200) {
      return res.status(decision.status).json({ error: decision.error });
    }

    const resolved = key!;
    req.apiKey = resolved;
    const started = Date.now();
    res.on("finish", () =>
      // decision §0.1-4 — path is req.originalUrl WITHOUT the query string.
      logApiRequest(
        resolved.id,
        req.method,
        req.originalUrl.split("?")[0],
        res.statusCode,
        Date.now() - started
      )
    );
    next();
  };
}
