-- Competitive Intel: live positioning maps. Each refresh stores a full map
-- (axes, placed points, skipped competitors, evidence trail); the newest row
-- is the live map shown on the Competitive Intel page.
-- Idempotent: the runner re-applies every migration on each run.

create table if not exists positioning_maps (
  id uuid primary key default gen_random_uuid(),
  x_axis jsonb not null,
  y_axis jsonb not null,
  points jsonb not null,
  skipped jsonb not null default '[]'::jsonb,
  summary_html text,
  evidence jsonb not null default '[]'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists positioning_maps_created_at_idx
  on positioning_maps (created_at desc);
