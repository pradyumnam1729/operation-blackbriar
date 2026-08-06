-- PMM Agent — initial schema (per pmm-playbook/vol-3-architecture/02-data-model.md)
-- Content truth stays in GTM-War-Room markdown; the database holds metadata,
-- the query/answer log, and asset lifecycle state.

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into products (name) values
  ('Masterworks'), ('Essentials'), ('Primus'), ('Masterworks AI')
on conflict (name) do nothing;

-- Every Ask-the-War-Room interaction. Feeds messaging-effectiveness (C11)
-- and gtm-performance (C13): which roles ask what, and what the war room
-- could not answer.
create table if not exists query_log (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

-- Generated assets: lifecycle state for the draft → final gate (§8.4).
-- war_room_path points at the markdown file that holds the content.
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  product text not null,
  audience text,
  war_room_path text not null unique,
  stage text not null default 'draft' check (stage in ('draft', 'final')),
  guard_ok boolean not null default true,
  guard_violations text[] not null default '{}',
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Lock everything down: the backend uses the service-role key (bypasses RLS);
-- no anon/public access is granted.
alter table products enable row level security;
alter table query_log enable row level security;
alter table assets enable row level security;
