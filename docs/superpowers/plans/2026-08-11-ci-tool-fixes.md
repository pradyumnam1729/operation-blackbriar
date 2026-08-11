# CI Tool Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Competitive Intel tool's news feed, CI report generation, and market-threat drafting in line with the approved spec (`docs/superpowers/specs/2026-08-11-ci-tool-fixes-design.md`): categorized/prioritized news dashboard, site-change detection, priority URLs on report generation, per-product competitor filtering, and automatic-but-PMM-gated market threat drafting.

**Architecture:** Backend changes live in `app/backend/src/services/competitive.ts` and `app/backend/src/services/competitiveNews.ts` (extending the existing scrape/scan/draft-approve patterns), plus one new migration. Frontend changes are scoped to the News tab and CI Reports tab of `app/frontend/src/pages/CompetitiveIntel.tsx` — no new pages, no shell/nav changes.

**Tech Stack:** Express + TypeScript (backend), React + Vite + TypeScript (frontend), Supabase/Postgres, `node:test` for backend unit tests (existing `*.pure.test.ts` convention — pure functions only, no live DB/network in tests).

## Global Constraints

- Draft → approval → final for anything PMM-gated; PMM = `role === "admin"` (`app/backend/src/middleware/auth.ts`).
- Competitor facts only from scraped sources; Aurigo facts only from the knowledge base — never invented (existing rule in `competitive.ts`, unchanged).
- No real email sending in this pass — the inbox-subscribe box is UI + a stub save-only endpoint.
- No change to the news-items approval gate — stays auto-visible + dismiss-after-the-fact.
- No change to the overall CompetitiveIntel page shell, tabs, or navigation — News tab and CI Reports tab content only.
- Follow the existing `*.pure.test.ts` convention: test pure functions with `node:test` + `node:assert/strict`; don't attempt to mock Supabase or the Claude API in tests — those paths get manual/dev-server verification.

---

### Task 1: Migration — news categorization/priority columns + subscriptions table

**Files:**
- Create: `supabase/migrations/0020_ci_news_priority.sql`

**Interfaces:**
- Produces: `news_items.category` (text, nullable), `news_items.priority` (text, default `'normal'`), `news_subscriptions` table — consumed by Tasks 2–8.

- [ ] **Step 1: Write the migration**

```sql
-- News categorization + priority for the redesigned news dashboard, and a
-- stub subscriptions table for the "daily intel to your inbox" UI (no email
-- sending yet — see design spec 2026-08-11).

alter table news_items add column if not exists category text;
alter table news_items add column if not exists priority text not null default 'normal' check (priority in ('high', 'normal'));

create table if not exists news_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  aurigo_product text,
  created_at timestamptz not null default now(),
  unique (email, aurigo_product)
);

alter table news_subscriptions enable row level security;
```

- [ ] **Step 2: Apply it**

