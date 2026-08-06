-- PMM Agent platform schema v2.
-- Personas: PMM = admin (full access); sales / marketing / elt = consumers.
-- Products: Masterworks and Primus lines, each with Plan / Build / Maintain.

-- ---------- profiles (linked to Supabase auth) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'sales' check (role in ('admin', 'sales', 'marketing', 'elt')),
  created_at timestamptz not null default now()
);

-- ---------- products: restructure to line + module ----------
alter table products add column if not exists line text;
alter table products add column if not exists module text;

-- 'Masterworks AI' intentionally NOT deleted: 0009 re-seeds it and the
-- questionnaire tables FK it — deleting on re-run would violate those FKs
-- (the runner re-applies every migration; 0009's on-conflict keeps it current).
delete from products where name in ('Masterworks', 'Essentials', 'Primus');

insert into products (id, name, line, module) values
  ('11111111-1111-1111-1111-111111111101', 'Masterworks Plan', 'Masterworks', 'Plan'),
  ('11111111-1111-1111-1111-111111111102', 'Masterworks Build', 'Masterworks', 'Build'),
  ('11111111-1111-1111-1111-111111111103', 'Masterworks Maintain', 'Masterworks', 'Maintain'),
  ('11111111-1111-1111-1111-111111111104', 'Primus Plan', 'Primus', 'Plan'),
  ('11111111-1111-1111-1111-111111111105', 'Primus Build', 'Primus', 'Build'),
  ('11111111-1111-1111-1111-111111111106', 'Primus Maintain', 'Primus', 'Maintain')
on conflict (name) do update set line = excluded.line, module = excluded.module;

-- ---------- requests (core intake object) ----------
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  request_type text not null default 'asset' check (request_type in ('asset', 'answer', 'update', 'other')),
  product_id uuid references products(id),
  description text,
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'fulfilled', 'closed')),
  requester_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- uploads + promoted context docs ----------
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id) on delete set null,
  uploader_id uuid references profiles(id),
  filename text not null,
  file_type text not null,
  storage_path text not null,
  size_bytes bigint not null default 0,
  sensitive boolean not null default false,
  extracted_text text,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'done', 'failed', 'unsupported')),
  promoted boolean not null default false,
  promoted_at timestamptz,
  promoted_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists context_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text not null default 'upload' check (source in ('upload', 'folder_watch', 'war_room', 'manual')),
  doc_type text not null default 'other' check (doc_type in ('prd', 'jtbd', 'transcript', 'release_note', 'battlecard', 'other')),
  product_id uuid references products(id),
  content text not null,
  upload_id uuid references uploads(id) on delete set null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- feature catalog ----------
create table if not exists release_notes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  filename text not null,
  source_path text,
  raw_text text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists features (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  name text not null,
  description text,
  category text,
  release_date date,
  release_note_id uuid references release_notes(id) on delete set null,
  source_url text,
  status text not null default 'active' check (status in ('active', 'changed', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists feature_reviews (
  id uuid primary key default gen_random_uuid(),
  release_note_id uuid references release_notes(id) on delete cascade,
  product_id uuid not null references products(id),
  proposed jsonb not null,
  change_type text not null check (change_type in ('added', 'changed', 'deprecated')),
  confidence numeric not null default 0.5,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- win/loss (salesforce sync target, mock-first) ----------
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  sf_id text unique,
  name text not null,
  account_name text,
  product_line text,
  stage text not null check (stage in ('closed_won', 'closed_lost')),
  amount numeric,
  competitor text,
  loss_reason text,
  closed_at date,
  owner text,
  synced_at timestamptz not null default now(),
  raw jsonb
);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  detail text
);

-- ---------- artifact library (rich content, versioned) ----------
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_type text not null,
  product_line text,
  preview_color text,
  canva_id text,
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists prompt_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_type text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  asset_type text not null default 'one-pager',
  product_id uuid references products(id),
  persona text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'final', 'archived')),
  request_id uuid references requests(id) on delete set null,
  template_id uuid references templates(id) on delete set null,
  prompt_id uuid references prompt_library(id) on delete set null,
  current_version int not null default 1,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  version int not null,
  content_html text not null,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (artifact_id, version)
);

create table if not exists artifact_context (
  artifact_id uuid not null references artifacts(id) on delete cascade,
  upload_id uuid not null references uploads(id) on delete cascade,
  primary key (artifact_id, upload_id)
);

-- ---------- collaboration ----------
create table if not exists team_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('artifact', 'request')),
  entity_id uuid not null,
  parent_id uuid references comments(id) on delete cascade,
  body text not null,
  author_id uuid references profiles(id),
  resolved boolean not null default false,
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  mentioned_user uuid references profiles(id),
  mentioned_team uuid references team_tags(id),
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read boolean not null default false,
  emailed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  actor_id uuid references profiles(id),
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- integrations & feature flags ----------
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sharepoint_local', 'sharepoint_graph', 'salesforce', 'canva', 'smtp')),
  name text not null,
  config jsonb not null default '{}',
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default false,
  note text
);

insert into feature_flags (key, enabled, note) values
  ('sharepoint_watcher', false, 'Local folder watcher for release notes / PRDs; Graph API later'),
  ('salesforce_live', false, 'Live Salesforce sync; mock data until Connected App is provisioned'),
  ('canva_live', false, 'Canva Connect API; mock template gallery until OAuth app exists'),
  ('email_send', false, 'Real email via SMTP; notifications logged until key is configured')
on conflict (key) do nothing;

-- ---------- RLS: locked down; backend (service role) is the only client ----------
alter table profiles enable row level security;
alter table requests enable row level security;
alter table uploads enable row level security;
alter table context_docs enable row level security;
alter table release_notes enable row level security;
alter table features enable row level security;
alter table feature_reviews enable row level security;
alter table opportunities enable row level security;
alter table sync_runs enable row level security;
alter table templates enable row level security;
alter table prompt_library enable row level security;
alter table artifacts enable row level security;
alter table artifact_versions enable row level security;
alter table artifact_context enable row level security;
alter table team_tags enable row level security;
alter table comments enable row level security;
alter table mentions enable row level security;
alter table notifications enable row level security;
alter table activity_log enable row level security;
alter table integrations enable row level security;
alter table feature_flags enable row level security;
