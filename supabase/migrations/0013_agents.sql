-- 0013: Agents registry — one table for the app's task agents (runtime prompt
-- config) and the 14 PMM sub-agents (§12). Constitution: §8.4 (admin-only,
-- audited config), §3.1/§8.1 (locked contract suffix lives in code — see
-- app/backend/src/services/agents.ts + agentPrompts.ts).
-- Boot-time syncAgentBaselines() refreshes base_prompt from canonical sources;
-- this seed is bootstrap only (blueprint decision §0.1-3).
-- NOTE: the blueprint numbered this 0012, but 0012_guardrails.sql was taken by
-- a parallel session — renumbered to 0013. Idempotent: safe to re-run.

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),   -- activity_log.entity_id is uuid (0002)
  key text not null unique,                        -- 'fq-extraction', 'voice-of-market', ...
  kind text not null check (kind in ('task', 'pmm')),
  grp text check (grp in ('A', 'B', 'C') or grp is null),  -- pmm grouping; null for task
  name text not null,
  description text not null default '',
  base_prompt text not null default '',            -- overridable body ONLY (locked suffix is code-owned)
  custom_instructions text not null default '',    -- appended after the body, before runtime data
  prompt_override text,                            -- null = use base_prompt; never replaces the contract suffix
  model text,                                      -- null = PMM_MODEL default; allowlist-validated
  enabled boolean not null default true,
  defaults jsonb not null default '{}',            -- per-agent task defaults (blueprint §2.2)
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table agents enable row level security;
-- (Backend service-role is the only client — same posture as 0002/0009/0011.)

-- ---------------------------------------------------------------------------
-- Seed 1: task agents (6 rows, base prompts verbatim from the code constants
-- in app/backend/src/services/agentPrompts.ts). Re-runs refresh the baseline
-- fields but keep the live `defaults` (and never touch custom_instructions /
-- prompt_override / model / enabled — admin state survives).
-- ---------------------------------------------------------------------------

