-- Foundation Questionnaire: question bank, extraction candidates + PMM decisions,
-- versioned messaging docs. Constitution: §3.1 (intelligence gate), §8.4 (draft→final).
-- (Blueprint numbered this 0008; 0008_documents_chunks.sql landed first, so it is 0009.)

-- ---------- demo product row (Masterworks AI was removed in 0002) ----------
insert into products (id, name, line, module) values
  ('11111111-1111-1111-1111-111111111107', 'Masterworks AI', 'Masterworks', 'AI')
on conflict (name) do update set line = excluded.line, module = excluded.module;

-- ---------- section registry (Parts A–F of the reference doc) ----------
create table if not exists fq_sections (
  id text primary key,                      -- 'A1' … 'F5'
  part text not null,                       -- 'A' … 'F'
  title text not null,
  mode text not null check (mode in ('extract', 'synthesize', 'hybrid', 'auto', 'static')),
  ord int not null
);

-- ---------- question bank (extract questions only) ----------
create table if not exists fq_questions (
  id text primary key,                      -- 'A1-Q1'
  section_id text not null references fq_sections(id),
  ord int not null,
  kind text not null default 'extract' check (kind = 'extract'),
  prompt text not null,
  guidance text                             -- what a good answer contains; shown to model + reviewer
);

-- ---------- per-product answers: candidates + merge + PMM decision ----------
create table if not exists fq_answers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  question_id text not null references fq_questions(id),
  transcript_candidate jsonb,               -- {content, confidence, sources:[{doc_id,title,evidence}]}
  document_candidate jsonb,                 -- same shape
  merged_candidate jsonb,                   -- same shape; AI merge proposal citing both
  final_answer text,                        -- what the PMM accepted or edited
  final_sources jsonb not null default '[]',
  status text not null default 'unanswered'
    check (status in ('unanswered', 'pending_review', 'accepted', 'rejected', 'gap')),
  feedback text,                            -- free-text PMM feedback (persisted across regenerate)
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (product_id, question_id)
);

-- ---------- run tracking (background jobs, polled by the UI) ----------
create table if not exists fq_runs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  pass text not null check (pass in ('transcripts', 'documents', 'merge', 'generate')),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  detail text,                              -- human-readable result / error; generate stores doc id here
  docs_used int not null default 0,
  questions_answered int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ---------- versioned messaging & positioning documents ----------
create table if not exists messaging_docs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  version int not null,
  status text not null default 'draft' check (status in ('draft', 'final', 'archived')),
  title text not null,
  sections jsonb not null,                  -- [{id:'A1', title, markdown}] in reference order
  content_md text not null,                 -- assembled markdown (war-room artifact incl. frontmatter)
  content_html text not null,               -- sanitized HTML for in-app viewing + export
  gaps jsonb not null default '[]',         -- F5 list: [{question_id, prompt, note}]
  guard_violations jsonb not null default '[]',
  war_room_path text,                       -- set on approval
  exported_path text,                       -- set on approval (null if local folders unconfigured)
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, version)
);

alter table fq_sections enable row level security;
alter table fq_questions enable row level security;
alter table fq_answers enable row level security;
alter table fq_runs enable row level security;
alter table messaging_docs enable row level security;
-- (Backend service-role is the only client — same posture as 0002.)

-- ---------- seed: sections ----------
insert into fq_sections (id, part, title, mode, ord) values
  ('A1','A','The Why (Golden Circle)','extract',1),
  ('A2','A','Market & Category','extract',2),
  ('A3','A','Best-Fit Customer & ICP','extract',3),
  ('A4','A','Competitive Alternatives & Right to Win','extract',4),
  ('A5','A','Positioning Statements','synthesize',5),
  ('B1','B','Umbrella Message & Taglines','synthesize',6),
  ('B2','B','Top Value Pillars','synthesize',7),
  ('B3','B','What It Does','extract',8),
  ('B4','B','Messaging Matrix','synthesize',9),
  ('B5','B','Key Capabilities & Agent Catalog','extract',10),
  ('B6','B','The AI Story & Platform','hybrid',11),
  ('B7','B','Proof Points & Testimonials','auto',12),
  ('C1','C','Economic Buyer (Capital Program / PMO Director)','hybrid',13),
  ('C2','C','Finance & Budget Officer','hybrid',14),
  ('C3','C','Primary User (Project / Portfolio Manager)','hybrid',15),
  ('C4','C','IT & Security','hybrid',16),
  ('D1','D','How We Stack Up Against the Alternatives','synthesize',17),
  ('D2','D','Where the Competition Is','extract',18),
  ('D3','D','Head-to-Head Battlecards','synthesize',19),
  ('D4','D','Objection Handling','hybrid',20),
  ('E1','E','Marketing Kit','synthesize',21),
  ('E2','E','Sales Kit','synthesize',22),
  ('E3','E','Proposals / RFP Kit','synthesize',23),
  ('F1','F','Voice & Tone','synthesize',24),
  ('F2','F','Preferred Word List','synthesize',25),
  ('F3','F','The Check-Yourself Checklist','static',26),
  ('F4','F','Ownership & Version Control','static',27),
  ('F5','F','Open Inputs to Confirm','auto',28)
on conflict (id) do update set title = excluded.title, mode = excluded.mode, ord = excluded.ord;

