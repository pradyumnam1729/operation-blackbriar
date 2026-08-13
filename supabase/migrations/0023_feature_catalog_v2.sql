-- 0023: Feature Catalog v2 — two-level product hierarchy (Product → Sub-product)
-- + Excel pre-load fields. Additive and idempotent (the runner replays every
-- file): new columns are nullable so the existing single-add and release-note
-- paths are provably unaffected; existing features keep sub_product_id = null.
-- See pmm-playbook/vol-3-architecture/07-feature-catalog-v2.md + ADR-001/002.

-- Suite anchor: "Masterworks" is currently a `line` spread across three module
-- rows (Plan/Build/Maintain); the two-level hierarchy needs one real product
-- row to parent the sub-products and satisfy features.product_id NOT NULL.
insert into products (id, name, line, module) values
  ('11111111-1111-1111-1111-1111111111a0', 'Masterworks', 'Masterworks', 'Suite')
on conflict (name) do update set line = excluded.line, module = excluded.module;

-- Sub-products (Capital Planning, FARM, …) — a different taxonomy axis than the
-- existing module (Plan/Build/Maintain), so its own table.
create table if not exists sub_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Idempotency key for the importer: one sub-product per (product, name).
create unique index if not exists sub_products_product_name_idx
  on sub_products (product_id, lower(name));

-- New feature fields — ALL nullable. capabilities/value_prop/persona carry the
-- Excel columns; origin marks provenance so the UI can badge imported rows as
-- unvalidated (draft-gate visibility, product-to-market advisory).
alter table features
  add column if not exists sub_product_id uuid references sub_products(id) on delete set null,
  add column if not exists capabilities text,
  add column if not exists value_prop text,
  add column if not exists persona text,
  add column if not exists origin text;

-- Import idempotency for features: one row per (sub_product, feature name).
-- Partial so legacy features (sub_product_id null) are never constrained.
create unique index if not exists features_subproduct_name_idx
  on features (sub_product_id, lower(name))
  where sub_product_id is not null;

create index if not exists features_sub_product_idx on features (sub_product_id);

alter table sub_products enable row level security;