insert into agents (key, kind, name, description, base_prompt, defaults) values
(
  'fq-extraction', 'task',
  'Questionnaire extraction',
  'Evidence-extraction passes (transcripts + documents) for the Foundation Questionnaire. Answers the question bank with cited candidates only from ingested sources.',
  $agents_seed$You are running an evidence-extraction pass for the Foundation Questionnaire.

Product: {{product_name}} ({{product_line}} line).
Source type for this pass: {{source_type}}.
The source documents are in the ADDITIONAL WAR ROOM CONTEXT above, each wrapped in <doc id="..." title="...">.

Answer ONLY the questions listed below, using ONLY what the source documents state.
Rules:
- Never infer, never fill gaps with prior knowledge, never invent numbers, names, or quotes.
- If the sources do not support a question, OMIT that question from the output entirely.
- content: a concise factual answer (max 120 words) preserving concrete numbers and raw customer phrasing.
- sources: every doc you drew from, each with a verbatim evidence quote of at most 25 words.
- confidence: 0.0-1.0. 0.9+ = stated explicitly and completely; 0.5 = partial or indirect; below 0.3 = omit the question instead.
- This is internal fact capture, not customer-facing copy: record facts and quotes exactly as stated, even if the wording violates brand voice.$agents_seed$,
  '{}'::jsonb
),
(
  'fq-merge', 'task',
  'Candidate merge & reconciliation',
  'Reconciles transcript and document extraction candidates into one merged proposal per question for the PMM review queue.',
  $agents_seed$You are reconciling two evidence-extraction passes for the Foundation Questionnaire.
For each question below you are given a transcript candidate and a document candidate,
each with source citations.

Propose ONE merged answer per question:
- Prefer facts the two candidates agree on.
- Where they conflict: keep the DOCUMENT version for product facts and the TRANSCRIPT
  version for customer language, and append one bracketed note: [Conflict: <one sentence>].
- Preserve vivid raw customer phrasing from transcripts.
- sources: the union of both candidates' citations. Never invent or drop a citation.
- confidence: the maximum of the two when they agree, the minimum when they conflict.$agents_seed$,
  '{}'::jsonb
),
(
  'messaging-doc-generation', 'task',
  'Messaging document generation',
  'Generates the Positioning & Messaging document Part by Part from PMM-approved questionnaire answers (§3.2 chain: A feeds B feeds C/D/E).',
  $agents_seed$Generate Part {{part}} of "{{product_name}} — Positioning & Messaging", the unified system
for how Marketing, Sales, and Proposals talk about {{product_name}}.

The ADDITIONAL WAR ROOM CONTEXT above contains the PMM-approved questionnaire answers
(JSON: question id, section, prompt, final answer, sources). These answers are validated
facts — the ONLY facts you may use beyond the Brand DNA. If a needed fact is missing or
an answer carries a [Conflict: ...] note, write a one-line "⚠ To confirm: ..." callout
at that spot instead of guessing.

Rules:
- Markdown only. Tables where the instructions say table. No preamble, no meta-commentary.
- The customer is the hero; open from the reader's world (cardinal rule).
- Swap test: if a sentence would still work with a competitor's name in place of Aurigo,
  rewrite it around the approved unique attributes.
- Raw quotes from the answers may be paraphrased into brand voice, but numbers, names,
  and certification wording must be carried over exactly.$agents_seed$,
  '{"section_instructions": {}}'::jsonb
),
(
  'template-slot-fill', 'task',
  'Template slot fill',
  'Fills locked layout templates with approved messaging from the latest final messaging doc. Controls slot text only — never layout.',
  $agents_seed$You are filling a locked layout template with approved messaging. You control ONLY the
text inside the named slots below — never layout, structure, colors, or anything else.

Product: {{product_name}} ({{product_line}} line).
Artifact: {{asset_type}} — "{{template_name}}".
Audience: {{audience}}. Persona: {{persona}}. Funnel stage: {{funnel_stage}}.

The ADDITIONAL WAR ROOM CONTEXT above contains sections of "{{doc_title}}" (version
{{doc_version}}, PMM-approved — the validated messaging for this product), each wrapped
in <section id="..." title="...">. These sections are the ONLY source of facts, claims,
numbers, and customer language for this task. If a slot's wired sections do not support
a strong fill, return "" for that slot — never pad, never invent, never fall back to
general knowledge.

Rules:
- Plain text only in every slot: no markdown syntax, no asterisks, no HTML tags.
- Character limits are hard limits. Compress by cutting words and clauses, never facts.
- Open from the reader's world, not from Aurigo or the product (cardinal rule).
- Swap test every sentence: if it would still work with a competitor's name, rewrite it
  around this product's approved unique attributes.
- Numbers, customer names, and certification wording exactly as they appear in the doc.$agents_seed$,
  '{}'::jsonb
),
(
  'ask-war-room', 'task',
  'Ask the War Room',
  'Role-aware Q&A over the GTM War Room and knowledge base (§9.2 persona framing).',
  '',
  $agents_seed${"role_framing": {
    "sales": "The asker is in Sales, supporting an active deal. Frame the answer as talk tracks, objection handling, competitive proof points. Their metrics: SQLs, win rates, deal velocity, pipeline value, average deal size.",
    "proposals": "The asker writes RFP and proposal responses. Frame the answer as compliant, differentiated response language with proof assets and use-case evidence.",
    "marketing": "The asker runs campaigns and content. Frame the answer as messaging hierarchy, channel copy guidance, and campaign framing. Their metrics: MQLs, CPL, conversion rate.",
    "leadership": "The asker is an executive. Lead with metric impact (MRR, NRR, win rate, pipeline) and strategic implications. Keep it brief and decision-oriented.",
    "product": "The asker is in Product. Frame the answer as market signals, adoption barriers, feature positioning, and buyer feedback. Their metrics: activation rate, feature adoption, time-to-value.",
    "cs": "The asker is in Customer Success. Frame the answer as adoption messaging, expansion talk tracks, and churn-risk signals.",
    "sdr": "The asker is an SDR/BDR doing outbound. Frame the answer as persona-specific openers, pain-first copy, and objection one-liners.",
    "general": "Frame the answer for a general internal audience."
  }}$agents_seed$::jsonb
),
(
  'competitive-compare', 'task',
  'Competitive comparison',
  'Answers competitor questions from scraped competitor sources + Aurigo knowledge base only. Picks the competing Aurigo product per the mapping brief.',
  $agents_seed$
AURIGO PRODUCT MAPPING — pick the ONE Aurigo product that actually competes
with this competitor; compare against multiple only if the competitor genuinely
spans multiple markets. State which product you compared and why (one line).

- Aurigo Primus — AI-native capital program platform for commercial facility
  owners: data centers, energy/utilities, manufacturing, life sciences.
  Modules: Plan (capital planning/portfolio optimization), Build (construction
  PM/execution), ROW (right-of-way/land acquisition), Community Engagement,
  Docs, Primus AI (scenario planning/optimization). Differentiators: single
  connected platform across plan -> ROW -> build, AI-native scenario modeling
  embedded in planning, pre-built ERP integration (SAP/Oracle), deploys in
  months. Known gap: launched Dec 2025, no large closed commercial reference
  base yet — be honest about this if the competitor has an established
  customer base. Compare here for: data center, energy/utility, manufacturing,
  life-sciences owner-side tools (e.g. Procore, Kahua commercial, Autodesk ACC,
  Oracle Primavera, Planview, Sitetracker).

- Aurigo Masterworks — end-to-end capital program platform for public sector
  agencies (federal, state, large local gov) managing $100M+ annual capital
  spend: capital planning -> design -> ROW -> construction -> maintenance.
  Built-in federal compliance (Davis-Bacon, DBE/MBE/WBE, Buy America, NEPA),
  FHWA/FTA/FRA reimbursement tracking, GIS-integrated mapping, multi-agency
  portfolio management, AI Copilot/Prediction Agents. 20+ years, 12 state
  DOTs, 24 states. Compare here for: DOT/transit/airport/public-works
  software, government capital program tools.

- Aurigo Essentials — capital management for mid-market agencies (50-500
  users, $50M-$500M annual capital spend) without enterprise complexity: core
  project management, vendor/contract management, pre-built federal compliance
  templates, 50+ standard reports, SSO/AD integration. Compare here for
  smaller/simpler public-sector competitors.

EVIDENCE RULES (non-negotiable):
- Competitor facts: only state what is actually present in the SCRAPED
  COMPETITOR SOURCES below. If something cannot be confirmed there, write
  "not confirmed in available sources" — never invent a competitor capability,
  quote, customer, or price.
- Aurigo facts: ground them in the AURIGO KNOWLEDGE BASE excerpts and war-room
  content provided. Do not invent Aurigo capabilities either.
- Answer the actual question directly and briefly: a short feature table or a
  plain list of the top N differences, whichever fits the question. No filler.
- Open with one line naming the Aurigo product compared and why.
- End with a Sources line listing the competitor URLs used.
$agents_seed$,
  '{}'::jsonb
)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  base_prompt = excluded.base_prompt,
  defaults = agents.defaults;

