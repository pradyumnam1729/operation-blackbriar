-- Competitive Intel expansion: admin-curated CI reports (the required base
-- for battlecard generation, replacing ad-hoc single-comparison
-- battlecards), a daily competitor news feed, and market-threat / new
-- entrant tracking. Same draft->approve->visible convention as artifacts
-- and messaging docs; access enforced at the Express layer, not RLS.

create table if not exists ci_reports (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete set null,
  aurigo_product text,
  title text not null,
  content_html text not null,
  source_comparison_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'final', 'archived')),
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete set null,
  headline text not null,
  summary_html text not null,
  source_url text,
  discovered_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists market_threats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aurigo_product text,
  category text,
  summary_html text not null,
  rationale text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 100),
  source_url text,
  status text not null default 'draft' check (status in ('draft', 'final', 'archived')),
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table ci_reports enable row level security;
alter table news_items enable row level security;
alter table market_threats enable row level security;
