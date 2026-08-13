# 07 — Feature Catalog v2 (blueprint)

Two-level hierarchy · Excel pre-load · card + QuickBase-style table.
Decisions of record: [ADR-001](adrs/ADR-001-feature-catalog-two-level-hierarchy.md),
[ADR-002](adrs/ADR-002-excel-preload-idempotency.md). This doc is the implementation
contract for ui-engineer and the verification map for qa-reviewer.

**Value props served:** 3–5× products/personas per PMM (bulk pre-load of a whole
suite in one action) and 100% messaging consistency (persona + value-prop carried as
structured fields, not prose). No new AI surface — the add-feature/release-note flows are
untouched (CLAUDE.md non-negotiable: extend what exists).

---

## 1. Data model — see ADR-001

`sub_products` table + suite anchor product row `Masterworks`; `features` gains nullable
`sub_product_id, capabilities, value_prop, persona`. Legacy features keep
`sub_product_id = null`. Migration: **`supabase/migrations/0023_feature_catalog_v2.sql`**
(next free number; highest existing is 0022). Full idempotent DDL in ADR-001.

Column mapping (Excel → `features`):

| Excel column | features field |
|---|---|
| Feature Name | `name` |
| High-level capabilities (joined continuation bullets) | `capabilities` |
| 1 line capability summary | `description` (reused so existing cards still render) |
| 1 line value prop | `value_prop` |
| Primary Persona | `persona` |
| (sheet name) | `sub_product_id` (resolved) · `product_id` = suite |
| — | `category = null`, `status = 'active'`, `release_date = null` |

---

## 2. Import pipeline — see ADR-002

Files:
- **`app/backend/src/services/featureImport.ts`** — pure: `resolveColumns`,
  `assembleFeatures`, `normalizeName`, `featureKey`, `subProductKey`.
- **`app/backend/src/services/featureXlsxImport.ts`** — impure: `readWorkbook`
  (`sheet_to_json({header:1, blankrows:false, defval:null})`),
  `importMasterworksWorkbook(sb, {filePath, productId, actorId})`.

Natural keys: sub-product `(product_id, lower(name))`; feature
`(sub_product_id, lower(normalizeName(name)))`. Lookup-then-write → re-run never
duplicates. `ImportSummary`:

```ts
interface SheetResult { sub_product: string; created: number; updated: number; skipped: number; }
interface ImportSummary { product: string; sheets: SheetResult[];
  totals: { created: number; updated: number; skipped: number; features: number }; }
```

---

## 3. API changes — see 03-api-standards (envelopes, status codes)

All under the existing `featuresRouter` (`requireAuth`; mutations `requireAdmin`).

### 3.1 `GET /api/features` (extend)
- **Accept:** `product_id` (existing) and optional `sub_product_id`.
- **Return the full record** so one call feeds both views:
  ```
  { features: [ { id, product_id, product_name, sub_product_id, sub_product_name,
    name, description, capabilities, value_prop, persona, category, release_date,
    release_note_id, source_url, status, created_at, updated_at } ] }
  ```
  Implement with a join select `products(name), sub_products(name)` and flatten to
  `product_name` / `sub_product_name` (null → returned as `null`, rendered `—`).
- **Empty:** `200 { features: [] }` — never an error.

### 3.2 `GET /api/features/tree` (new)
Drives the two-level selector.
```
{ products: [ { id, name, line, module,
    sub_products: [ { id, name, feature_count } ] } ] }
```
All products returned; legacy module rows carry `sub_products: []`. Counts via a grouped
count over `features.sub_product_id`.

### 3.3 `POST /api/features/import-xlsx` (new, requireAdmin)
- Body: `{ path?, product_id? }`; defaults = known Input file + suite id.
- `200 { summary: ImportSummary }`.
- Errors: `400` file-not-found / bad product_id · `403` non-admin (requireAdmin) ·
  `404` product not found · `500` db.

