-- 0015: Custom connected agents — teams register their own HTTP agents in the
-- same registry the built-in agents live in (kind = 'custom'). The platform
-- calls the agent's endpoint with a standard JSON contract and the agentic
-- Ask loop can delegate to any enabled custom agent as a tool.
-- Idempotent: the runner re-applies every migration each run.

alter table agents drop constraint if exists agents_kind_check;
alter table agents add constraint agents_kind_check
  check (kind in ('task', 'pmm', 'custom'));

alter table agents add column if not exists endpoint_url text;
alter table agents add column if not exists auth_token text;
alter table agents add column if not exists timeout_ms int not null default 20000;
alter table agents add column if not exists owner_team text;
