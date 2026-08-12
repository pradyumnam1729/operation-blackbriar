-- 0019: Competitive watch — typed sources, user-initiated background research,
-- change detection + delta feed. Phase 0 of the ELT gap analysis
-- (pmm-playbook/vol-3-architecture/06-competitive-intel-elt-gap-analysis.md).
-- The migration runner replays every file on each run, so everything here is
-- idempotent (if-not-exists / duplicate-guard blocks).

-- ---------- typed source model ----------

alter table competitor_sources
  add column if not exists source_type text not null default 'official',
  add column if not exists enabled boolean not null default true,
  add column if not exists reliability text not null default 'unrated',
  add column if not exists discovered_by text not null default 'manual',
  add column if not exists refresh_hours int,
  add column if not exists last_changed_at timestamptz;

do $$ begin
  alter table competitor_sources add constraint competitor_sources_source_type_ck
    check (source_type in ('official','pricing','release_notes','reviews','news','jobs','procurement','analyst','other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table competitor_sources add constraint competitor_sources_reliability_ck
    check (reliability in ('high','medium','low','unrated'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table competitor_sources add constraint competitor_sources_discovered_by_ck
    check (discovered_by in ('manual','discovery','sweep'));
exception when duplicate_object then null; end $$;

-- ---------- user-initiated watches ----------

create table if not exists competitor_watches (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null unique references competitors(id) on delete cascade,
  enabled boolean not null default true,
  cadence_hours int not null default 168,   -- weekly floor; per-type cadence in sourcePolicy.ts
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- research runs (background work, observable) ----------

create table if not exists research_runs (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete cascade,
  kind text not null default 'refresh' check (kind in ('bootstrap','refresh','sweep')),
  trigger_by text not null default 'user' check (trigger_by in ('user','schedule')),
  status text not null default 'queued'
    check (status in ('queued','running','done','failed','cancelled')),
  -- {phase, discovered, scraped, changed, events_emitted, search_calls, read_calls, budget_exhausted}
  progress jsonb not null default '{}',
  budget jsonb not null default '{}',
  error text,
  requested_by uuid references profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- Idempotency: at most one live run per competitor+kind.
create unique index if not exists research_runs_live_idx
  on research_runs (competitor_id, kind)
  where status in ('queued','running');

-- ---------- delta feed ----------

create table if not exists competitor_events (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  source_id uuid references competitor_sources(id) on delete set null,
  run_id uuid references research_runs(id) on delete set null,
  event_type text not null default 'content_changed'
    check (event_type in ('source_added','content_changed','pricing_changed','release','news','job_signal','procurement_award','source_failed')),
  severity text not null default 'info' check (severity in ('info','notable','high')),
  title text not null,
  summary_md text,
  diff_excerpt text,
  evidence jsonb not null default '[]',
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists competitor_events_feed_idx on competitor_events (created_at desc);

alter table competitor_watches enable row level security;
alter table research_runs enable row level security;
alter table competitor_events enable row level security;