**Filtering/search/sort placement — decision:** coarse filter (`product_id`,
`sub_product_id`) is **server-side**; global search, column filters, and sort are
**client-side**. Justification: ~250 features (≤ the whole Masterworks suite) is trivial
to hold and sort in the browser; a QuickBase-style UX demands zero-latency interaction,
and the page already loads a product's features client-side. Server-side search would add
round-trips for no gain at this volume. **Revisit threshold:** > ~2000 rows per product
(V2) → move to server-side pagination + query params `?q=&sort=&filter=`.

---

## 4. Pure/testable seams (qa)

`tests/featureImport.pure.test.ts` over `featureImport.ts`:
- `assembleFeatures`: continuation rows append capabilities to the current feature; a new
  non-empty Feature Name opens the next; whitespace-only names skipped; `MAX_BLANK_STREAK`
  halts a phantom range.
- `resolveColumns`: resolves the verified header incl. typo `"1 line capbility summary"`;
  missing required column → throws.
- `featureKey` / `subProductKey`: case- and whitespace-insensitive; stable across runs
  (idempotency proof).

---

## 5. UI (ui-engineer)

**Files:**
- `app/frontend/src/lib/api.ts` — add `SubProduct`, `FeatureRecord` (fields per §3.1),
  `FeatureTreeProduct`; `getFeatureTree()`, `getFeatures({product_id, sub_product_id})`,
  `importFeatureXlsx()`.
- `app/frontend/src/pages/FeatureCatalog.tsx` — replace the single dropdown with the
  two-level selector + a **Cards | Table** view toggle; host both view components; keep
  the release-note queue, review queue, process, and manual-add sections unchanged.
- `app/frontend/src/pages/features/FeatureCards.tsx` — extract the existing card grid;
  add `sub_product_name`, `persona`, `value_prop` to the card.
- `app/frontend/src/pages/features/FeatureTable.tsx` — QuickBase-style data-dense table:
  columns Name · Sub-product · Persona · Value prop · Capabilities · Status · Release
  date; global search input; per-column filter dropdowns (Sub-product, Persona, Status);
  sortable headers; live row count. **All client-side** over the loaded `FeatureRecord[]`.

**Selector behaviour:** Product select (from tree) → Sub-product select
(`sub_products` of the chosen product, plus an "All sub-products" option). If the product
has no sub-products, hide the sub-product select and the Sub-product column shows `—`.

**Admin-only:** a "Pre-load from Excel" button → `POST /api/features/import-xlsx`, then
re-fetch tree + features and render the `ImportSummary` (created/updated/skipped per
sheet). Reading stays open to all roles (§9 persona access).

**Brand tokens (non-negotiable):** sharp corners, Dark Teal `#015F74`, Roboto,
data-dense table — per `04-api-and-stack.md` UI section.

**Empty/error states:** no products → "No products yet."; product with 0 features →
existing `empty-note`; import file missing → surface the `400` message inline.

---

## 6. Build sequence + ownership

| # | Stage | Owner | qa verification |
|---|-------|-------|-----------------|
| 1 | `0023` migration | orchestrator (inline; DDL only) | `npm run migrate` twice → idempotent; `sub_products` exists; one `Masterworks` suite row; new `features` columns present |
| 2 | `featureImport.ts` + `tests/featureImport.pure.test.ts` | orchestrator (inline) | `npm test` green; assembly + key + column cases pass |
| 3 | `featureXlsxImport.ts` + `POST /import-xlsx` | orchestrator (inline) | POST → summary `created=N`; POST again → `created=0, updated=N`; `select count(*)` stable (no dupes) |
| 4 | `GET /api/features` extend + `GET /api/features/tree` | orchestrator (inline) | tree returns Masterworks with 8 sub-products; `?product_id=<suite>` returns records with new fields + names; legacy `?product_id=<module>` unchanged |
| 5 | UI: selector, toggle, `FeatureCards`, `FeatureTable`, import button | **ui-engineer** (from §5) | two-level selector works; Cards/Table toggle; table search/sort/filter client-side; import + reviews admin-only; non-admin read-only |

Backend stages 1–4 are deterministic, test-covered plumbing → orchestrator builds inline.
Stage 5 (the two views + selector UX) is the ui-engineer deliverable from this blueprint.

Last updated: 2026-08-13
