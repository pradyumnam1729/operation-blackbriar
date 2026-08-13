-- Open API keys: a separate auth domain for exposing FINALIZED content to other
-- teams' tools (blueprint: app/docs/blueprints/open-api.md). Constitution: §8.4
-- (only finals cross this boundary), §9 (personas served in their own tools).
-- Keys are stored hashed (sha-256 of the full 'pmm_live_…' string); plaintext is
-- returned exactly once at creation and never persisted or logged.
--
-- Numbering: the blueprint (§1) proposes 0023_api_keys.sql, but 0023 was already
-- claimed by 0023_feature_catalog_v2.sql (a parallel session — the exact collision
-- §0/§1 warned about). Next free number at build time is 0024, used here.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),   -- activity_log.entity_id is uuid (0002)
  name text not null,                              -- label, e.g. "Proposals RFP bot"
  team text not null default '',                   -- owner team label, e.g. "Proposals"
  key_prefix text not null,                        -- first 15 chars ("pmm_live_" + 6) for UI display
  key_hash text not null unique,                   -- sha-256 hex of the FULL key string
  scopes text[] not null default '{}',             -- subset of: assets:read, messaging:read, intel:read, ask
  enabled boolean not null default true,           -- false = revoked (kill switch; delete = hard revoke)
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- Per-request usage log (decision §0.1-4). Append-only, fire-and-forget writes,
-- never user-visible in the activity feed. Stores the key id — NEVER key material.
-- Retention/pruning is a V2 note (§10): rows are tiny, indexed, MVP volume is trivial.
create table if not exists api_request_log (
  id bigint generated always as identity primary key,
  key_id uuid not null references api_keys(id) on delete cascade,
  method text not null,
  path text not null,                              -- req.originalUrl WITHOUT query string
  status int,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists api_request_log_key_idx
  on api_request_log (key_id, created_at desc);

alter table api_keys enable row level security;
alter table api_request_log enable row level security;
-- (Backend service-role is the only client — same posture as 0002/0009/0011.)
