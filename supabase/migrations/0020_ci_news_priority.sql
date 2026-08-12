-- News categorization + priority for the redesigned news dashboard, and a
-- stub subscriptions table for the "daily intel to your inbox" UI (no email
-- sending yet — see design spec 2026-08-11).

alter table news_items add column if not exists category text;
alter table news_items add column if not exists priority text not null default 'normal' check (priority in ('high', 'normal'));

create table if not exists news_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  aurigo_product text,
  created_at timestamptz not null default now(),
  unique (email, aurigo_product)
);

alter table news_subscriptions enable row level security;
