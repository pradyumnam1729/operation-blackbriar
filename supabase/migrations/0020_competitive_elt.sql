-- 0020: Competitive ELT surface — framework analyses (Phase 2), digests
-- (Phase 1), battlecard links + staleness (Phase 3). Idempotent: the runner
-- replays every file.

-- ---------- framework engine (Phase 2) ----------

create table if not exists framework_analyses (
  id uuid primary key default gen_random_uuid(),
  framework_key text not null,
  params jsonb not null default '{}',
  result jsonb not null,
  summary_html text,
  evidence jsonb not null default '[]',
  skipped jsonb not null default '[]',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists framework_analyses_key_idx
  on framework_analyses (framework_key, created_at desc);

-- ---------- ELT digest (Phase 1) ----------

create table if not exists digests (
  id uuid primary key default gen_random_uuid(),
  window_start timestamptz not null,
  window_end timestamptz not null,
  content_html text not null,
  evidence jsonb not null default '[]',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- battlecard canonical-card loop (Phase 3) ----------
-- One canonical battlecard artifact per (competitor, aurigo_product); saves
-- append versions instead of spawning new artifacts, and delta events mark
-- the card stale until a PMM-reviewed regeneration lands.

create table if not exists battlecard_links (
  artifact_id uuid primary key references artifacts(id) on delete cascade,
  competitor_id uuid not null references competitors(id) on delete cascade,
  aurigo_product text,
  question text,
  stale boolean not null default false,
  stale_reason text,
  triggering_event_id uuid references competitor_events(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists battlecard_links_competitor_idx
  on battlecard_links (competitor_id);

alter table framework_analyses enable row level security;
alter table digests enable row level security;
alter table battlecard_links enable row level security;
