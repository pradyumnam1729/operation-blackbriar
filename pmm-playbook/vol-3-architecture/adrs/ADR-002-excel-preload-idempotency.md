# ADR-002 — Excel pre-load: idempotent bulk import path

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** app-architect (Operation Blackbriar, engineering mode)

---

## Context

The Masterworks workbook holds ~250 features across 8 sheets. It must **pre-load** the
catalog in bulk without altering the normal single-feature add path (`POST /api/features`,
`applyChange`). Re-running the import must not duplicate rows. Two verified data hazards:

1. **Multi-row features.** A feature begins on a row with a non-empty *Feature Name*;
   following rows with an empty *Feature Name* are **continuation** rows whose
   *High-level capabilities* bullet appends to the current feature.
2. **Phantom range.** `sheet_to_json` on *Estimation & Bidding* reports **139,884 rows** —
   a stray far cell inflates the used range. A naive reader OOMs or loops forever.

The codebase convention (`competitiveParsing.ts` + `tests/*.pure.test.ts`) is: pure,
dependency-free logic split from the impure Claude/DB caller so it is unit-testable.

## Decision

**A pre-load only: a dependency-free assembly module + an impure xlsx/db service behind
one admin endpoint, with idempotency computed in application code against a natural key.**

1. **Pure module — `app/backend/src/services/featureImport.ts`** (no xlsx, no db):
   - `resolveColumns(header: string[]): ColumnMap` — tolerant header→index map; matches
     the verified typo `"1 line capbility summary"`.
   - `assembleFeatures(rows: (string|null)[][], cols: ColumnMap): AssembledFeature[]` —
     groups consecutive rows: a non-empty *Feature Name* opens a feature; empty-name rows
     append their *capabilities* bullet; whitespace-only names are skipped. Bounded by a
     `MAX_BLANK_STREAK` guard as a second line of defence against phantom ranges.
   - `normalizeName(s): string` — trim + collapse internal whitespace + strip `\r`.
   - `featureKey(subProductName, featureName): string` = `${lower(norm(sub))}::${lower(norm(name))}`.
   - `subProductKey(name): string` = `lower(norm(name))`.

   `AssembledFeature = { name, capabilities, description, value_prop, persona }` where
   `description ← "1 line capability summary"`, `value_prop ← "1 line value prop"`,
   `persona ← "Primary Persona"`, `capabilities ← joined continuation bullets`.

2. **Impure service — `app/backend/src/services/featureXlsxImport.ts`** (uses `xlsx` +
   supabase):
   - `readWorkbook(filePath): { sheetName: string; rows: (string|null)[][] }[]` — uses
     `XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null })`;
     `blankrows: false` collapses the 139,884-row phantom range to real content rows.
   - `importMasterworksWorkbook(sb, { filePath, productId, actorId }): ImportSummary` —
     per sheet: upsert the sub-product by `subProductKey` under `productId`; then per
     assembled feature, look up existing by **natural key `(sub_product_id, lower(name))`**
     and `update` else `insert`; tally `created / updated / skipped`.

3. **Idempotency key (precise).**
   - Sub-product: `(product_id, lower(trim(name)))` → `sub_products_product_name_uk`.
   - Feature: `(sub_product_id, lower(normalizeName(name)))` → matches the partial unique
     index from ADR-001. Lookup-then-write in code (Supabase upsert can't target a
     partial-predicate index); the index is the backstop. Same pattern as the existing
     `build-from-documents` `existingNames` set.

4. **Trigger — `POST /api/features/import-xlsx` (requireAdmin).** Body optional
   `{ path?, product_id? }`; defaults to the known Input file and the Masterworks suite
   id. Reads the server-side file (pre-load, not an upload — an upload variant is V2).
   Returns `{ summary }`. It calls **neither** `applyChange` nor the single-add route, so
   the normal add path is provably untouched.

## Consequences

- **Re-runnable.** First run: `created = N`. Second run: `created = 0, updated = N,
  skipped = 0`; row count is stable — the demo can re-import safely.
- **Testable seams.** `assembleFeatures`, `resolveColumns`, `featureKey`, `normalizeName`
  are pure → `tests/featureImport.pure.test.ts` covers multi-row grouping, the header
  typo, whitespace/blank skips, and key stability, with zero DB/model.
- **Phantom range neutralised** at two layers (`blankrows:false` + `MAX_BLANK_STREAK`).
- **Isolation.** The pre-load path shares nothing mutable with the AI extraction path;
  §8.4 draft→approval and the release-note review queue are unaffected.

## Alternatives considered

- **Supabase `.upsert(onConflict)`.** Rejected: cannot target the partial unique index
  (predicate `where sub_product_id is not null`); lookup-then-write is the codebase norm.
- **One big multi-sheet parse in the route handler.** Rejected: violates the pure/impure
  split — route handlers stay thin, logic stays unit-testable (per `04-api-and-stack.md`
  "keep domain logic out of route handlers").
- **Browser file upload now.** Deferred to V2: a known server-side path is the shortest
  honest demo of bulk pre-load; multipart upload adds surface without new value.
