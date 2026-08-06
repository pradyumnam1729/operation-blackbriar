-- Guardrails: admin-editable grounding files injected into every AI system
-- prompt (alongside the war-room brand DNA — nothing replaced).

create table if not exists guardrail_files (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  content_md text not null default '',
  active boolean not null default true,
  sort int not null default 100,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table guardrail_files enable row level security;

insert into guardrail_files (id, name, description, content_md, sort) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', 'About Aurigo',
   'Who Aurigo is, the products, the audiences — baseline context for every answer.',
   '# About Aurigo

Aurigo builds capital program management software for public infrastructure and facility owners.

## Products
- Masterworks — capital planning and delivery for government agencies (federal, state, large local)
- Essentials — capital management for local and regional agencies
- Primus — capital program platform for commercial facility owners (data centers, energy/utilities, manufacturing, life sciences)
- Lumina — the AI platform underneath Masterworks AI and Primus AI

## Audiences
- Capital owners is the umbrella term. Public owners (= government agencies) are served by Masterworks and Essentials; facility owners by Primus.

*To confirm: official About Aurigo corporate boilerplate, trademark and legal lines.*', 10),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', 'Brand and tone',
   'Voice rules, banned words, and terminology — so nothing sounds off-brand.',
   '# Brand and tone

## The cardinal rule
Open from the reader''s world — their decision, constraint, or risk — never from Aurigo or the product.

## Terminology
- "AI-native" is the only approved AI modifier (never AI-powered / AI-driven / AI-enabled in body copy)
- "life cycle" is two words; "infrastructure" is never pluralized
- Government agencies run capital *programs* (Masterworks/Essentials); facility owners run *portfolios* (Primus)
- Never "ROI" in public-sector framing — use "program outcomes" or "capital program performance"
- Never "the" before an org abbreviation ("FHWA requires", not "the FHWA requires")
- "unified system", not the banned source-of-truth cliche

## Style
Direct, active voice, confident. No hedging (may/could/might/potentially). Precise, named outcomes over vague benefit words. Em dashes: at most one or two per page.

Full reference: Voice of Aurigo - Standards Reference.md and GTM-War-Room/BRAND-DNA/.', 20),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', 'Prompt library',
   'Reusable starting prompts surfaced in the chat bar and quick actions.',
   '# Prompt library

## Sales
- Give me a talk track for a state DOT worried about staff turnover
- Build a battlecard against Kahua for a Masterworks deal
- Find proof points for an airport client

## Marketing
- Draft an FAQ for Masterworks Plan capital planners
- What are our approved differentiators for Primus?
- Draft a 60-second video script outline for the Primus launch

## ELT
- Summarize how we win against Oracle Primavera
- What shipped across all products recently?
- What are the top loss reasons this quarter?', 30)
on conflict (name) do nothing;