-- ---------- seed: question bank (34 extract questions) ----------
insert into fq_questions (id, section_id, ord, prompt, guidance) values
  ('A1-Q1','A1',1,'Why does this product exist — what change in the world does it drive for its customers?','The "Why" of the Golden Circle. A belief about the customer''s world, not a feature.'),
  ('A1-Q2','A1',2,'How does the product deliver that change — what approach, platform, or method makes it possible?','The "How": the mechanism (platform, data grounding, workflow placement).'),
  ('A1-Q3','A1',3,'What is the product, in one plain-language sentence?','The "What": named product + what it lets teams do.'),
  ('A2-Q1','A2',1,'What market category does the product claim, and what is it deliberately positioned against or distinct from?','Category name + the contrast frame (e.g. built-in vs bolt-on).'),
  ('A2-Q2','A2',2,'Why now — what shifts in the customer''s environment make this urgent today?','2–4 "why now" drivers (complexity, retirements, siloed data, funding pressure).'),
  ('A2-Q3','A2',3,'What market statistics or third-party figures support the opportunity, and what is the source and date of each?','Numbers only with source + date; unsourced figures become "⚠ To confirm".'),
  ('A3-Q1','A3',1,'Who is the best-fit customer — organization type, situation, and constraint that makes them ideal?','One tight sentence: who, running what, under what pressure.'),
  ('A3-Q2','A3',2,'Which segments are targeted first (verticals, agency types, sizes)?','Named segments in priority order.'),
  ('A3-Q3','A3',3,'Who is in the buying committee — which roles are in the room, and who signs?','Roles/titles; mark the economic buyer.'),
  ('A3-Q4','A3',4,'What events or pressures trigger a purchase (buying triggers)?','Concrete triggers: new funding, audit pressure, turnover, backlog.'),
  ('A3-Q5','A3',5,'What signals mark a prospect as NOT a fit (walk-away signals)?','Disqualifiers: no funded program, policy blockers, no budget cycle.'),
  ('A4-Q1','A4',1,'What do buyers do instead of buying this product — including status quo, DIY, and adjacent tools?','Alternatives as the buyer sees them, not just named vendors.'),
  ('A4-Q2','A4',2,'What can this product claim that competitors cannot copy (unique attributes / right to win)?','2–4 durable attributes with the reason each is hard to copy.'),
  ('A4-Q3','A4',3,'What scale or adoption proof shows the right to win is real (customer counts, dollar volume, live capability)?','Quantified proof of scale, each with where it was stated.'),
  ('B3-Q1','B3',1,'In plain language, what does the product do for its users day to day?','1–2 sentences a first-time reader understands; no jargon.'),
  ('B3-Q2','B3',2,'How does the product work end to end — the flow from user need to delivered outcome?','One paragraph: inputs, what runs where, who approves, what comes out.'),
  ('B5-Q1','B5',1,'List every named capability, module, or agent the product ships with, grouped as the sources group them.','Complete named list with groupings (e.g. Copilot / Planning / Delivery).'),
  ('B5-Q2','B5',2,'For each capability or agent: what does it do, and what outcome or metric does it deliver?','Per item: job + quantified outcome where stated.'),
  ('B5-Q3','B5',3,'How can customers extend or customize the product beyond what ships out of the box?','Builder/configuration options; what is configurable vs fixed.'),
  ('B6-Q1','B6',1,'What underlying platform or technology is the product built on, and what data or expertise grounds it?','Platform name + grounding claim (e.g. 20+ years of program data).'),
  ('B6-Q2','B6',2,'What are the platform''s architectural building blocks or layers, as the sources describe them?','Layer names + one line each; only what sources state.'),
  ('B6-Q3','B6',3,'What security, governance, and compliance facts are explicitly stated (certifications, audit trails, data handling)?','Facts only — certification names verbatim; never inferred.'),
  ('C1-Q1','C1',1,'Economic buyer (e.g. capital program / PMO director): what are they measured on?','Their success metrics in business terms.'),
  ('C1-Q2','C1',2,'Economic buyer: what are their top pains, in their own words where possible?','Raw quotes preferred; note which call/doc each came from.'),
  ('C2-Q1','C2',1,'Finance & budget owner: what are they measured on?','Defensibility, cost control, audit readiness.'),
  ('C2-Q2','C2',2,'Finance & budget owner: top pains, in their own words where possible?','Raw language on defending decisions, scattered data.'),
  ('C3-Q1','C3',1,'Primary user (e.g. project / portfolio manager): what are they measured on?','Delivery metrics.'),
  ('C3-Q2','C3',2,'Primary user: top pains, in their own words where possible?','Admin burden, late risk discovery — raw quotes.'),
  ('C4-Q1','C4',1,'IT & security: what are they measured on and what must they protect?','Security, governance, controlled adoption.'),
  ('C4-Q2','C4',2,'IT & security: top concerns about adopting this product category, in their own words?','Data export, traceability, shadow AI.'),
  ('D2-Q1','D2',1,'Procore: what is their current product/AI capability and positioning, per the sources (with dates)?','Facts + as-of date; no editorializing.'),
  ('D2-Q2','D2',2,'Kahua: what is their current product/AI capability and positioning, per the sources (with dates)?','Same.'),
  ('D2-Q3','D2',3,'EcoInteractive: what is their current product/AI capability and positioning, per the sources (with dates)?','Same.'),
  ('D4-Q1','D4',1,'What objections, doubts, or pushbacks do prospects and customers actually raise? Quote raw language and note who raised each.','Verbatim objections from calls; the counters are synthesized later.')
on conflict (id) do update set prompt = excluded.prompt, guidance = excluded.guidance;