Run: `cd app/backend && npm run migrate`
Expected: console prints `applying 0020_ci_news_priority.sql` followed by `done`, with no errors. (Requires `DATABASE_URL` in `app/backend/.env` — if it's not set in this environment, skip execution and note it in the handoff; the file itself is the deliverable.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0020_ci_news_priority.sql
git commit -m "app(competitive): add news category/priority columns + subscriptions table"
```

---

### Task 2: News scan — model-assigned category + priority

**Files:**
- Modify: `app/backend/src/services/competitiveNews.ts`
- Test: `app/backend/tests/newsCategorization.pure.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: exported `NEWS_CATEGORIES: readonly string[]`, exported `parseNewsCandidates(raw: string): NewsCandidate[]` where `NewsCandidate` now has `category: string | null` and `priority: "high" | "normal"` — consumed by `scanCompetitorNews` in this same file (Task 4 reuses `NEWS_CATEGORIES`).

- [ ] **Step 1: Write the failing test**

```typescript
// app/backend/tests/newsCategorization.pure.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseNewsCandidates, NEWS_CATEGORIES } from "../src/services/competitiveNews";

test("parseNewsCandidates extracts category and priority per candidate", () => {
  const raw = JSON.stringify([
    { headline: "Kahua raises Series C", summary: "Funding round.", source_url: "https://x.com/a", category: "Acquisition", priority: "high" },
    { headline: "Kahua webinar next week", summary: "Product demo.", source_url: null, category: "Webinar & Event", priority: "normal" },
  ]);
  const candidates = parseNewsCandidates(raw);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].category, "Acquisition");
  assert.equal(candidates[0].priority, "high");
  assert.equal(candidates[1].category, "Webinar & Event");
  assert.equal(candidates[1].priority, "normal");
});

test("parseNewsCandidates defaults an unrecognized category to null and priority to normal", () => {
  const raw = JSON.stringify([
    { headline: "Something happened", summary: "Vague.", source_url: null, category: "Not A Real Category", priority: "extreme" },
  ]);
  const candidates = parseNewsCandidates(raw);
  assert.equal(candidates[0].category, null);
  assert.equal(candidates[0].priority, "normal");
});

test("NEWS_CATEGORIES matches the fixed taxonomy from the design spec", () => {
  assert.deepEqual(NEWS_CATEGORIES, [
    "News",
    "Press Release",
    "Acquisition",
    "AI Direction",
    "Bidding & RFP",
    "Webinar & Event",
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npx tsx --test tests/newsCategorization.pure.test.ts`
Expected: FAIL — `parseNewsCandidates` and `NEWS_CATEGORIES` are not exported yet, and the current `NewsCandidate` shape has no `category`/`priority`.

- [ ] **Step 3: Implement**

Replace the top of `app/backend/src/services/competitiveNews.ts` (the `NewsCandidate` interface and `parseNewsCandidates`/`scanCompetitorNews` functions) with:

```typescript
export const NEWS_CATEGORIES = [
  "News",
  "Press Release",
  "Acquisition",
  "AI Direction",
  "Bidding & RFP",
  "Webinar & Event",
] as const;

interface NewsCandidate {
  headline: string;
  summary: string;
  source_url: string | null;
  category: string | null;
  priority: "high" | "normal";
}

export function parseNewsCandidates(raw: string): NewsCandidate[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((p) => p as Record<string, unknown>)
    .filter((p) => typeof p.headline === "string" && typeof p.summary === "string")
    .slice(0, 3)
    .map((p) => ({
      headline: p.headline as string,
      summary: p.summary as string,
      source_url: typeof p.source_url === "string" ? p.source_url : null,
      category: NEWS_CATEGORIES.includes(p.category as (typeof NEWS_CATEGORIES)[number]) ? (p.category as string) : null,
      priority: p.priority === "high" ? "high" : "normal",
    }));
}
```

Then update the prompt and insert call inside `scanCompetitorNews` (same file):

```typescript
  const hitsBlock = hits.map((h) => `${h.title} — ${h.url}\n${h.description}`).join("\n\n");
  const prompt = [
    `Here are recent search results about "${competitor.name}", a competitor in the construction / capital program management software market.`,
    "Identify up to 3 items that are genuinely newsworthy for a competitive-intel feed (product launches, funding, leadership changes, partnerships, notable losses/wins) — skip generic listicles, old content, or unrelated results.",
    `For each item, classify "category" as exactly one of: ${NEWS_CATEGORIES.join(", ")}.`,
    'Set "priority" to "high" only if this materially affects Aurigo\'s competitive position (e.g. a direct feature launch that overlaps Aurigo, a major funding round, an acquisition); otherwise "normal".',
    "Respond with ONLY a JSON array, no prose before or after:",
    '[{"headline": string, "summary": string (1-2 sentences), "source_url": string, "category": string, "priority": "high" | "normal"}]',
    "If nothing is genuinely newsworthy, respond with an empty array: []",
    "",
    hitsBlock,
  ].join("\n\n");

  const raw = await ask(prompt, { maxTokens: 1200 });
  const candidates = parseNewsCandidates(raw);
  for (const c of candidates) {
    // No approval gate — scanned items are visible to everyone automatically;
    // "dismissed" is the only moderation state admins can still set.
    await sb.from("news_items").insert({
      competitor_id: competitor.id,
      headline: c.headline,
      summary_html: markdownToHtml(c.summary),
      source_url: c.source_url,
      category: c.category,
      priority: c.priority,
      status: "approved",
    });
  }
  return candidates.length;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && npx tsx --test tests/newsCategorization.pure.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/services/competitiveNews.ts app/backend/tests/newsCategorization.pure.test.ts
git commit -m "app(competitive): classify daily news scans by category and priority"
```

---

### Task 3: News feed — view/priority filters

**Files:**
- Modify: `app/backend/src/services/competitiveNews.ts`
- Modify: `app/backend/src/routes/competitive.ts:406-413` (the `GET /news` handler)
- Test: `app/backend/tests/newsFiltering.pure.test.ts`

**Interfaces:**
- Consumes: `NewsItemRow` (existing interface in `competitiveNews.ts`, now includes `category: string | null`, `priority: "high" | "normal"`).
- Produces: exported `filterNewsItems(items: NewsItemRow[], view: "latest" | "past" | "site_changes", priority: "all" | "high", now: Date): NewsItemRow[]` (pure, testable) and `listNewsItems(view?, priority?)` updated to use it — consumed by Task 8 (frontend fetch).

- [ ] **Step 1: Write the failing test**

```typescript
// app/backend/tests/newsFiltering.pure.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { filterNewsItems, NewsItemRow } from "../src/services/competitiveNews";

const NOW = new Date("2026-08-11T00:00:00Z");

function item(overrides: Partial<NewsItemRow>): NewsItemRow {
  return {
    id: "id",
    competitor_id: null,
    headline: "h",
    summary_html: "<p>s</p>",
    source_url: null,
    discovered_at: NOW.toISOString(),
    status: "approved",
    approved_by: null,
    approved_at: null,
    created_at: NOW.toISOString(),
    category: "News",
    priority: "normal",
    ...overrides,
  };
}

test("latest view excludes items older than 14 days and excludes Site Change", () => {
  const recent = item({ id: "recent", discovered_at: "2026-08-05T00:00:00Z" });
  const old = item({ id: "old", discovered_at: "2026-07-01T00:00:00Z" });
  const siteChange = item({ id: "sc", category: "Site Change", discovered_at: "2026-08-05T00:00:00Z" });
  const result = filterNewsItems([recent, old, siteChange], "latest", "all", NOW);
  assert.deepEqual(result.map((r) => r.id), ["recent"]);
});

test("past view includes only items older than 14 days, excluding Site Change", () => {
  const recent = item({ id: "recent", discovered_at: "2026-08-05T00:00:00Z" });
  const old = item({ id: "old", discovered_at: "2026-07-01T00:00:00Z" });
  const result = filterNewsItems([recent, old], "past", "all", NOW);
  assert.deepEqual(result.map((r) => r.id), ["old"]);
});

test("site_changes view includes only Site Change items regardless of age", () => {
  const sc = item({ id: "sc", category: "Site Change", discovered_at: "2026-01-01T00:00:00Z" });
  const news = item({ id: "n", category: "News", discovered_at: "2026-08-05T00:00:00Z" });
  const result = filterNewsItems([sc, news], "site_changes", "all", NOW);
  assert.deepEqual(result.map((r) => r.id), ["sc"]);
});

test("priority=high narrows any view to high-priority items only", () => {
  const high = item({ id: "high", priority: "high", discovered_at: "2026-08-05T00:00:00Z" });
  const normal = item({ id: "normal", priority: "normal", discovered_at: "2026-08-05T00:00:00Z" });
  const result = filterNewsItems([high, normal], "latest", "high", NOW);
  assert.deepEqual(result.map((r) => r.id), ["high"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npx tsx --test tests/newsFiltering.pure.test.ts`
Expected: FAIL — `filterNewsItems` is not exported yet, and `NewsItemRow` has no `category`/`priority`.

- [ ] **Step 3: Implement**

Update the `NewsItemRow` interface and add `filterNewsItems`, then rewrite `listNewsItems` in `app/backend/src/services/competitiveNews.ts`:

```typescript
export interface NewsItemRow {
  id: string;
  competitor_id: string | null;
  headline: string;
  summary_html: string;
  source_url: string | null;
  discovered_at: string;
  status: "pending" | "approved" | "dismissed";
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  category: string | null;
  priority: "high" | "normal";
}

const LATEST_WINDOW_DAYS = 14;

/** Pure filter — no DB access, so it's directly unit-testable. */
export function filterNewsItems(
  items: NewsItemRow[],
  view: "latest" | "past" | "site_changes",
  priority: "all" | "high",
  now: Date
): NewsItemRow[] {
  const cutoff = now.getTime() - LATEST_WINDOW_DAYS * 24 * 3600 * 1000;
  let result = items;
  if (view === "site_changes") {
    result = result.filter((i) => i.category === "Site Change");
  } else {
    result = result.filter((i) => i.category !== "Site Change");
    result = result.filter((i) =>
      view === "latest" ? new Date(i.discovered_at).getTime() >= cutoff : new Date(i.discovered_at).getTime() < cutoff
    );
  }
  if (priority === "high") result = result.filter((i) => i.priority === "high");
  return result;
}

/** Everyone sees every non-dismissed item — no approval gate. */
export async function listNewsItems(
  view: "latest" | "past" | "site_changes" = "latest",
  priority: "all" | "high" = "all"
): Promise<NewsItemRow[]> {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("news_items")
    .select("*")
    .neq("status", "dismissed")
    .order("discovered_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return filterNewsItems((data ?? []) as NewsItemRow[], view, priority, new Date()).slice(0, 50);
}
```

Update `app/backend/src/routes/competitive.ts:406-413`:

```typescript
// GET /api/competitive/news — everyone sees every non-dismissed item.
competitiveRouter.get("/news", requireAuth, async (req, res) => {
  const view = req.query.view === "past" || req.query.view === "site_changes" ? req.query.view : "latest";
  const priority = req.query.priority === "high" ? "high" : "all";
  try {
    const items = await listNewsItems(view, priority);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && npx tsx --test tests/newsFiltering.pure.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/services/competitiveNews.ts app/backend/src/routes/competitive.ts app/backend/tests/newsFiltering.pure.test.ts
git commit -m "app(competitive): add latest/past/site-changes and priority filters to the news feed"
```

---

### Task 4: Site-change detection

**Files:**
- Modify: `app/backend/src/services/competitive.ts` (the `ensureSources` function, ~line 108-166)
- Test: `app/backend/tests/siteChangeDetection.pure.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: exported `shouldFlagSiteChange(wasOk: boolean, previousHash: string | null, newHash: string): boolean` — consumed inline by `ensureSources` in this task; no other task depends on it.

- [ ] **Step 1: Write the failing test**

```typescript
// app/backend/tests/siteChangeDetection.pure.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { shouldFlagSiteChange } from "../src/services/competitive";

test("flags a change when a previously-ok source's hash differs", () => {
  assert.equal(shouldFlagSiteChange(true, "abc", "def"), true);
});

test("does not flag when the hash is unchanged", () => {
  assert.equal(shouldFlagSiteChange(true, "abc", "abc"), false);
});

test("does not flag a source's first-ever successful scrape", () => {
  assert.equal(shouldFlagSiteChange(false, null, "abc"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npx tsx --test tests/siteChangeDetection.pure.test.ts`
Expected: FAIL — `shouldFlagSiteChange` is not exported.

- [ ] **Step 3: Implement**

Add the exported helper near the top of `app/backend/src/services/competitive.ts` (after `normalizeUrl`):

```typescript
/** True only when a source that was already scraped successfully once now hashes differently. */
export function shouldFlagSiteChange(wasOk: boolean, previousHash: string | null, newHash: string): boolean {
  return wasOk && previousHash !== null && previousHash !== newHash;
}
```

Update the scrape loop inside `ensureSources` (currently at `app/backend/src/services/competitive.ts:132-164`) to capture the previous hash before overwriting, and fire a site-change news item after a successful re-scrape. The `competitor_sources` select at the top of `ensureSources` needs `content_hash` added to its column list; then:

```typescript
  let { data: sources } = await sb
    .from("competitor_sources")
    .select("id, url, label, content_md, content_hash, status, scraped_at")
    .eq("competitor_id", competitor.id);

  // ... (unchanged discovery block above stays the same, just extend its
  // own re-select to also include content_hash) ...

  const staleCutoff = Date.now() - STALE_DAYS * 24 * 3600 * 1000;
  for (const s of sources ?? []) {
    const needsScrape =
      s.status !== "ok" ||
      !s.content_md ||
      !s.scraped_at ||
      new Date(s.scraped_at).getTime() < staleCutoff;
    if (!needsScrape) continue;
    const wasOk = s.status === "ok";
    const previousHash = (s as { content_hash?: string | null }).content_hash ?? null;
    try {
      const page = await readUrl(s.url);
      const hash = crypto.createHash("sha256").update(page.content).digest("hex");
      await sb
        .from("competitor_sources")
        .update({
          content_md: page.content,
          content_hash: hash,
          label: page.title.slice(0, 200),
          status: "ok",
          error: null,
          scraped_at: new Date().toISOString(),
        })
        .eq("id", s.id);
      s.content_md = page.content;
      s.status = "ok";
      s.label = page.title;
      s.scraped_at = new Date().toISOString();
      if (shouldFlagSiteChange(wasOk, previousHash, hash)) {
        void flagSiteChange(competitor, s.url, s.label ?? s.url).catch((err) =>
          console.error(`site-change summary failed for ${s.url}:`, (err as Error).message)
        );
      }
    } catch (err) {
      const msg = (err as Error).message;
      await sb.from("competitor_sources").update({ status: "failed", error: msg }).eq("id", s.id);
      s.status = "failed";
      console.error(`scrape failed for ${s.url}: ${msg}`);
    }
  }
  return (sources ?? []).filter((s) => s.status === "ok" && s.content_md);
}

/** A source's content changed since the last scrape — log it as a Site Change news item. */
async function flagSiteChange(competitor: CompetitorRow, url: string, label: string): Promise<void> {
  const sb = supabase()!;
  const summary = await ask(
    `The page "${label}" (${url}) for competitor "${competitor.name}" changed since it was last scraped. In one sentence, note that a change was detected and that a PMM should review the page directly (you don't have the old vs new diff, just note the change was detected).`,
    { maxTokens: 200 }
  );
  await sb.from("news_items").insert({
    competitor_id: competitor.id,
    headline: `${competitor.name}: site change detected on ${label}`,
    summary_html: markdownToHtml(summary),
    source_url: url,
    category: "Site Change",
    priority: "normal",
    status: "approved",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && npx tsx --test tests/siteChangeDetection.pure.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Type-check and commit**

Run: `cd app/backend && npx tsc --noEmit`
Expected: no errors.

```bash
git add app/backend/src/services/competitive.ts app/backend/tests/siteChangeDetection.pure.test.ts
git commit -m "app(competitive): detect and surface competitor site changes as news items"
```

---

### Task 5: Automatic market-threat drafting

**Files:**
- Modify: `app/backend/src/services/competitiveNews.ts`
- Modify: `app/backend/src/index.ts:36,83`

**Interfaces:**
- Consumes: `draftMarketThreat(name, product, url, userId)` (existing, `app/backend/src/services/competitive.ts:736`).
- Produces: exported `startMarketThreatPolling(): void` — called once from `index.ts`, no other task depends on it.

- [ ] **Step 1: Implement**

Add to `app/backend/src/services/competitiveNews.ts` (after `startCompetitiveNewsPolling`). Note: `draftMarketThreat`'s `created_by` column is typed `uuid references profiles(id)`, so the auto-draft tick looks up any admin's id once per tick and attributes the draft to them (rather than passing a literal non-uuid string, which would fail the foreign key):

```typescript
import { draftMarketThreat } from "./competitive";

let threatPollTimer: ReturnType<typeof setInterval> | null = null;

/** Once a day, draft a threat assessment for every tracked competitor. Lands
 * as status "draft" — PMM must still approve before anyone else sees it. */
export function startMarketThreatPolling(): void {
  if (threatPollTimer) return;
  const tick = async () => {
    try {
      const sb = supabase();
      if (!sb) return;
      const { data: admin } = await sb.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
      if (!admin) {
        console.error("[market-threats] no admin profile found — skipping auto-draft tick");
        return;
      }
      const { data: competitors } = await sb
        .from("competitors")
        .select("id, name, aliases, website, category, aurigo_product");
      for (const c of (competitors ?? []) as CompetitorRow[]) {
        try {
          await draftMarketThreat(c.name, c.aurigo_product, null, admin.id);
          console.log(`[market-threats] drafted assessment for ${c.name}`);
        } catch (err) {
          console.error(`[market-threats] draft failed for ${c.name}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      console.error("[market-threats] poll error:", (err as Error).message);
    }
  };
  threatPollTimer = setInterval(() => void tick(), ONE_DAY_MS);
  void tick();
  console.log("[market-threats] daily auto-draft scheduler armed (24h interval)");
}
```

Update `app/backend/src/index.ts`:

```typescript
import { startCompetitiveNewsPolling, startMarketThreatPolling } from "./services/competitiveNews";
```

and where `startCompetitiveNewsPolling();` is called (line 83):

```typescript
  startCompetitiveNewsPolling();
  startMarketThreatPolling();
```

- [ ] **Step 2: Type-check**

Run: `cd app/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `cd app/backend && npm run dev`
Expected console output includes both `[competitive-news] daily polling scheduler armed...` and `[market-threats] daily auto-draft scheduler armed (24h interval)` on boot, with no crash. (The first tick fires immediately — watch for `[market-threats] drafted assessment for <name>` lines, or the "no admin profile found" message if no admin exists in this environment's `profiles` table.)

- [ ] **Step 4: Commit**

```bash
git add app/backend/src/services/competitiveNews.ts app/backend/src/index.ts
git commit -m "app(competitive): auto-draft market threats daily, still gated on PMM approval"
```

---

### Task 6: Priority URLs on CI report generation

**Files:**
- Modify: `app/backend/src/services/competitive.ts` (`generateCiReport`, ~line 599-667)
- Modify: `app/backend/src/routes/competitive.ts:318-340` (`POST /ci-reports`)
- Test: `app/backend/tests/priorityUrls.pure.test.ts`

**Interfaces:**
- Consumes: `readUrl(url: string): Promise<JinaPage>` (existing, `app/backend/src/services/jina.ts:23`).
- Produces: exported `excludeKnownUrls(priorityUrls: string[], existingUrls: string[]): string[]` (pure, testable); `generateCiReport` gains a 5th parameter `priorityUrls: string[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/backend/tests/priorityUrls.pure.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { excludeKnownUrls } from "../src/services/competitive";

test("drops priority URLs already covered by existing sources", () => {
  const result = excludeKnownUrls(
    ["https://x.com/a", "https://x.com/b/", "https://x.com/c"],
    ["https://x.com/a", "https://x.com/c"]
  );
  assert.deepEqual(result, ["https://x.com/b"]);
});

test("dedupes the priority list itself and trims whitespace", () => {
  const result = excludeKnownUrls(["  https://x.com/a  ", "https://x.com/a/"], []);
  assert.deepEqual(result, ["https://x.com/a"]);
});

test("returns an empty list when given no priority URLs", () => {
  assert.deepEqual(excludeKnownUrls([], ["https://x.com/a"]), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npx tsx --test tests/priorityUrls.pure.test.ts`
Expected: FAIL — `excludeKnownUrls` is not exported.

- [ ] **Step 3: Implement**

Add near `normalizeUrl` in `app/backend/src/services/competitive.ts` (that function is already there but unexported — export it too, since `excludeKnownUrls` needs it):

```typescript
/** Normalize so https://x.com and https://x.com/ don't become two sources. */
export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Priority URLs not already covered by the competitor's saved sources, deduped. */
export function excludeKnownUrls(priorityUrls: string[], existingUrls: string[]): string[] {
  const known = new Set(existingUrls.map(normalizeUrl));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of priorityUrls) {
    const url = normalizeUrl(raw);
    if (url === "" || known.has(url) || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}
```

Update `generateCiReport` (currently `app/backend/src/services/competitive.ts:599-667`) to accept and use `priorityUrls`:

```typescript
export async function generateCiReport(
  competitorId: string,
  productOverride: string | null,
  extraBrief: string | null,
  priorityUrls: string[],
  userId: string
): Promise<CiReportRow> {
  const sb = supabase()!;
  const { data: competitor } = await sb
    .from("competitors")
    .select("id, name, aliases, website, category, aurigo_product")
    .eq("id", competitorId)
    .single();
  if (!competitor) throw new CompetitiveIntelError("Competitor not found", 404);

  const sources = await ensureSources(competitor as CompetitorRow);
  if (sources.length === 0 && priorityUrls.length === 0) {
    throw new CompetitiveIntelError(
      `No scrapeable sources for ${competitor.name} yet. Add a source URL and retry.`,
      422
    );
  }
  const extraUrls = excludeKnownUrls(priorityUrls, sources.map((s) => s.url));
  const priorityBlocks: string[] = [];
  for (const url of extraUrls) {
    try {
      const page = await readUrl(url);
      priorityBlocks.push(`<priority_source url="${url}" title="${page.title}">\n${page.content.slice(0, 40_000)}\n</priority_source>`);
    } catch (err) {
      console.error(`priority URL scrape failed for ${url}:`, (err as Error).message);
    }
  }

  const productHint = productOverride ?? (competitor as CompetitorRow).aurigo_product;
  const chunks = await retrieveChunks(`${competitor.name} ${productHint ?? ""} competitive positioning`, 10);

  const competitorContext = sources
    .map(
      (s) =>
        `<competitor_source url="${s.url}" title="${s.label ?? ""}">\n${(s.content_md ?? "").slice(0, 40_000)}\n</competitor_source>`
    )
    .join("\n\n");

  const prompt = [
    PRODUCT_MAP,
    EVIDENCE_RULES,
    `Write a CI (competitive intelligence) report on ${competitor.name}${productHint ? ` for Aurigo ${productHint}` : ""}.`,
    "Structure it with these markdown headings: ## Executive summary, ## Recent moves, ## Pricing & packaging signals, ## Aurigo counter-positioning.",
    extraBrief ? `Additional brief: ${extraBrief}` : "",
    priorityBlocks.length > 0
      ? `The sources below marked <priority_source> were specifically flagged by the PMM as must-consider for this report — give them real weight in your analysis, don't just mention they exist.`
      : "",
    "=== SCRAPED COMPETITOR SOURCES ===",
    competitorContext,
    priorityBlocks.length > 0 ? `=== PMM-FLAGGED PRIORITY SOURCES ===\n${priorityBlocks.join("\n\n")}` : "",
    chunks.length > 0 ? `=== AURIGO KNOWLEDGE BASE (ground truth) ===\n${chunksToContext(chunks)}` : "",
  ]
    .filter((s) => s !== "")
    .join("\n\n");

  const md = await ask(prompt, { maxTokens: 6000 });
  const allSourceUrls = [...sources.map((s) => ({ url: s.url, label: s.label })), ...extraUrls.map((url) => ({ url, label: url }))];
  const sourcesHtml = `<h2>Sources scraped</h2><ul>${allSourceUrls
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label ?? s.url}</a></li>`)
    .join("")}</ul>`;
  const contentHtml = markdownToHtml(md) + sourcesHtml;
  const title = `${competitor.name}${productHint ? ` vs Aurigo ${productHint}` : ""} — CI report`;

  const { data: row, error } = await sb
    .from("ci_reports")
    .insert({
      competitor_id: competitor.id,
      aurigo_product: productHint,
      title,
      content_html: contentHtml,
      status: "draft",
      created_by: userId,
    })
    .select("*")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Could not store the CI report");
  void logActivity("ci_report", row.id, userId, "generated", { competitor: competitor.name, priorityUrlCount: extraUrls.length });
  return row as CiReportRow;
}
```

Update the route in `app/backend/src/routes/competitive.ts:318-340`:

```typescript
// POST /api/competitive/ci-reports — generate a draft (admin-only).
competitiveRouter.post("/ci-reports", requireAuth, requireAdmin, async (req, res) => {
  const { competitorId, product, extraBrief, priorityUrls } = req.body as {
    competitorId?: string;
    product?: string;
    extraBrief?: string;
    priorityUrls?: string[];
  };
  if (!competitorId) return res.status(400).json({ error: "competitorId is required" });
  if (!jinaConfigured()) {
    return res.status(503).json({ error: "JINA_API_KEY is not configured in app/backend/.env" });
  }
  try {
    const report = await generateCiReport(
      competitorId,
      product && ["Primus", "Masterworks"].includes(product) ? product : null,
      extraBrief?.trim() || null,
      Array.isArray(priorityUrls) ? priorityUrls.filter((u) => typeof u === "string" && u.trim() !== "") : [],
      req.user!.id
    );
    res.status(201).json({ report });
  } catch (err) {
    const status = err instanceof CompetitiveIntelError ? err.status : 502;
    res.status(status).json({ error: (err as Error).message });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && npx tsx --test tests/priorityUrls.pure.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Type-check and commit**

Run: `cd app/backend && npx tsc --noEmit`
Expected: no errors — this also confirms every other call site of `generateCiReport` has been updated (there is only the one, in the route just changed).

```bash
git add app/backend/src/services/competitive.ts app/backend/src/routes/competitive.ts app/backend/tests/priorityUrls.pure.test.ts
git commit -m "app(competitive): let PMM flag priority URLs when generating a CI report"
```

---

### Task 7: Subscribe stub endpoint

**Files:**
- Modify: `app/backend/src/routes/competitive.ts` (add after the `/news/:id/dismiss` route, ~line 423)

**Interfaces:**
- Consumes: `news_subscriptions` table (Task 1).
- Produces: `POST /api/competitive/news/subscribe` — consumed by Task 8 (frontend).

- [ ] **Step 1: Implement**

Add to `app/backend/src/routes/competitive.ts` right after the `/news/:id/dismiss` handler:

```typescript
// POST /api/competitive/news/subscribe — save an email preference (no send yet).
competitiveRouter.post("/news/subscribe", requireAuth, async (req, res) => {
  const { email, aurigoProduct } = req.body as { email?: string; aurigoProduct?: string };
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  const sb = supabase()!;
  const { error } = await sb
    .from("news_subscriptions")
    .upsert(
      { email: email.trim(), aurigo_product: aurigoProduct || null },
      { onConflict: "email,aurigo_product" }
    );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
```

- [ ] **Step 2: Type-check**

Run: `cd app/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/backend/src/routes/competitive.ts
git commit -m "app(competitive): add news-digest subscribe endpoint (save-only, no send)"
```

---

### Task 8: Frontend — News tab dashboard redesign

**Files:**
- Modify: `app/frontend/src/pages/CompetitiveIntel.tsx`

**Interfaces:**
- Consumes: `GET /api/competitive/news?view=&priority=` (Task 3), `POST /api/competitive/news/subscribe` (Task 7), existing `NewsItemRow` shape (now with `category`, `priority`), existing `battlecards`/`threats`/`reports` state.
- Produces: nothing consumed elsewhere — this is the leaf UI task.

- [ ] **Step 1: Extend the `NewsItemRow` interface**

In `app/frontend/src/pages/CompetitiveIntel.tsx`, update the interface (currently lines 61-68):

```typescript
interface NewsItemRow {
  id: string;
  headline: string;
  summary_html: string;
  source_url: string | null;
  status: "pending" | "approved" | "dismissed";
  discovered_at: string;
  category: string | null;
  priority: "high" | "normal";
}
```

- [ ] **Step 2: Add filter state and a dedicated news loader**

Add near the other news-related state (currently lines 329-331):

```typescript
  const [news, setNews] = useState<NewsItemRow[]>([]);
  const [newsBusyId, setNewsBusyId] = useState("");
  const [newsError, setNewsError] = useState("");
  const [newsView, setNewsView] = useState<"latest" | "past" | "site_changes">("latest");
  const [newsPriority, setNewsPriority] = useState<"all" | "high">("all");
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeBusy, setSubscribeBusy] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState("");
```

Add a loader effect right after the existing `useEffect(() => { void load(); }, [load]);` (currently around line 407-409):

```typescript
  const loadNews = useCallback(async () => {
    try {
      const nn = await apiGet<{ items: NewsItemRow[] }>(
        `/api/competitive/news?view=${newsView}&priority=${newsPriority}`
      );
      setNews(nn.items);
    } catch (e) {
      setNewsError((e as Error).message);
    }
  }, [newsView, newsPriority]);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);
```

Remove the now-redundant unfiltered fetch inside `load()` (currently `const nn = await apiGet<{ items: NewsItemRow[] }>("/api/competitive/news"); setNews(nn.items);` around line 398-399) — `loadNews` owns this fetch now.

- [ ] **Step 3: Add the subscribe handler**

Add near `dismissNews` (currently starting at line 628):

```typescript
  const subscribe = async () => {
    if (!subscribeEmail.trim()) return;
    setSubscribeBusy(true);
    setSubscribeMsg("");
    try {
      await apiPost("/api/competitive/news/subscribe", { email: subscribeEmail.trim() });
      setSubscribeMsg("Saved — daily digest sending isn't wired up yet, but your preference is recorded.");
    } catch (e) {
      setSubscribeMsg((e as Error).message);
    } finally {
      setSubscribeBusy(false);
    }
  };
```

- [ ] **Step 4: Replace the News tab JSX**

Replace the entire News tab block (currently `app/frontend/src/pages/CompetitiveIntel.tsx:1270-1303`):

```tsx
      {tab === "news" && (
        <>
          {newsError && <div style={errBox}>{newsError}</div>}

          <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(["latest", "past", "site_changes"] as const).map((v) => (
                <button
                  key={v}
                  className={`btn btn-sm ${newsView === v ? "btn-primary" : ""}`}
                  onClick={() => setNewsView(v)}
                >
                  {v === "latest" ? "Latest" : v === "past" ? "Past news" : "Site Changes"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "high"] as const).map((p) => (
                <button
                  key={p}
                  className={`btn btn-sm ${newsPriority === p ? "btn-primary" : ""}`}
                  onClick={() => setNewsPriority(p)}
                >
                  {p === "all" ? "All" : "High priority"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-3" style={{ marginTop: 12 }}>
            <div className="card">
              <div style={{ fontSize: 22, fontWeight: 600 }}>{battlecards.filter((b) => b.status === "final").length}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Battlecards published</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {threats.filter((t) => t.status === "draft").length + reports.filter((r) => r.status === "draft").length}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Pending review</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {
                  news.filter(
                    (n) =>
                      n.category === "Site Change" &&
                      Date.now() - new Date(n.discovered_at).getTime() < 7 * 24 * 3600 * 1000
                  ).length
                }
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Site changes (7d)</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 500, fontSize: 13.5 }}>Daily intel to your inbox</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Save your email — sending isn't wired up yet.</div>
            </div>
            <input
              placeholder="you@aurigo.com"
              value={subscribeEmail}
              onChange={(e) => setSubscribeEmail(e.target.value)}
              style={{ minWidth: 220 }}
            />
            <button className="btn btn-primary btn-sm" disabled={subscribeBusy || !subscribeEmail.trim()} onClick={() => void subscribe()}>
              Subscribe
            </button>
            {subscribeMsg && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{subscribeMsg}</span>}
          </div>

          <div className="grid grid-3" style={{ marginTop: 12 }}>
            {NEWS_CATEGORY_LABELS.map((category) => {
              const items = news.filter((n) => (newsView === "site_changes" ? true : n.category === category));
              if (newsView === "site_changes" && category !== "Site Change") return null;
              return (
                <div key={category} className="card">
                  <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500 }}>
                    {category} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{items.length}</span>
                  </h3>
                  {items.length === 0 && <div className="empty-note">Nothing here yet.</div>}
                  {items.map((n) => (
                    <div key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span
                          title={n.priority === "high" ? "High priority" : "Normal priority"}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: n.priority === "high" ? "#c0392b" : "var(--text-muted)",
                            display: "inline-block",
                          }}
                        />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{n.headline}</span>
                        {isAdmin && (
                          <button
                            className="btn btn-sm"
                            style={{ marginLeft: "auto" }}
                            disabled={newsBusyId === n.id}
                            onClick={() => void dismissNews(n.id)}
                            title="Hide a bad scan"
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        )}
                      </div>
                      <div
                        className="prose"
                        style={{ border: "none", boxShadow: "none", padding: 0, fontSize: 12 }}
                        dangerouslySetInnerHTML={{ __html: n.summary_html }}
                      />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(n.discovered_at).toLocaleDateString()}</span>
                      {n.source_url && (
                        <a href={n.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, marginLeft: 8 }}>
                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 9, marginRight: 3 }} />
                          source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
```

Add the category label list as a module-level constant near `SUGGESTIONS` (currently line 82):

```typescript
const NEWS_CATEGORY_LABELS = ["News", "Press Release", "Acquisition", "AI Direction", "Bidding & RFP", "Webinar & Event", "Site Change"];
```

- [ ] **Step 5: Type-check**

Run: `cd app/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run: `cd app/frontend && npm run dev` (with backend running via `cd app/backend && npm run dev`)
Then in the browser: open Competitive Intel → Daily news tab. Confirm: the Latest/Past news/Site Changes pills and All/High priority pills render and change which items show; the three summary tiles show numbers (0 is fine if there's no seeded data); the subscribe box saves and shows the confirmation message; category cards render even when empty ("Nothing here yet.").

- [ ] **Step 7: Commit**

```bash
git add app/frontend/src/pages/CompetitiveIntel.tsx
git commit -m "app(competitive): redesign the news tab into a categorized, filterable dashboard"
```

---

### Task 9: Frontend — CI Reports tab: product-first competitor filter + priority URLs

**Files:**
- Modify: `app/frontend/src/pages/CompetitiveIntel.tsx`

**Interfaces:**
- Consumes: `POST /api/competitive/ci-reports` with new `priorityUrls: string[]` field (Task 6); existing `competitors` state (`Competitor[]`, has `aurigo_product`).
- Produces: nothing consumed elsewhere — leaf UI task.

- [ ] **Step 1: Add priority-URLs state**

Near `reportBrief`/`reportBusy` state (search for `reportBrief` in the file — it's declared alongside the other report-tab state), add:

```typescript
  const [reportPriorityUrls, setReportPriorityUrls] = useState("");
```

- [ ] **Step 2: Wire it into `generateReport`**

Update `generateReport` (currently `app/frontend/src/pages/CompetitiveIntel.tsx:569-586`):

```typescript
  const generateReport = async () => {
    if (!reportCompetitorId) return;
    setReportBusy(true);
    setReportError("");
    try {
      await apiPost("/api/competitive/ci-reports", {
        competitorId: reportCompetitorId,
        product: reportProduct || undefined,
        extraBrief: reportBrief.trim() || undefined,
        priorityUrls: reportPriorityUrls
          .split("\n")
          .map((u) => u.trim())
          .filter((u) => u !== ""),
      });
      setReportBrief("");
      setReportPriorityUrls("");
      await load();
    } catch (e) {
      setReportError((e as Error).message);
    } finally {
      setReportBusy(false);
    }
  };
```

- [ ] **Step 3: Reorder the generation form to product-first with filtering**

Replace the generation form block (currently `app/frontend/src/pages/CompetitiveIntel.tsx:1170-1222`):

```tsx
          {isAdmin && (
            <div className="card">
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 500 }}>Generate a CI report</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
                <select
                  value={reportProduct}
                  onChange={(e) => {
                    setReportProduct(e.target.value);
                    // Selected competitor may no longer belong to the new product — clear it.
                    const c = competitors.find((x) => x.id === reportCompetitorId);
                    if (c && e.target.value && c.aurigo_product !== e.target.value) setReportCompetitorId("");
                  }}
                >
                  <option value="">Pick Aurigo product…</option>
                  <option value="Primus">Primus</option>
                  <option value="Masterworks">Masterworks</option>
                </select>
                {(() => {
                  const logo = lineLogo(reportProduct);
                  return logo ? <img src={logo} alt="" style={{ height: 22, width: "auto", alignSelf: "center" }} /> : null;
                })()}
                <select
                  value={reportCompetitorId}
                  onChange={(e) => setReportCompetitorId(e.target.value)}
                >
                  <option value="">Pick a competitor…</option>
                  {competitors
                    .filter((c) => !reportProduct || c.aurigo_product === reportProduct)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.aurigo_product ? ` (${c.aurigo_product})` : ""}
                      </option>
                    ))}
                </select>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--text-secondary)" }}>
                Pick the Aurigo product first — the competitor list narrows to that product's tracked competitors.
              </p>
              <input
                placeholder="Extra brief (optional) — angle to emphasize, deal context…"
                value={reportBrief}
                onChange={(e) => setReportBrief(e.target.value)}
              />
              <textarea
                placeholder="Priority URLs (optional) — one per line, e.g. a specific pricing page or press release to weight heavily in this report"
                value={reportPriorityUrls}
                onChange={(e) => setReportPriorityUrls(e.target.value)}
                rows={3}
                style={{ width: "100%", marginTop: 8 }}
              />
              <p style={{ marginTop: 10, marginBottom: 0 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void generateReport()}
                  disabled={reportBusy || !reportCompetitorId || !jinaOk}
                >
                  <i className={`fa-solid ${reportBusy ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`} />{" "}
                  {reportBusy ? "Generating…" : "Generate report"}
                </button>
              </p>
              {reportError && <div style={{ ...errBox, marginTop: 12 }}>{reportError}</div>}
            </div>
          )}
```

- [ ] **Step 4: Type-check**

Run: `cd app/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `cd app/frontend && npm run dev` (with backend running)
In the browser: Competitive Intel → CI reports tab (as an admin/PMM user). Confirm: picking "Masterworks" narrows the competitor dropdown to only Masterworks-mapped competitors (Kahua, e-Builder, Oracle Primavera Unifier per the seed data); picking "Primus" narrows it to Procore/Autodesk ACC/Sitetracker/Planview; typing multiple URLs into the priority-URLs box and generating a report doesn't error. Confirm the generate form and button are entirely absent when logged in as a non-admin role.

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/pages/CompetitiveIntel.tsx
git commit -m "app(competitive): product-first competitor filter and priority URLs on CI report generation"
```

---

## Post-implementation

- [ ] Update `GTM-War-Room/HANDOVER.md` per CLAUDE.md rule 7: what was built (news categorization/priority/site-changes, auto-drafted market threats, priority URLs and per-product filtering on CI report generation), that the migration `0020_ci_news_priority.sql` needs `npm run migrate` run against the real Supabase instance if it wasn't run during implementation, and that real email sending for the digest subscribe box remains a follow-up.
