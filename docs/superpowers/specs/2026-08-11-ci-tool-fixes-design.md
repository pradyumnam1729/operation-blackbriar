# CI Tool Fixes — Design Spec

Date: 2026-08-11
Status: Approved by user, ready for implementation planning

## Context

The Competitive Intel (CI) tool (`app/backend/src/routes/competitive.ts`, `app/backend/src/services/competitive.ts`, `app/backend/src/services/competitiveNews.ts`, `app/frontend/src/pages/CompetitiveIntel.tsx`) already has: competitor registry, ad-hoc comparisons, positioning map, CI reports (draft→final, PMM-only generate/approve), a daily auto-scanned news feed (auto-approved, no PMM gate), and market threats (manual admin-triggered draft, PMM-only approve).

The user supplied a reference screenshot of a target news-dashboard layout (per-product sidebar, breadcrumb header, "Latest / Past news / Site Changes" + "All / High priority" filters, category card-grid: News, Press Releases, Acquisitions & M&A, AI Direction, Bidding & RFPs, Webinars & Events, summary tiles for Battlecards/Pending Review/Site Changes, and a "Daily intel to your inbox" subscribe box) and asked for five things:

1. Redesign the news feed to match that reference layout.
2. Let PMM add "priority URLs" when generating a CI report.
3. Scope the competitor list shown per Aurigo product (Masterworks-only vs Primus-only) when generating a report.
4. Market threats should be generated automatically, but still require PMM approval before anyone else sees them.
5. Ensure CI report generation is PMM-only.

Scope for this pass, per user decisions during brainstorming:
- Redesign is scoped to the existing **News tab only** — no change to the overall CompetitiveIntel page shell/tabs.
- News items keep their current no-approval-gate model (auto-visible, dismiss-after-the-fact). Only market threats get an auto-scan → draft → PMM-approve flow.
- Priority URLs are **ad-hoc per report generation**, not saved to the competitor's permanent source registry.
- The "Daily intel to your inbox" box is a **UI + stub-endpoint placeholder** — no real email sending in this pass.

## A. Data model

New migration `supabase/migrations/0020_ci_news_priority.sql`:

```sql
alter table news_items add column category text;
alter table news_items add column priority text not null default 'normal' check (priority in ('high', 'normal'));

create table news_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  aurigo_product text,
  created_at timestamptz not null default now(),
  unique (email, aurigo_product)
);
```

Notes:
- `category` values: `News`, `Press Release`, `Acquisition`, `AI Direction`, `Bidding & RFP`, `Webinar & Event`, plus the reserved value `Site Change` (used only for scraper-detected site-diff events, never chosen by the news-scan model).
- No schema change for per-product competitor filtering — `competitors.aurigo_product` already exists and is sufficient.
- No schema change for priority URLs — they're request-scoped only, never persisted.

## B. Backend behavior

1. **News scan categorization** (`app/backend/src/services/competitiveNews.ts`, `scanCompetitorNews`): extend the JSON the model returns per candidate to include `category` (one of the fixed list above) and `priority` (`"high" | "normal"`, based on how material the item is to Aurigo's competitive position). Store both columns on insert. No change to the auto-approve behavior.

2. **Site-change detection** (`app/backend/src/services/competitive.ts`, `ensureSources`): when a source that was previously `status: "ok"` gets re-scraped and its newly computed `content_hash` differs from the stored hash, insert a `news_items` row: `category: "Site Change"`, `status: "approved"`, `priority` derived the same way (or default `"normal"` — no need for a model call to decide priority here), `headline`/`summary_html` generated from a short model call diffing old vs new `content_md`. Only fires when there was a *previous* successful scrape (skip on first-ever scrape of a source).

3. **Market threat auto-scan**: new `startMarketThreatPolling()` (co-located in `competitiveNews.ts` or a new `marketThreatPolling.ts`), mirroring the existing 24h `setInterval` pattern in `startCompetitiveNewsPolling()`. On each tick, calls `draftMarketThreat()` (already exists, already inserts `status: "draft"`) once per tracked competitor. No change to `approveMarketThreat()` or its PMM-only gate — this only adds the automatic trigger that was missing.

4. **Priority URLs on report generation**: `POST /api/competitive/ci-reports` accepts an optional `priorityUrls: string[]` in the body. `generateCiReport()` scrapes each via the existing `readUrl()` helper (already used elsewhere in the file) and includes their content in the prompt as an explicitly labeled "must-consider" section, in addition to whatever `ensureSources()` returns. Scraped priority-URL content is not written to `competitor_sources`.

5. **Per-product competitor filtering**: no backend change. `GET /competitors` already returns `aurigo_product` per competitor; filtering happens client-side.

6. **PMM-only enforcement for report generation**: already correct — `POST /ci-reports` is `requireAdmin`, and the frontend already gates the generation form behind `isAdmin`. No change needed; verify during implementation that no other entry point bypasses this.

7. **News feed query params**: `GET /api/competitive/news` accepts `view` (`"latest"` default | `"past"` | `"site_changes"`) and `priority` (`"all"` default | `"high"`). `listNewsItems()` filters accordingly:
   - `site_changes` → `category = 'Site Change'`
   - `latest` → `category <> 'Site Change'` and `discovered_at >= now() - interval '14 days'`
   - `past` → `category <> 'Site Change'` and `discovered_at < now() - interval '14 days'`
   - `priority=high` narrows any of the above to `priority = 'high'`

8. **Subscribe stub**: `POST /api/competitive/news/subscribe` upserts `{ email, aurigo_product }` into `news_subscriptions`. No email is sent. A `send test` action in the UI can call the same endpoint or a no-op — no real send logic in this pass.

## C. Frontend changes

All changes are within `app/frontend/src/pages/CompetitiveIntel.tsx`, scoped to the existing tab structure (no sidebar/shell changes).

1. **News tab redesign** (replaces current flat list):
   - Filter row: "Latest / Past news / Site Changes" pill-tabs (maps to `view` param) + "All / High priority" toggle (maps to `priority` param).
   - Three summary tiles: Battlecards (count of `status: final` battlecards), Pending Review (count of draft market threats + draft CI reports), Site Changes (count of `category: 'Site Change'` items in the last 7 days).
   - "Daily intel to your inbox" box: email input + Subscribe / Send test buttons, calling the stub endpoint.
   - Card grid: one card per category (News, Press Releases, Acquisitions & M&A, AI Direction, Bidding & RFPs, Webinars & Events) — each lists that category's items filtered by the active tab/toggle, showing competitor pill, priority dot (red = high, gray = normal), date, headline, one-line summary snippet, and a link-out to `source_url`.

2. **CI Reports tab**: reorder the generation form — Aurigo product select comes first; the competitor dropdown is filtered to only competitors whose `aurigo_product` matches the selected product (falls back to showing all competitors if no product is chosen yet). Add a "Priority URLs (optional)" multi-line textarea (one URL per line, trimmed/deduped client-side) wired into the `priorityUrls` field on the generate request.

3. **Market Threats tab**: no structural change. Drafts (now arriving automatically as well as manually) still show to admins only; approve gate unchanged.

## Out of scope for this pass

- Real email sending for the daily digest.
- Any change to the overall CompetitiveIntel page shell, sidebar, or per-product routing (full dashboard-style navigation from the screenshot).
- Any change to the news-items approval gate (stays auto-visible + dismiss).
- Populating/using the unused `category` column on `market_threats`.
