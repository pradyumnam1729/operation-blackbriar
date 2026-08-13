# ADR-001 — Feature Catalog two-level product hierarchy (sub_products table)

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** app-architect (Operation Blackbriar, engineering mode)
**Supersedes:** none

---

## Context

The Feature Catalog (`app/backend/src/routes/features.ts`, `features` table from
`supabase/migrations/0002_platform.sql`) is single-level: `features.product_id →
products(id)`, and the UI filters by one `product_id`. `products` already models a
two-part identity — `line` (Masterworks / Primus) + `module` (Plan / Build / Maintain)
— seeded as rows like `('Masterworks Build','Masterworks','Build')`.

The v2 requirement adds a **different** two-level axis sourced from the Excel workbook
`local-folders/Input/Masterworks 2026 Complete Features List.xlsx`:

- **Top level = "Product Name"** — the workbook, e.g. *Masterworks*.
- **Sub-product = the sheet** — *Capital Planning, FARM, Estimation & Bidding,
  Construction Project Management, Contract Project Management, Platform,
  Reporting & API, ROW* (8 sheets).

Critically, these sub-products are **not** the same taxonomy as `module` (Plan/Build/
Maintain). Capital Planning and ROW cut across delivery phases; they are functional
modules of the Masterworks suite. So the v2 hierarchy is a new axis, not a reuse of the
existing `line`/`module` columns.

Constraints that bound the decision:
- `features.product_id` is **NOT NULL** and is FK'd by the existing add-feature,
  release-note, and build-from-documents flows. Those must not break.
- The migration runner (`scripts/apply-migration.ts`) **replays every file each run** —
  all DDL must be idempotent (`if not exists`, `on conflict`, guarded blocks).
- Existing features carry `product_id` but no sub-product.

## Decision

**Add a `sub_products` table parented to a `products` row, and give each top-level
"Product Name" a canonical suite product row.** `features` gains a nullable
`sub_product_id` plus the three Excel-only fields.

1. **Suite anchor row.** Seed one `products` row per Excel workbook:
   `('Masterworks','Masterworks','Suite')` at fixed id
   `11111111-1111-1111-1111-1111111111a0`. This gives the v2 top level a real UUID to
   satisfy `features.product_id NOT NULL` and to parent `sub_products`. It is additive:
   the existing `Masterworks Plan/Build/Maintain` rows and their features are untouched.
   (0002 deletes bare `'Masterworks'`; the v2 migration numbered **higher** re-inserts
   it, so replay order preserves it.)

2. **`sub_products` table** — `id`, `product_id → products(id)` (the suite row),
   `name`, `summary`, `sort_order`, `created_at`; unique on `(product_id, lower(name))`.

3. **`features` new columns, all nullable** — `sub_product_id → sub_products(id) on
   delete set null`, `capabilities text`, `value_prop text`, `persona text`. Nullable is
   the load-bearing choice: the existing insert path (`POST /api/features`, `applyChange`)
   names none of these, so it is unaffected.

4. **Existing features:** `sub_product_id` stays **null** (they belong to module rows,
   not the suite). No backfill — legacy rows and Excel rows coexist on different
   `product_id`s.

5. **Idempotency backstop:** partial unique index
   `features (sub_product_id, lower(name)) where sub_product_id is not null` — enforces
   one row per (sub-product, feature name) for imported features without constraining
   legacy rows.

### Migration DDL (0023_feature_catalog_v2.sql — idempotent)

```sql
-- suite anchor: top-level "Product Name" for the v2 hierarchy
insert into products (id, name, line, module) values
  ('11111111-1111-1111-1111-1111111111a0', 'Masterworks', 'Masterworks', 'Suite')
on conflict (name) do update set line = excluded.line, module = excluded.module;

create table if not exists sub_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  summary text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists sub_products_product_name_uk
  on sub_products (product_id, lower(name));

alter table features add column if not exists sub_product_id uuid
  references sub_products(id) on delete set null;
alter table features add column if not exists capabilities text;
alter table features add column if not exists value_prop text;
alter table features add column if not exists persona text;

create index if not exists features_sub_product_idx on features (sub_product_id);
create unique index if not exists features_subproduct_name_uk
  on features (sub_product_id, lower(name)) where sub_product_id is not null;

alter table sub_products enable row level security;
```

## Consequences

- **Non-breaking.** Legacy catalog (`GET /api/features?product_id=<module row>`),
  add-feature, and release-note flows keep working — new columns are nullable, new FK is
  optional. Satisfies CLAUDE.md rule "extend what exists."
- **One extra Masterworks row.** The suite row appears in `GET /api/products`
  (ordered last within Masterworks as module `'Suite'`). The v2 UI drives off
  `GET /api/features/tree`, not the flat product list, so this is cosmetic.
- **Clean two-level query.** v2 view = `product_id = suite AND (sub_product_id = X | all)`.
- **DB-level idempotency guard** for imports independent of application code.
- **Extensible.** Adding Primus later = one more suite row + workbook; no schema change.

## Alternatives considered

- **(b) Denormalized `product_name` + `sub_product` text columns on `features`.**
  Rejected: no referential integrity, the two-level selector needs `SELECT DISTINCT`
  scans, sub-product rename touches every row, and duplicate strings drift.
- **(c) Reuse `products.line` as top level, one `products` row per sub-product.**
  Rejected: conflates two taxonomies — the module rows (Plan/Build/Maintain) already
  occupy the `module` axis; sub-products (Capital Planning…) are orthogonal to it.
  Repurposing would collide with existing seeds and mis-shape `GET /api/products`.
- **Parent `sub_products` to `products.line` (text), leave `features.product_id` on a
  default module row.** Rejected: leaves `product_id` semantically noisy and forces the
  API to filter by line-text rather than a clean FK. The suite anchor row is cheaper and
  honest.