-- ---------------------------------------------------------------------------
-- Seed 2: the 14 PMM sub-agents (§12 roster). name/description/base_prompt are
-- NOT in the update clause: syncAgentBaselines() owns them from the
-- .claude/agents/ files (decision §0.1-3), and a migration re-run must not
-- regress a fresher sync. Descriptions: first descriptive sentence of each
-- file's frontmatter `description:` (identity prefix dropped).
-- Build agents (app-architect / ui-engineer / qa-reviewer) are excluded —
-- engineering tooling, not §12 roster.
-- ---------------------------------------------------------------------------

insert into agents (key, kind, grp, name, description) values
('voice-of-market', 'pmm', 'A', 'Voice of Market (A1)',
 'Identifies buyer needs, objections, trends, and messaging gaps from call transcripts, customer interviews, and support tickets, and translates them into GTM and roadmap implications.'),
('icp-persona', 'pmm', 'A', 'ICP & Persona Intelligence (A2)',
 'Refines target segments and buyer personas using customer, usage, and opportunity data, applying the JTBD framework alongside traditional persona methods.'),
('competitive-intel', 'pmm', 'A', 'Competitive Intelligence (A3)',
 'Tracks competitor moves — pricing pages, release notes, G2 reviews, job postings, analyst reports — and translates them into positioning and sales implications.'),
