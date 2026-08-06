-- Competitive Intelligence: competitor registry, scraped sources (Jina Reader),
-- and grounded comparison history.

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  website text,
  category text,
  aurigo_product text check (aurigo_product in ('Primus', 'Masterworks', 'Essentials')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists competitor_sources (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  url text not null,
  label text,
  content_md text,
  content_hash text,
  status text not null default 'pending' check (status in ('pending', 'ok', 'failed')),
  error text,
  scraped_at timestamptz,
  created_at timestamptz not null default now(),
  unique (competitor_id, url)
);

create table if not exists comparisons (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete set null,
  question text not null,
  aurigo_product text,
  answer_html text,
  sources jsonb not null default '[]',
  aurigo_evidence jsonb not null default '[]',
  status text not null default 'ok' check (status in ('ok', 'failed')),
  error text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table competitors enable row level security;
alter table competitor_sources enable row level security;
alter table comparisons enable row level security;

-- Seed the tracked set (websites are scrape entry points; sources are
-- discovered/added per competitor).
insert into competitors (id, name, aliases, website, category, aurigo_product) values
  ('99999999-9999-9999-9999-999999999901', 'Kahua', '{}', 'https://www.kahua.com', 'Capital program / construction PM', 'Masterworks'),
  ('99999999-9999-9999-9999-999999999902', 'Procore', '{}', 'https://www.procore.com', 'Construction management platform', 'Primus'),
  ('99999999-9999-9999-9999-999999999903', 'e-Builder', '{"e-Builder Enterprise","Trimble e-Builder"}', 'https://www.e-builder.net', 'Owner-side construction PM (Trimble)', 'Masterworks'),
  ('99999999-9999-9999-9999-999999999904', 'Oracle Primavera Unifier', '{"Primavera","Unifier","Oracle Primavera"}', 'https://www.oracle.com/construction-engineering/primavera-unifier/', 'Enterprise project controls', 'Masterworks'),
  ('99999999-9999-9999-9999-999999999905', 'Autodesk Construction Cloud', '{"Autodesk ACC","ACC","BIM 360"}', 'https://construction.autodesk.com', 'Construction management platform', 'Primus'),
  ('99999999-9999-9999-9999-999999999906', 'Sitetracker', '{}', 'https://www.sitetracker.com', 'High-volume project portfolio (energy/telecom)', 'Primus'),
  ('99999999-9999-9999-9999-999999999907', 'Planview', '{}', 'https://www.planview.com', 'Portfolio and work management', 'Primus')
on conflict (name) do nothing;