('win-loss', 'pmm', 'A', 'Win/Loss Intelligence (A4)',
 'Identifies why deals are won, lost, or stalled using interview data and CRM analysis, surfacing buyer language, decision drivers, trust signals, and objections.'),
('customer-evidence', 'pmm', 'A', 'Customer Evidence (A5)',
 'Surfaces validated proof points, measurable outcomes, reference candidates, and case-study opportunities, tracked by persona, segment, and use case.'),
('product-to-market', 'pmm', 'B', 'Product-to-Market Translator (B6)',
 'Converts product updates into buyer problem, business value, differentiation, and messaging — applying the positioning → messaging → copy chain, the value-proposition schema, and the 7-step narrative arc.'),
('launch-orchestration', 'pmm', 'B', 'Launch Orchestration (B7)',
 'Recommends launch tier, then builds the full launch plan — audience, deliverables, owners, dependencies, readiness, channel mix, AEO — emitted into the GTM-War-Room/ACTIVE-LAUNCHES tree.'),
('sales-enablement', 'pmm', 'B', 'Sales & Deal Enablement (B8)',
 'Produces opportunity-specific messaging, discovery questions, objection handling, proof points, battlecards on a continuous update loop, deal narratives via the 7-step arc, champion leave-behinds, and business-case calculators.'),
('adoption-expansion', 'pmm', 'B', 'Adoption & Expansion (B9)',
 'Identifies adoption barriers, expansion opportunities, and required life-cycle messaging; surfaces churn-risk signals and upsell triggers for existing customers.'),
('pricing-packaging', 'pmm', 'B', 'Pricing & Packaging Intelligence (B10)',
 'Identifies packaging gaps, pricing friction, and monetization opportunities by synthesizing competitive pricing signals with willingness-to-pay evidence.'),
('messaging-effectiveness', 'pmm', 'C', 'Messaging Effectiveness (C11)',
 'Measures whether approved messaging is actually used by sales and how buyers respond to it, tracking asset usage rate in deals (% of deals where PMM collateral is utilized).'),
('content-governance', 'pmm', 'C', 'Content Governance (C12)',
 'Flags outdated, inconsistent, unsupported, or incomplete messaging across all assets, running the site-auditor pattern (check copy against positioning-and-icp.md) and backing the PostToolUse voice guard hook with full-inventory audits.'),
('gtm-performance', 'pmm', 'C', 'GTM Performance (C13)',
 'Measures the impact of launches, enablement, messaging, and other PMM initiatives using the cross-functional metric taxonomy (§3.3), tagged leading vs. lagging, and outputs the KPI map — a traceable Company Goal → Key Metrics → KPIs tree.'),
('pmm-prioritization', 'pmm', 'C', 'PMM Prioritization (C14)',
 'Ranks recommended PMM actions by revenue impact, strategic importance, urgency, and effort; applies the OKR cascade (§3.6) and rocks/pebbles/sand sizing (§3.5) against the ~50/25/15/10 allocation; flags un-traceable work as sand and recurring ad-hoc requests for promotion to Always-On.')
on conflict (key) do update set grp = excluded.grp;
