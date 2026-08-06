# Blueprint — Template Library & template-driven artifact generation

- **Status:** ready for build (hackathon MVP slice)
- **Date:** 2026-08-06
- **Author:** app-architect
- **Builds on:** `app/docs/blueprints/foundation-questionnaire.md` (shipped — its `messaging_docs` table is the REQUIRED content source here), Aurigo `engineering-playbook/vol-3-architecture/` 03-api / 07-security / 08-authorization / 13-testing, `Aurigo Brand Standards.md`
- **Constitution rules encoded:** §3.1 intelligence-before-activation (generation refuses without a FINAL messaging doc — 409), §3.2 positioning → messaging → copy (every slot fill is sourced from approved messaging-doc sections, never from raw positioning or thin air), §7.4 value-prop schema (pillar/persona slots wire to the C/B2 sections that carry it), §8.1 QA gates (forbidden-words gate on all generated text at finalize; swap-test instruction in the fill prompt), §8.4 draft → PMM-admin approval (generated artifacts enter the existing artifact state machine)
- **Demo value props served:** 90% faster asset creation (pick template → customer-ready datasheet/banner/deck in one call), 100% messaging consistency (layout locked in the template; text only from the approved doc), 3–5× PMM leverage (one messaging doc fans out to every artifact type)

---

## 0. What this ships

A library of **layout-locked, slot-based templates** that Claude fills from the latest **final** Positioning & Messaging document, plus a deterministic renderer that merges fills into customer-ready artifacts. Generated artifacts enter the **existing** artifact lifecycle (draft → in_review → final → export) — this extends the Studio/artifacts flow, it does not fork it.

**Architecture principles (agreed with the PMM admin — encoded, not re-litigated):**

1. Layout lives in text-native templates with named slots. Claude fills slots ONLY. A deterministic renderer produces the final file. The model never reproduces layout.
2. Formats: datasheet/one-pager/brochure = HTML+CSS with `{{named_slots}}`; banner/social = SVG with named text elements + strict char limits; pitch deck = JSON slide schema + HTML/CSS slide master rendered as an HTML deck; email = HTML with subject/opener/proof/cta slots; battlecard/case-study = markdown+frontmatter (existing repo convention).
3. Every template carries metadata (artifact type, audience, persona, funnel stage), per-slot constraints (max chars, required, render mode), the **wiring** (which `fq_sections` ids A1–F5 feed each slot), and a pointer to a gold-standard exemplar under `reference output/Output/`.
4. Generation: pick template → backend loads the latest `messaging_docs` row with `status='final'` for the product (drafts refused — 409 if none) → Claude returns a JSON slot payload → deterministic max-chars validation (over-limit = one retry with explicit trim instruction, then hard-fail that slot with a visible warning) → renderer merges → artifact born `draft` in the existing library.
5. Brand enforcement lives in the template (locked CSS/SVG per `Aurigo Brand Standards.md`: Dark Teal `#015F74`, Roboto, sharp corners — `border-radius: 0` everywhere), not in the prompt. The forbidden-words gate still runs on generated text at approval.

### Survey findings the design leans on (verified in code)

| Existing piece | File | Bearing on this design |
|---|---|---|
| `templates` table (0002): `id, name, asset_type, product_line, preview_color, canva_id, approved, created_at`; FK'd from `artifacts.template_id` | `supabase/migrations/0002_platform.sql` | **Extend this table** (additive columns), never a parallel one — artifacts already point at it; Studio already lists it |
| Studio generation: synchronous `ask()` → `checkForbiddenWords` → insert `artifacts` (status `draft`, `template_id`, `prompt_id`) + `artifact_versions` v1 → `logActivity` | `app/backend/src/routes/studio.ts` | Generation endpoint mirrors this flow exactly; template-driven path just replaces the free-form prompt with slot filling + rendering |
| Artifact lifecycle: `draft → in_review → final → archived`, admin-only `POST /:id/status`, forbidden-words gate blocks `final`, `canRead`/`canEdit`, `flatten()` join style, `{error}` bodies | `app/backend/src/routes/artifacts.ts` | Approval boundary reused untouched (§8.4, vol-3 08) |
| Sanitizer allow-list has **no** `svg`, `img`, `div`, `style`, or `class` attrs | `app/backend/src/services/html.ts` | Rendered payloads (full-CSS datasheet, SVG, deck) **cannot** ride in `artifact_versions.content_html`. Decision recorded in §0.1: raw payloads live in a new `artifact_renders` table; `content_html` carries a sanitized text digest so the guard, diff, and library UI keep working; previews render in a sandboxed iframe — `html.ts` is not touched |
| `wrapExportHtml` + `exportFinals` export finals as styled HTML to the Output folder | `app/backend/src/services/localFolders.ts` | `exportFinals` gets a small branch: finals with a render row export the **raw payload** with the right extension (`.html`/`.svg`/`.md`) |
| `messaging_docs.sections` jsonb = `[{id:'A1', title, markdown}]`; one `final` per product at a time (approval archives the previous) | `supabase/migrations/0009_foundation_questionnaire.sql`, `services/messagingDoc.ts` | Slot wiring targets these exact section ids; "latest final" = `status='final'` order by `version desc limit 1` |
| `fq_sections` registry: text PKs `A1…F5` | migration 0009 | The wiring vocabulary. Template save validates `source_sections` against this table (drift defense, §7) |
| `parseModelJson<T>(raw)` (fence-strip + brace-slice + parse) | `app/backend/src/services/questionnaire.ts:160` | Reused for the slot-fill JSON parse — do not duplicate |
| `ask(userPrompt, {extraContext, maxTokens})` — brand DNA as cached system prefix | `app/backend/src/services/claude.ts` | Messaging-doc sections go in `extraContext`; system prefix stays byte-identical |
| Studio page (type pills → template cards → generate panel), ArtifactEditor (RichEditor + versions + status controls), `apiGet/apiPost` typed helpers, `MAIN_NAV`/`ADMIN_NAV` | `app/frontend/src/pages/Studio.tsx`, `ArtifactEditor.tsx`, `lib/api.ts`, `components/Layout.tsx` | UI patterns to extend (§4) |
| Exemplars: `reference output/Output/Masterworks AI/Datasheets/*.pdf`, `.../Decks/*.pptx`, `Masterworks Sales Enablement/Datasheet|Sales Deck|Brochure/*` | `reference output/Output/` tree | `exemplar_path` seed values (§1.2) — display-only pointers, no file serving in MVP |

**Migration numbering:** 0001–0009 exist. This feature's migration is **`0010_template_library.sql`**.

### 0.1 Decisions recorded (per method step 3 — candidate ADRs when `pmm-playbook/vol-3-architecture/adrs/` is created)

1. **Extend `templates`, don't fork.** New columns are additive and nullable; legacy mock rows (`body is null`) keep the old prompt-driven Studio path working. A template is "generation-ready" iff `body is not null`. *Alternative rejected:* new `artifact_templates` table — would orphan `artifacts.template_id` and split the Studio gallery.
2. **Raw renders in `artifact_renders`, digest in `artifact_versions`.** The sanitizer strips everything a layout needs, and that is correct for editor content — so raw payloads get their own store keyed `(artifact_id, version)`, and `content_html` holds a `cleanHtml`-sanitized slot digest containing **every generated word** (the finalize forbidden-words gate therefore covers template artifacts with zero changes to `artifacts.ts`). *Alternatives rejected:* widening the sanitizer allow-list (security surface for every editor save, vol-3 07); columns on `artifact_versions` (renders are format-typed and warning-carrying — separate concern).
3. **Preview via sandboxed iframe, not sanitizer changes and not `data:` imgs.** Preview/render endpoints return `{format, payload}` JSON through the normal authed `apiGet` (an `<img src>`/iframe URL cannot carry the bearer token); the frontend renders payloads in `<iframe sandbox="" srcDoc={...}>` — no scripts, no same-origin, no top navigation. Defense in depth: slot fills are XML/HTML-escaped by the renderer, and template bodies are stripped of `<script>`, `on*` attributes, `javascript:` URLs, and SVG `<foreignObject>` at save time.
4. **No pptxgenjs for MVP.** Pitch decks render as an HTML deck (one 16:9 `<section>` per slide, print CSS → PDF via browser). Honest demo of the value prop with zero new dependencies and zero pptx layout-mapping surface. Real `.pptx` export via pptxgenjs is V2; `format='deck'` and the slide-schema body are designed so a pptx renderer can be added without touching templates.
5. **Synchronous generation.** One model call (+ at most one retry) — same latency class as the existing Studio generate, which is already synchronous. No run table, no polling. (Contrast with the questionnaire's multi-call background passes.)
6. **Template versioning: an integer, not a history table.** `template_version` bumps on every admin edit; each render records the `(template_id, template_version)` it was produced with, so provenance is auditable. Full body history is V2 (git-style diffing of templates has no demo value).

---

## 1. Migration `supabase/migrations/0010_template_library.sql`

```sql
-- Template Library: layout-locked, slot-based templates filled from the latest
-- FINAL messaging doc. Constitution: §3.1 (no final doc -> no generation),
-- §3.2 (messaging is the bridge), §8.4 (outputs enter the draft->final machine).

-- ---------- extend the existing templates table (0002) ----------
alter table templates add column if not exists format text
  check (format in ('html', 'svg', 'deck', 'email', 'markdown'));
alter table templates add column if not exists body text;              -- the layout source ({{slot}} placeholders; deck = JSON)
alter table templates add column if not exists slots jsonb not null default '[]';
  -- [{id, label, purpose, max_chars, required, render:'text'|'multiline'|'lines',
  --   max_lines?, source_sections:['B1',...]}]
alter table templates add column if not exists audience text;          -- e.g. 'public-sector owners'
alter table templates add column if not exists persona text;           -- e.g. 'Capital Program Director'
alter table templates add column if not exists funnel_stage text
  check (funnel_stage in ('awareness', 'consideration', 'decision', 'expansion') or funnel_stage is null);
alter table templates add column if not exists exemplar_path text;     -- pointer under "reference output/Output/"
alter table templates add column if not exists template_version int not null default 1;
alter table templates add column if not exists updated_at timestamptz not null default now();
alter table templates add column if not exists created_by uuid references profiles(id);

-- ---------- rendered outputs (raw payloads; digest stays in artifact_versions) ----------
create table if not exists artifact_renders (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  version int not null,                     -- matches artifact_versions.version
  format text not null check (format in ('html', 'svg', 'deck', 'email', 'markdown')),
  payload text not null,                    -- the rendered file content (deck: assembled HTML deck)
  slot_fills jsonb not null default '{}',   -- {slot_id: text} as validated/rendered
  warnings jsonb not null default '[]',     -- [{slot_id, kind:'over_limit'|'missing'|'empty_section', detail}]
  template_id uuid references templates(id) on delete set null,
  template_version int,
  messaging_doc_id uuid references messaging_docs(id) on delete set null,  -- provenance: which final doc fed it
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (artifact_id, version)
);

alter table artifact_renders enable row level security;
-- (Backend service-role is the only client — same posture as 0002/0009.)
```

### 1.1 Slot jsonb schema (documented contract, enforced by `validateTemplateDefinition` in §3)

```jsonc
{
  "id": "headline",              // ^[a-z][a-z0-9_]*$ — must appear as {{headline}} in body (html/svg/email/markdown)
                                 // or be referenced by a deck slide's html fragment
  "label": "Headline",           // shown in the slot editor and the digest
  "purpose": "Outcome-led headline opening from the reader's world",  // fed verbatim to the model
  "max_chars": 60,               // HARD limit — deterministic validator, not model judgment
  "required": true,              // required + unfillable => visible placeholder warning in the render
  "render": "text",              // 'text' single line | 'multiline' paragraphs -> <br>/<p> | 'lines' -> one <li>/row per line
  "max_lines": 6,                // only for render:'lines'
  "source_sections": ["B1"]      // fq_sections ids — validated against the registry at save time
}
```

### 1.2 Seed templates (full bodies — dollar-quoted in the migration, fixed UUIDs, `on conflict (id) do update`)

```sql
insert into templates (id, name, asset_type, product_line, preview_color, approved,
                       format, audience, persona, funnel_stage, exemplar_path, body, slots)
values
  ('22222222-2222-2222-2222-222222220001', 'Aurigo Datasheet — Overview (US Letter)', 'datasheet',
   'Masterworks', '#015F74', true, 'html',
   'public-sector capital program owners', 'Capital Program / PMO Director', 'consideration',
   'reference output/Output/Masterworks AI/Datasheets/Masterworks AI Overview Datasheet.pdf',
   $tpl$ ...datasheet body below... $tpl$, $slots$ ...datasheet slots below... $slots$),
  ('22222222-2222-2222-2222-222222220002', 'Aurigo Banner — LinkedIn 1200x628', 'banner',
   'Masterworks', '#053445', true, 'svg',
   'public-sector capital program owners', 'Capital Program / PMO Director', 'awareness',
   'reference output/Output/Masterworks Sales Enablement/Brochure/Aurigo Masterworks Brochure.pdf',
   $tpl$ ...banner body below... $tpl$, $slots$ ...banner slots below... $slots$),
  ('22222222-2222-2222-2222-222222220003', 'Aurigo Pitch Deck — 6-slide narrative', 'deck',
   'Masterworks', '#46B2BE', true, 'deck',
   'buying committee (economic buyer + users)', 'Capital Program / PMO Director', 'decision',
   'reference output/Output/Masterworks Sales Enablement/Sales Deck/Aurigo Masterworks Sales Deck NEW April 2026.pptx',
   $tpl$ ...deck body below... $tpl$, $slots$ ...deck slots below... $slots$)
on conflict (id) do update set
  name = excluded.name, format = excluded.format, body = excluded.body, slots = excluded.slots,
  audience = excluded.audience, persona = excluded.persona, funnel_stage = excluded.funnel_stage,
  exemplar_path = excluded.exemplar_path, approved = excluded.approved,
  template_version = templates.template_version + 1, updated_at = now();
```

#### Seed 1 — Datasheet (`format='html'`, exemplar: Masterworks AI Overview Datasheet)

Body (`$tpl$ … $tpl$`):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{headline}}</title>
<style>
/* LOCKED LAYOUT — Aurigo Brand Standards 2025. Sharp corners only (no border-radius,
   anywhere, ever). Dark Teal #015F74 for text/headings (ADA), Light Teal #46B2BE
   accents only, Red #EE3135 CTA only. Roboto; Calibri fallback. US Letter. */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
@page { size: Letter; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; border-radius: 0 !important; }
body { font-family: Roboto, Calibri, Arial, sans-serif; color: #383838; background: #fff;
       width: 816px; min-height: 1056px; margin: 0 auto; font-size: 14px; line-height: 1.5; }
.band { background: #015F74; color: #fff; padding: 34px 48px 30px; }
.band .wordmark { font-weight: 900; font-size: 14px; letter-spacing: 3px; margin-bottom: 20px; }
.band h1 { font-family: Roboto; font-weight: 900; font-size: 30px; line-height: 1.15; max-width: 640px; }
.band .sub { margin-top: 10px; font-size: 15px; font-weight: 400; color: #D6DDE1; max-width: 620px; }
.rule { height: 5px; background: #46B2BE; }
main { padding: 30px 48px 24px; }
.hook { font-size: 15px; font-weight: 500; color: #015F74; border-left: 5px solid #46B2BE;
        padding: 4px 0 4px 16px; margin-bottom: 22px; }
h2 { font-weight: 700; font-size: 19px; color: #015F74; margin: 22px 0 8px; }
.pillars { display: flex; gap: 14px; margin: 14px 0 6px; }
.pillar { flex: 1; background: #F0F2F3; padding: 16px 16px 14px; border-top: 4px solid #015F74; }
.pillar h3 { font-weight: 700; font-size: 14px; color: #015F74; margin-bottom: 6px; }
.pillar p { font-size: 12.5px; color: #383838; }
ul.caps { margin: 6px 0 0 18px; }
ul.caps li { margin-bottom: 5px; }
.proof { background: #EAEDF0; padding: 14px 18px; margin-top: 20px; font-size: 13.5px;
         border-left: 5px solid #015F74; }
.cta-band { background: #053445; color: #fff; padding: 20px 48px; display: flex;
            align-items: center; justify-content: space-between; margin-top: 26px; }
.cta-band .cta { font-size: 15px; font-weight: 500; max-width: 540px; }
.cta-band .mark { font-weight: 900; letter-spacing: 3px; font-size: 13px; color: #46B2BE; }
.cta-accent { display: inline-block; width: 40px; height: 5px; background: #EE3135; margin-bottom: 8px; }
</style>
</head>
<body>
  <div class="band">
    <div class="wordmark">AURIGO</div>
    <!-- slot:headline | Outcome-led headline opening from the reader's world | max 60 chars -->
    <h1>{{headline}}</h1>
    <!-- slot:subheadline | One-sentence positioning: for whom, what, unlike what | max 140 chars -->
    <div class="sub">{{subheadline}}</div>
  </div>
  <div class="rule"></div>
  <main>
    <!-- slot:reader_hook | The reader's pain in their own words (cardinal rule: their world first) | max 220 chars -->
    <div class="hook">{{reader_hook}}</div>

    <h2>What it does</h2>
    <!-- slot:overview | Plain-language product overview, first-time-reader clear | max 450 chars | multiline -->
    <div>{{overview}}</div>

    <h2>Why teams choose it</h2>
    <div class="pillars">
      <div class="pillar">
        <!-- slot:pillar_1_title | Value pillar 1 name | max 40 chars -->
        <h3>{{pillar_1_title}}</h3>
        <!-- slot:pillar_1_body | What pillar 1 means for the customer | max 160 chars -->
        <p>{{pillar_1_body}}</p>
      </div>
      <div class="pillar">
        <h3>{{pillar_2_title}}</h3>
        <p>{{pillar_2_body}}</p>
      </div>
      <div class="pillar">
        <h3>{{pillar_3_title}}</h3>
        <p>{{pillar_3_body}}</p>
      </div>
    </div>

    <h2>Key capabilities</h2>
    <!-- slot:capabilities | Named capabilities with their outcome, one per line | max 6 lines x 90 chars | lines -->
    <ul class="caps">{{capabilities}}</ul>

    <!-- slot:proof | Quantified right-to-win proof (scale, adoption, dollar volume) | max 260 chars -->
    <div class="proof">{{proof}}</div>
  </main>
  <div class="cta-band">
    <div>
      <span class="cta-accent"></span>
      <!-- slot:cta | Next step framed as the reader's move | max 120 chars -->
      <div class="cta">{{cta}}</div>
    </div>
    <div class="mark">AURIGO</div>
  </div>
</body>
</html>
```

Slots (`$slots$ … $slots$`):

```json
[
 {"id":"headline","label":"Headline","purpose":"Outcome-led headline opening from the reader's world, not the product","max_chars":60,"required":true,"render":"text","source_sections":["B1"]},
 {"id":"subheadline","label":"Subheadline","purpose":"One-sentence positioning: for whom, what, unlike what","max_chars":140,"required":true,"render":"text","source_sections":["A5","B1"]},
 {"id":"reader_hook","label":"Reader hook","purpose":"The economic buyer's top pain, in language close to their own words","max_chars":220,"required":true,"render":"text","source_sections":["C1"]},
 {"id":"overview","label":"Overview","purpose":"Plain-language description of what the product does day to day","max_chars":450,"required":true,"render":"multiline","source_sections":["B3"]},
 {"id":"pillar_1_title","label":"Pillar 1 title","purpose":"First value pillar name","max_chars":40,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_1_body","label":"Pillar 1 body","purpose":"What pillar 1 means for the customer","max_chars":160,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_2_title","label":"Pillar 2 title","purpose":"Second value pillar name","max_chars":40,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_2_body","label":"Pillar 2 body","purpose":"What pillar 2 means for the customer","max_chars":160,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_3_title","label":"Pillar 3 title","purpose":"Third value pillar name","max_chars":40,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_3_body","label":"Pillar 3 body","purpose":"What pillar 3 means for the customer","max_chars":160,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"capabilities","label":"Key capabilities","purpose":"Named capability + its outcome, one item per line","max_chars":540,"required":true,"render":"lines","max_lines":6,"source_sections":["B5"]},
 {"id":"proof","label":"Proof","purpose":"Quantified proof the right to win is real — numbers exactly as approved","max_chars":260,"required":true,"render":"text","source_sections":["A4"]},
 {"id":"cta","label":"Call to action","purpose":"Concrete next step framed as the reader's move","max_chars":120,"required":true,"render":"text","source_sections":["E2"]}
]
```

#### Seed 2 — Banner (`format='svg'`, LinkedIn 1200×628)

SVG `<text>` does **not** wrap — headline slots are per-line with strict limits (design consequence, see risks §7).

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628"
     font-family="Roboto, Arial, sans-serif">
  <!-- LOCKED LAYOUT — Aurigo Brand Standards. Dark Teal field, Light Teal TechLines,
       white Roboto text, sharp corners, red CTA accent. Text slots only. -->
  <rect width="1200" height="628" fill="#015F74"/>
  <g stroke="#46B2BE" stroke-width="2" opacity="0.35">
    <line x1="740" y1="628" x2="1200" y2="168"/>
    <line x1="800" y1="628" x2="1200" y2="228"/>
    <line x1="860" y1="628" x2="1200" y2="288"/>
    <line x1="920" y1="628" x2="1200" y2="348"/>
  </g>
  <g stroke="#053445" stroke-width="14" opacity="0.5">
    <line x1="980" y1="628" x2="1200" y2="408"/>
  </g>
  <rect x="72" y="92" width="56" height="6" fill="#EE3135"/>
  <!-- slot:kicker | Why-now context line, uppercase | max 36 chars -->
  <text id="slot-kicker" x="72" y="150" fill="#46B2BE" font-size="24" font-weight="500"
        letter-spacing="3">{{kicker}}</text>
  <!-- slot:headline_1 | Headline line 1 (SVG text does not wrap) | max 30 chars -->
  <text id="slot-headline-1" x="72" y="252" fill="#FFFFFF" font-size="58" font-weight="900">{{headline_1}}</text>
  <!-- slot:headline_2 | Headline line 2 | max 30 chars -->
  <text id="slot-headline-2" x="72" y="324" fill="#FFFFFF" font-size="58" font-weight="900">{{headline_2}}</text>
  <g>
    <rect x="72" y="392" width="420" height="64" fill="#EE3135"/>
    <!-- slot:cta | Short imperative CTA | max 22 chars -->
    <text id="slot-cta" x="100" y="433" fill="#FFFFFF" font-size="24" font-weight="700">{{cta}}</text>
  </g>
  <!-- Logo placeholder: approved logo artwork must replace this wordmark before external
       use (Brand Standards: never recreate the logo). Flagged in the render warnings. -->
  <text x="72" y="560" fill="#FFFFFF" font-size="22" font-weight="900" letter-spacing="4">AURIGO</text>
</svg>
```

```json
[
 {"id":"kicker","label":"Kicker","purpose":"Why-now context in a few words, reads uppercase","max_chars":36,"required":true,"render":"text","source_sections":["A2"]},
 {"id":"headline_1","label":"Headline line 1","purpose":"First line of the outcome headline; the two lines read as one sentence","max_chars":30,"required":true,"render":"text","source_sections":["B1"]},
 {"id":"headline_2","label":"Headline line 2","purpose":"Second line completing the headline","max_chars":30,"required":true,"render":"text","source_sections":["B1"]},
 {"id":"cta","label":"CTA","purpose":"Short imperative next step","max_chars":22,"required":true,"render":"text","source_sections":["E1"]}
]
```

#### Seed 3 — Pitch deck (`format='deck'`)

Body is JSON: a slide master (locked CSS) + slides carrying their own HTML fragments with `{{slots}}`. The renderer assembles `master shell + fragments`; layout never comes from the model or the renderer's imagination.

```json
{
  "master": {
    "css": "@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap'); *{margin:0;padding:0;box-sizing:border-box;border-radius:0 !important} body{background:#B4B5B6;font-family:Roboto,Calibri,Arial,sans-serif} section.slide{width:1280px;height:720px;margin:24px auto;background:#fff;position:relative;overflow:hidden;padding:64px 72px;page-break-after:always} .s-dark{background:#015F74;color:#fff} .s-darkest{background:#053445;color:#fff} .kicker{font-size:20px;font-weight:500;letter-spacing:3px;color:#46B2BE;margin-bottom:18px} h1{font-weight:900;font-size:54px;line-height:1.12;color:#015F74;max-width:1000px} .s-dark h1,.s-darkest h1{color:#fff} .sub{margin-top:18px;font-size:24px;color:#D6DDE1;max-width:900px} .cards{display:flex;gap:22px;margin-top:44px} .cardx{flex:1;background:#F0F2F3;border-top:5px solid #015F74;padding:24px;font-size:20px;line-height:1.45;color:#383838} .s-dark .cardx{background:#053445;color:#fff;border-top-color:#46B2BE} .accent{display:inline-block;width:56px;height:6px;background:#EE3135;margin-bottom:16px} .body-lg{margin-top:28px;font-size:24px;line-height:1.5;color:#383838;max-width:1040px} .mark{position:absolute;bottom:28px;right:40px;font-weight:900;letter-spacing:4px;font-size:16px;color:#015F74} .s-dark .mark,.s-darkest .mark{color:#46B2BE} @media print{@page{size:1280px 720px;margin:0} section.slide{margin:0}}",
    "footer_note": "Every deck ends on the CTA slide carrying the wordmark (Brand: closing slide with logo — replace wordmark with approved logo artwork before external use)."
  },
  "slides": [
    {"role": "title", "html": "<section class='slide s-dark'><div class='kicker'>{{s1_kicker}}</div><h1>{{s1_title}}</h1><div class='sub'>{{s1_subtitle}}</div><div class='mark'>AURIGO</div></section>"},
    {"role": "problem", "html": "<section class='slide'><span class='accent'></span><h1>{{s2_headline}}</h1><div class='cards'><div class='cardx'>{{s2_pain_1}}</div><div class='cardx'>{{s2_pain_2}}</div><div class='cardx'>{{s2_pain_3}}</div></div><div class='mark'>AURIGO</div></section>"},
    {"role": "solution", "html": "<section class='slide'><span class='accent'></span><h1>{{s3_headline}}</h1><div class='body-lg'>{{s3_body}}</div><div class='cards'><div class='cardx'>{{s3_pillar_1}}</div><div class='cardx'>{{s3_pillar_2}}</div><div class='cardx'>{{s3_pillar_3}}</div></div><div class='mark'>AURIGO</div></section>"},
    {"role": "proof", "html": "<section class='slide s-dark'><div class='kicker'>PROOF</div><h1>{{s4_headline}}</h1><div class='cards'><div class='cardx'>{{s4_proof_1}}</div><div class='cardx'>{{s4_proof_2}}</div><div class='cardx'>{{s4_proof_3}}</div></div><div class='mark'>AURIGO</div></section>"},
    {"role": "differentiation", "html": "<section class='slide'><span class='accent'></span><h1>{{s5_headline}}</h1><div class='cards'><div class='cardx'>{{s5_diff_1}}</div><div class='cardx'>{{s5_diff_2}}</div><div class='cardx'>{{s5_diff_3}}</div></div><div class='mark'>AURIGO</div></section>"},
    {"role": "cta", "html": "<section class='slide s-darkest'><div class='kicker'>NEXT STEP</div><h1>{{s6_headline}}</h1><div class='sub'>{{s6_next_step}}</div><div class='mark'>AURIGO</div></section>"}
  ]
}
```

```json
[
 {"id":"s1_kicker","label":"Title kicker","purpose":"Audience/category framing line","max_chars":40,"required":true,"render":"text","source_sections":["A2"]},
 {"id":"s1_title","label":"Deck title","purpose":"Umbrella message as the deck title","max_chars":60,"required":true,"render":"text","source_sections":["B1"]},
 {"id":"s1_subtitle","label":"Subtitle","purpose":"Positioning one-liner under the title","max_chars":120,"required":true,"render":"text","source_sections":["A5"]},
 {"id":"s2_headline","label":"Problem headline","purpose":"The customer's situation in their world (why now)","max_chars":60,"required":true,"render":"text","source_sections":["A2"]},
 {"id":"s2_pain_1","label":"Pain 1","purpose":"Economic buyer's top pain, close to their own words","max_chars":110,"required":true,"render":"text","source_sections":["C1"]},
 {"id":"s2_pain_2","label":"Pain 2","purpose":"Finance/budget owner's top pain","max_chars":110,"required":true,"render":"text","source_sections":["C2"]},
 {"id":"s2_pain_3","label":"Pain 3","purpose":"Primary user's top pain","max_chars":110,"required":true,"render":"text","source_sections":["C3"]},
 {"id":"s3_headline","label":"Solution headline","purpose":"What changes for the customer","max_chars":60,"required":true,"render":"text","source_sections":["B1","B3"]},
 {"id":"s3_body","label":"Solution body","purpose":"Plain-language what-it-does statement","max_chars":260,"required":true,"render":"text","source_sections":["B3"]},
 {"id":"s3_pillar_1","label":"Pillar 1","purpose":"Value pillar + what it means, compressed","max_chars":90,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"s3_pillar_2","label":"Pillar 2","purpose":"Value pillar + what it means, compressed","max_chars":90,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"s3_pillar_3","label":"Pillar 3","purpose":"Value pillar + what it means, compressed","max_chars":90,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"s4_headline","label":"Proof headline","purpose":"Scale/adoption claim as a headline","max_chars":40,"required":true,"render":"text","source_sections":["A4"]},
 {"id":"s4_proof_1","label":"Proof 1","purpose":"Quantified proof point, numbers exactly as approved","max_chars":130,"required":true,"render":"text","source_sections":["A4"]},
 {"id":"s4_proof_2","label":"Proof 2","purpose":"Quantified proof point","max_chars":130,"required":true,"render":"text","source_sections":["A4"]},
 {"id":"s4_proof_3","label":"Proof 3","purpose":"Quantified proof point","max_chars":130,"required":false,"render":"text","source_sections":["A4","B7"]},
 {"id":"s5_headline","label":"Differentiation headline","purpose":"Right-to-win framing","max_chars":40,"required":true,"render":"text","source_sections":["D1"]},
 {"id":"s5_diff_1","label":"Differentiator 1","purpose":"Us vs alternatives, one contrast","max_chars":120,"required":true,"render":"text","source_sections":["D1","A4"]},
 {"id":"s5_diff_2","label":"Differentiator 2","purpose":"Us vs alternatives, one contrast","max_chars":120,"required":true,"render":"text","source_sections":["D1","A4"]},
 {"id":"s5_diff_3","label":"Differentiator 3","purpose":"Us vs alternatives, one contrast","max_chars":120,"required":true,"render":"text","source_sections":["D1","A4"]},
 {"id":"s6_headline","label":"CTA headline","purpose":"The advance, framed as the reader's move","max_chars":70,"required":true,"render":"text","source_sections":["E2"]},
 {"id":"s6_next_step","label":"Next step","purpose":"Concrete next step with what the customer gets from it","max_chars":140,"required":true,"render":"text","source_sections":["E2"]}
]
```

**Email and battlecard formats** are defined by the format registry (email = HTML with `subject`/`opener`/`proof`/`cta` slot convention; battlecard/case-study = markdown+frontmatter with `{{slots}}`, exported `.md` per repo convention). No seeds in 0010 — PMM admins create them in the Template Library UI; three seeds are enough to demo every renderer path (html, svg, deck). Recorded as an open decision (§8).

---

## 2. API contract

Mount: `app.use("/api/templates", templatesRouter)` in `app/backend/src/index.ts`. Error bodies are `{ "error": string }` (03-api-standards). Reads are `requireAuth`; **all writes are `requireAuth + requireAdmin`** — templates are the brand-enforcement mechanism, so authoring them is the PMM admin's boundary (vol-3 08). Generation is `requireAuth` (any role can draft, matching the existing Studio; approval stays admin — §8.4).

| # | Method + path | Auth | Request | Response |
|---|---|---|---|---|
| 1 | `GET /api/templates?asset_type=&format=` | auth | — | `200 {templates:[{id,name,asset_type,format,product_line,preview_color,audience,persona,funnel_stage,exemplar_path,template_version,approved,generation_ready}]}` — `generation_ready = body is not null`; non-admins see `approved=true` only; body/slots excluded from list |
| 2 | `GET /api/templates/:id` | auth | — | `200 {template:{…all columns incl. body, slots}}`. Non-admin + unapproved → `404` |
| 3 | `POST /api/templates` | admin | `{name, asset_type, format, body, slots, product_line?, audience?, persona?, funnel_stage?, exemplar_path?, preview_color?}` | `201 {template}`. `400 {error, issues:[string]}` from `validateTemplateDefinition`: unknown format; body/slot placeholder mismatch (slot without `{{id}}` or `{{id}}` without slot); bad slot ids; `source_sections` not in `fq_sections`; deck body not valid JSON / slide fragment references unknown slot. Body stored **after** `sanitizeTemplateBody` |
| 4 | `PUT /api/templates/:id` | admin | same partial | `200 {template}` with `template_version` incremented and `updated_at` set. Same 400 validation. `approved` togglable here (no separate endpoint) |
| 5 | `DELETE /api/templates/:id` | admin | — | `200 {ok:true}` (`artifacts.template_id` is `on delete set null` — history survives) |
| 6 | `GET /api/templates/:id/preview` | auth | — | `200 {format, payload}` — template rendered with deterministic placeholder fills (`«Headline — max 60 chars»`); frontend shows it in a sandboxed iframe. `422 {error:"This template has no layout body yet."}` for legacy rows |
| 7 | `POST /api/templates/:id/generate` | auth | `{product_id, title, extra_brief?}` | `201 {artifactId, guard:{ok,violations}, warnings:[{slot_id,kind,detail}], messagingDocVersion}`. **`409 {error:"No approved messaging document for this product. Generate and approve one in the Foundation Questionnaire first — template generation only runs from a final doc."}`** when no `messaging_docs` row with `status='final'` exists (§3.1 gate — drafts never qualify). `422` if template not generation-ready or not approved. `400` missing product_id/title. `404` template/product. `502 {error:"Slot filling failed: <reason>. Nothing was created — try again."}` on unrecoverable model/JSON failure (no degraded scaffold: a half-filled locked layout is worse than no artifact) |
| 8 | `GET /api/artifacts/:id/render?version=` | auth (canRead) | — | `200 {render:{format,payload,slot_fills,warnings,template_id,template_version,messaging_doc_id}}`; `404 {error:"No render for this artifact"}` for classic artifacts (frontend falls back to RichEditor) |
| 9 | `POST /api/artifacts/:id/slots` | auth (canEdit) | `{fills:{slot_id:text}, note?}` | `201 {version}` — deterministic re-validate (no model call) → `400 {error, over:[{slot_id,chars,max}]}` on limit breach → re-render → new `artifact_versions` row (digest) + `artifact_renders` row; `logActivity("artifact", id, user, "slots_edited", {slots:[…]})`. `409` if the artifact has no render or its template was deleted |

Empty states: #1 → `{templates:[]}` renders the "no templates yet — PMM admins create them here" card; #7 against a product with a final doc but an empty wired section still succeeds with `warnings:[{slot_id,kind:'empty_section',…}]` and visible placeholders.

Also **extended (not new)**: `GET /api/artifacts/:id` response gains `hasRender: boolean` (one exists-query) so the editor page knows which surface to mount before fetching the payload.

---

## 3. Service design

### 3.1 `app/backend/src/services/templateRender.ts` (new — pure, deterministic, unit-testable per vol-3 13)

```ts
export type TemplateFormat = "html" | "svg" | "deck" | "email" | "markdown";
export interface TemplateSlot {
  id: string; label: string; purpose: string; max_chars: number; required: boolean;
  render: "text" | "multiline" | "lines"; max_lines?: number; source_sections: string[];
}
export interface RenderWarning { slot_id: string; kind: "over_limit" | "missing" | "empty_section"; detail: string }

/** Template-save validation (route #3/#4). Returns human-readable issues; [] = valid.
 *  Checks: slot id regex; unique ids; placeholder<->slot parity ({{id}} scan for
 *  html/svg/email/markdown; slide-fragment scan for deck); max_chars 1..2000;
 *  render enum; source_sections ⊆ fq_sections ids (passed in by the route);
 *  deck body parses as {master:{css}, slides:[{role, html}]}. */
export function validateTemplateDefinition(format: TemplateFormat, body: string, slots: TemplateSlot[], knownSectionIds: string[]): string[];

/** Defense in depth on admin-authored layout: strip <script>…</script>, on*="…"
 *  attributes, javascript: URLs, and (svg) <foreignObject>. Applied at save; the
 *  sandboxed iframe is the second wall. Deck: applied to master.css container shell
 *  and each slide fragment. */
export function sanitizeTemplateBody(format: TemplateFormat, body: string): string;

/** Deterministic char/line validation — model judgment is never the only defense.
 *  over: fills exceeding max_chars (or max_lines for render:'lines'). */
export function validateFills(slots: TemplateSlot[], fills: Record<string, string>):
  { ok: Record<string, string>; over: { slot_id: string; chars: number; max: number }[]; missing: string[] };

/** Escape + shape one fill for its host format:
 *  html/deck/email: HTML-escape; 'multiline' -> paragraphs joined with <br>;
 *  'lines' -> `<li>…</li>` per non-empty line (li is in the template's ul/ol).
 *  svg: XML-escape, newlines collapsed to spaces (svg text cannot wrap).
 *  markdown: escape '|' (table safety) and leading '#'. */
export function escapeForFormat(format: TemplateFormat, slot: TemplateSlot, text: string): string;

/** Merge fills into the template. Every {{id}} replaced; required-but-empty slots get
 *  the visible placeholder "⚠ [<label>] — needs PMM input" + a 'missing' warning;
 *  optional empties -> "". deck: JSON.parse body, join slide fragments inside
 *  `<!doctype html><html><head><style>{master.css}</style></head><body>…</body></html>`.
 *  Never throws on content; throws only on malformed template body (guarded at save). */
export function renderTemplate(format: TemplateFormat, body: string, slots: TemplateSlot[],
  fills: Record<string, string>): { payload: string; warnings: RenderWarning[] };

/** Placeholder fills for GET /preview: each slot -> `«${label} — max ${max_chars} chars»`
 *  ('lines': max_lines placeholder rows). */
export function placeholderFills(slots: TemplateSlot[]): Record<string, string>;

/** Sanitized digest for artifact_versions.content_html — contains EVERY generated word
 *  so the existing forbidden-words finalize gate covers template artifacts unchanged:
 *  `<h1>{title}</h1><p><em>Generated from "{template}" v{tv} · {product} Messaging Doc v{dv}</em></p>`
 *  then per slot `<h3>{label}</h3><p>{fill}</p>`, warnings as a trailing blockquote.
 *  Passed through cleanHtml() before insert. */
export function buildDigestHtml(title: string, meta: {templateName: string; templateVersion: number; productName: string; docVersion: number},
  slots: TemplateSlot[], fills: Record<string, string>, warnings: RenderWarning[]): string;
```

### 3.2 `app/backend/src/services/templateGenerate.ts` (new — the model-touching half)

```ts
/** status='final' order by version desc limit 1 — drafts NEVER qualify (§3.1). */
export async function getLatestFinalMessagingDoc(productId: string): Promise<MessagingDocRow | null>;

/** Only the sections wired by this template's slots (union of source_sections),
 *  pulled from messaging_docs.sections jsonb, wrapped
 *  `<section id="B1" title="…">{markdown}</section>`. Sections missing or empty in
 *  the doc are skipped here and surface later as 'empty_section' warnings. */
export function wiredSectionsXml(doc: MessagingDocRow, slots: TemplateSlot[]):
  { xml: string; missingSectionIds: string[] };

export function buildSlotFillPrompt(template: TemplateRow, product: ProductRow,
  doc: MessagingDocRow, extraBrief: string | undefined): string;

/** Orchestration for route #7:
 *  load template (+ approved + body checks) -> load product -> getLatestFinalMessagingDoc
 *  (null -> TemplateGenError 409) -> ask(prompt, {extraContext: xml, maxTokens: 8000})
 *  -> parseModelJson<{fills}> (reused from services/questionnaire.ts; one repair retry
 *  "Your previous reply was not valid JSON…", then TemplateGenError 502)
 *  -> validateFills -> if over.length: ONE retry with buildTrimPrompt (only failing
 *  slots) -> re-validate -> still-over slots become fill:"" + over_limit warning
 *  -> renderTemplate -> buildDigestHtml -> cleanHtml -> checkForbiddenWords(digest text)
 *  -> insert artifacts row {title, asset_type: template.asset_type, product_id,
 *  persona: template.persona, status:'draft', template_id, current_version:1, created_by}
 *  -> artifact_versions v1 (digest, note `Generated from template "{name}" v{tv}`)
 *  -> artifact_renders v1 (payload, fills, warnings, template_version, messaging_doc_id)
 *  -> logActivity("artifact", id, user, "generated_from_template", {template, template_version,
 *  messaging_doc_version, warnings: warnings.length, guard_ok}). */
export async function generateFromTemplate(templateId: string, productId: string,
  title: string, extraBrief: string | undefined, userId: string):
  Promise<{ artifactId: string; guard: GuardrailResult; warnings: RenderWarning[]; messagingDocVersion: number }>;

/** Re-render for route #9 (no model): merge submitted fills over stored fills,
 *  validateFills (400 on over — the human gets the real limits, no silent trim),
 *  renderTemplate, new version pair. */
export async function reRenderWithFills(artifactId: string, fills: Record<string, string>,
  note: string | undefined, userId: string): Promise<{ version: number }>;

export class TemplateGenError extends Error { status: number }
```

**Slot-fill prompt (exact draft).** `ask(userPrompt, { extraContext: xml, maxTokens: 8000 })`:

```
You are filling a locked layout template with approved messaging. You control ONLY the
text inside the named slots below — never layout, structure, colors, or anything else.

Product: {product.name} ({product.line} line).
Artifact: {template.asset_type} — "{template.name}".
Audience: {template.audience}. Persona: {template.persona}. Funnel stage: {template.funnel_stage}.
{extra_brief ? `Requester's brief: ${extra_brief}` : ""}

The ADDITIONAL WAR ROOM CONTEXT above contains sections of "{doc.title}" (version
{doc.version}, PMM-approved — the validated messaging for this product), each wrapped
in <section id="..." title="...">. These sections are the ONLY source of facts, claims,
numbers, and customer language for this task. If a slot's wired sections do not support
a strong fill, return "" for that slot — never pad, never invent, never fall back to
general knowledge.

Slots to fill:
{for each slot:
- {id}: {purpose}. Source section(s): {source_sections.join(", ")}. HARD LIMIT {max_chars}
  characters — count them; shorter is fine, longer is rejected by a validator.
  {render==='lines' ? `One item per line, at most ${max_lines} lines.` : "Single line of plain text."}
  {render==='multiline' ? "Short paragraphs separated by blank lines are allowed." : ""}}

Rules:
- Plain text only in every slot: no markdown syntax, no asterisks, no HTML tags.
- Character limits are hard limits. Compress by cutting words and clauses, never facts.
- Open from the reader's world, not from Aurigo or the product (cardinal rule).
- Swap test every sentence: if it would still work with a competitor's name, rewrite it
  around this product's approved unique attributes.
- Numbers, customer names, and certification wording exactly as they appear in the doc.

Return ONLY valid JSON — no fences, no commentary:
{"fills": {"{first_slot_id}": "...", ... one key per slot id listed above}}
```

**Trim-retry prompt (exact draft, sent once when `over.length > 0`):**

```
These slot fills exceeded their hard character limits. Rewrite ONLY the slots listed,
each within its limit. Cut words and clauses — never facts, numbers, or names. Return
ONLY JSON of the form {"fills": {...}} containing exactly these slots and no others.

{for each over item:
- {slot_id}: yours was {chars} characters, the limit is {max}. Your text: "{fill}"}
```

After the retry, any slot still over its limit is **hard-failed**: `fill = ""`, warning `{slot_id, kind:'over_limit', detail:'Fill exceeded N chars after retry — left blank for PMM input.'}` — the render shows the visible `⚠ [label] — needs PMM input` placeholder and the editor's slot panel flags it (requirement: over-limit is never silently truncated; truncation is a copy decision, and the human makes it via route #9).

### 3.3 Route files

- `app/backend/src/routes/templates.ts` (new) — endpoints 1–7. Thin bodies: validate → service → status code, mirroring `artifacts.ts` style. `POST/PUT` fetch `fq_sections` ids once for `validateTemplateDefinition`; every write → `logActivity("template", id, user, action, {name, template_version})`.
- `app/backend/src/routes/artifacts.ts` (edit) — add endpoints 8–9 and the `hasRender` flag on detail. `canRead`/`canEdit` reused verbatim; renders inherit the artifact's visibility (a non-final render is invisible to consumers exactly like its artifact — 08-authorization).

---

## 4. Frontend

### 4.1 Route, nav, helpers (edits)

- `app/frontend/src/main.tsx`: `<Route path="/templates" element={<Templates />} />`.
- `app/frontend/src/components/Layout.tsx`: `MAIN_NAV` gets `{ to: "/templates", label: "Template library", icon: "fa-object-group" }` after "Asset studio" (browse is all-roles; mutations are API-gated regardless of what the UI hides — 08).
- `app/frontend/src/lib/api.ts`: interfaces `TemplateSummary`, `TemplateDetail`, `TemplateSlot`, `RenderWarning`, `ArtifactRender`, `GenerateFromTemplateResponse`; helpers `listTemplates(filters)`, `getTemplate(id)`, `createTemplate(body)`, `updateTemplate(id, body)`, `deleteTemplate(id)`, `previewTemplate(id)`, `generateFromTemplate(id, body)`, `getArtifactRender(artifactId, version?)`, `saveArtifactSlots(artifactId, fills, note?)`.

### 4.2 New page — `app/frontend/src/pages/Templates.tsx` (+ two components)

```
Templates (page; owns filters, template list, selected template)
├── Type filter .step-pills        — All · Datasheet · Banner · Deck · Email · Battlecard · One-pager
├── Template grid (.grid-2 of .template-card, reusing Studio's card styles)
│     name, format .pill, audience/persona line, wiring chips (.filechip per distinct
│     source section id, e.g. B1 B2 C1), exemplar line ("Exemplar: <basename>", title
│     attr = full reference-output path), "Slot-driven" badge when generation_ready,
│     admin-only Edit / Delete .btn-sm; unapproved rows (admin view) get .pill-draft
├── Preview drawer                 — components/TemplatePreview.tsx (see below) fed by
│                                    previewTemplate(id); per-slot table under the frame:
│                                    label · purpose · max chars · wired sections
├── GenerateModal (inline in page) — product <select> (getProducts), title input,
│                                    extra-brief textarea, [Generate draft] .btn-primary
│                                    → generateFromTemplate → on 201 navigate(/library/:id)
│                                    (warnings shown first when non-empty);
│                                    409 → the no-final-doc message + link to /questionnaire
├── TemplateEditor drawer (admin)  — components/TemplateEditor.tsx: metadata fields,
│                                    format <select>, body <textarea> (monospace), slots
│                                    JSON <textarea>, approved toggle, [Validate & save]
│                                    → 400 issues rendered as a list; live preview button
│                                    reuses TemplatePreview against unsaved state? No —
│                                    MVP previews saved state only (flagged V2)
└── Empty state                    — "No templates yet" + admin CTA to create
```

`components/TemplatePreview.tsx` — the one rendering primitive, reused by Templates and ArtifactEditor:

```tsx
// Renders {format, payload} in <iframe sandbox="" srcDoc={payload}
//   style={{width:'100%', aspectRatio: format==='svg' ? '1200/628' : '816/1056', border:'1px solid var(--border)'}} />
// deck: taller frame (each slide stacks); svg payload wrapped in a minimal html shell
// with margin:0 before srcDoc. A [Download] .btn-sm builds a Blob (text/html | image/svg+xml
// | text/markdown) + temporary object URL — works for drafts; finals also land in the
// Output folder via exportFinals.
```

### 4.3 Edits to existing pages

- **`Studio.tsx`**: template cards for the selected asset type now come with `format`/`generation_ready` (list endpoint #1 replaces the studio-templates call, or `studio.ts` GET adds the two columns — pick the former: one list API). Slot-driven templates show the badge; selecting one **skips the prompt-library requirement** and the generate button posts to `generateFromTemplate` (product required, since the messaging doc is per-product — the "whole portfolio" option is disabled with a title explaining why). Legacy templates keep the existing prompt path untouched.
- **`ArtifactEditor.tsx`**: on load, if detail says `hasRender`, fetch `getArtifactRender(id)` and mount the render surface instead of `RichEditor`:
  - `components/SlotFillPanel.tsx` (new): per-slot `textarea` with label, purpose tooltip, live `chars/max` counter (red when over), warning badges (`over_limit` / `missing` / `empty_section`); [Save & re-render] → `saveArtifactSlots` → refresh render + versions (400 over-limit shown per slot).
  - `TemplatePreview` beside it (preview of the selected version; version list panel unchanged — digests still diff via the existing diff endpoint).
  - Status controls, comments, and the finalize forbidden-words 422 flow are **unchanged** — the state machine never forked. AI quick actions (rewrite/shorten/…) are hidden for render artifacts (they operate on editor HTML; slot-level AI assist is V2).

---

## 5. File-by-file change list

**New files**

| Path | Contents |
|---|---|
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\supabase\migrations\0010_template_library.sql` | §1 DDL + the three full seed templates (§1.2) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\templateRender.ts` | §3.1 (pure functions) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\templateGenerate.ts` | §3.2 (model orchestration, prompts) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\routes\templates.ts` | endpoints 1–7 |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\pages\Templates.tsx` | §4.2 page |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\TemplatePreview.tsx` | sandboxed-iframe preview + download |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\TemplateEditor.tsx` | admin create/edit drawer |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\SlotFillPanel.tsx` | slot editor with char counters + warnings |

**Edits**

| Path | Change |
|---|---|
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\index.ts` | import + mount `templatesRouter` at `/api/templates` |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\routes\artifacts.ts` | endpoints 8–9 (`GET /:id/render`, `POST /:id/slots`) + `hasRender` on detail |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\backend\src\services\localFolders.ts` | `exportFinals`: per final, look up `artifact_renders` at `current_version`; if present write raw payload with extension by format (`html`→`.html`, `svg`→`.svg`, `deck`→`-deck.html`, `email`→`.html`, `markdown`→`.md`) instead of the wrapped digest |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\main.tsx` | `/templates` route |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\components\Layout.tsx` | MAIN_NAV entry |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\lib\api.ts` | §4.1 helpers + interfaces |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\pages\Studio.tsx` | slot-driven badge + generate path switch (§4.3) |
| `C:\Users\pradyumna.m\Downloads\Applications\Hackathon\operation-blackbriar\app\frontend\src\pages\ArtifactEditor.tsx` | render-surface mount (§4.3) |

No changes to `html.ts`, `guardrails.ts`, `claude.ts`, `auth.ts`, `questionnaire.ts`, `messagingDoc.ts`, `studio.ts` (legacy path untouched) — reuse as-is. `parseModelJson` is imported from `services/questionnaire.ts`.

---

## 6. Build sequence (each stage ends with a qa-reviewer verification)

1. **Migration 0010.** Run `npm run migrate`. Verify: 3 seed templates present with non-null `body`, valid `slots` JSON, every `source_sections` id exists in `fq_sections`; re-run is idempotent (template_version bumps by design on conflict-update — acceptable, note it); legacy template rows unaffected (`body is null`); existing Studio page still lists templates.
2. **`templateRender.ts` + unit tests.** Deterministic and cheap (vol-3 13) — test: `validateFills` over/missing/lines; `escapeForFormat` (HTML entities; SVG `<`, `&`, quote escaping; newline collapse for svg; `|` escape for markdown); `renderTemplate` leaves zero `{{` in output for all three seeds with full fills; required-empty produces the ⚠ placeholder + warning; deck body assembles 6 `<section>`s; `sanitizeTemplateBody` strips `<script>`, `onload=`, `javascript:`, `<foreignObject>`; `buildDigestHtml` survives `cleanHtml` with all fill text intact.
3. **Templates CRUD + preview (endpoints 1–6).** Verify with curl: non-admin `POST` → 403; create with a `{{ghost}}` placeholder not in slots → 400 listing it; `source_sections:["Z9"]` → 400; `PUT` bumps `template_version`; non-admin list hides unapproved; `GET /preview` on each seed returns a payload with every placeholder label visible and zero `{{`; preview payload for the banner is valid XML.
4. **Generation + render endpoints (7, 8, 9) + export.** Verify: product with **no** final messaging doc (or only a draft) → 409 with the questionnaire guidance — the §3.1 gate; approve a doc → generate succeeds → artifact is `draft`, `artifact_versions` v1 digest contains every slot fill, `artifact_renders` v1 payload has no `{{`, provenance columns set (`template_version`, `messaging_doc_id`); plant a banned word in an accepted answer feeding B1 and regenerate the doc chain → artifact finalize returns the existing 422; over-limit simulation (temporarily set a slot `max_chars: 5`) → warning recorded, ⚠ placeholder in payload, slot blank; `POST /:id/slots` with an over-limit fill → 400 with `{slot_id, chars, max}`; with a valid fill → new version pair and updated payload; non-creator non-admin cannot read a draft render (403) or edit slots; final artifact exports to the Output folder with the correct extension and opens in a browser looking like the exemplar class (datasheet: Letter page, teal band; banner: valid standalone `.svg`; deck: 6 slides, prints 16:9).
5. **Frontend.** Verify: /templates browse + filter + preview for all three seeds (sandboxed iframe — confirm `sandbox` attribute present and a template containing `<script>` saved via API renders inert); admin edit round-trip with a validation error surfaced; generate modal 409 path links to /questionnaire; happy path lands in /library/:id showing SlotFillPanel + preview instead of RichEditor; char counter turns red at limit and save is rejected with the per-slot 400; status controls + finalize gate unchanged for both artifact kinds; Studio slot-driven path works and legacy prompt path still works; demo path (final messaging doc → /templates → datasheet → generate → tweak one slot → in_review → final → open exported .html + .svg + deck) completes in one sitting.

---

## 7. Risks and edge cases

| Risk | Handling |
|---|---|
| Slot overflow | Deterministic validator, never model self-judgment: one explicit trim retry (only failing slots), then hard-fail to blank + visible ⚠ placeholder + warning surfaced in the editor and generation response. No silent truncation — trimming copy is a human decision via the slot editor (route #9). |
| SVG / template injection | Three walls: (1) fills are XML/HTML-escaped by `escapeForFormat` — model text can never open a tag; (2) template bodies (admin-authored) are stripped of `<script>`/`on*`/`javascript:`/`<foreignObject>` at save; (3) all previews render in `<iframe sandbox>` — no script execution, no origin, even if 1–2 failed. `html.ts` allow-list is untouched (decision §0.1-3). |
| Template ↔ messaging-doc section drift as the question bank evolves | Wiring vocabulary is the `fq_sections` registry (stable text PKs, `on conflict do update` refresh). Template save validates `source_sections` against the live registry (400 on unknown ids). Generation-time drift (section exists in registry but missing/empty in an older final doc) degrades to `empty_section` warnings + visible placeholders, never invention. If a section id is ever *removed* from the registry, affected templates fail validation on next save — qa-reviewer should re-run stage-3 checks after any 0009-registry change. |
| Missing final messaging doc | 409 with concrete guidance to the Foundation Questionnaire; drafts never qualify — the sign-off gate carries through end to end (§3.1, §8.4). UI links straight to `/questionnaire`. |
| SVG text does not wrap | Encoded structurally: banner headline is two per-line slots with 30-char limits; renderer collapses newlines for svg slots. Char count ≠ pixel width (W vs i) — limits are set conservatively for Roboto Black at the seed font sizes; PMM eyeballs the preview before promoting (the approval gate exists for exactly this). |
| Logo reproduction | Brand Standards forbid recreating the logo; seeds use a locked "AURIGO" wordmark placeholder (banner carries an explicit template comment; deck master notes the closing-slide rule). Real logo assets are an open decision (§8) — until then exported banners/decks are internal-draft quality by policy. |
| Model returns bad JSON / refuses | `parseModelJson` reuse + one repair retry, then 502 with nothing persisted — no degraded scaffold for locked layouts (a broken layout demos worse than a clean error). Studio's legacy scaffold path is unchanged for prompt-driven types. |
| Banned words inside slot fills | Guard runs on the digest at generation (informational, mirrors Studio) and on `content_html` at finalize (blocking, unchanged `artifacts.ts` code path). The digest contains every generated word by construction — verified in stage-2 tests. |
| Legacy templates (body null) | `generation_ready:false`; list/preview degrade gracefully (422 with message); Studio prompt path continues to serve them. No data migration needed. |
| Template deleted after generation | `artifact_renders.template_id` is `on delete set null`; renders and exports keep working (payload is self-contained); slot re-editing returns 409 with "template no longer exists — regenerate from a current template". |
| Renders bloat vs. version history | Payloads are text (~10–60 KB); one row per saved version, same growth profile as `artifact_versions`. Acceptable for MVP; pruning is V2. |

---

## 8. Open decisions for the human

1. **Logo assets.** Seeds ship a locked "AURIGO" wordmark placeholder (Brand rules forbid recreating the logo, and no approved SVG/PNG logo artwork exists in the repo). Options: (a) accept wordmark for the hackathon demo, (b) supply approved logo files to embed as data-URIs in the seed templates. Blueprint assumes (a).
2. **Who can generate.** This design keeps generation `requireAuth` (any role drafts; admin approves), matching today's Studio. If template generation should be admin-only, it is a one-middleware change on endpoint 7 — say the word.
3. **pptxgenjs** — recorded as **no for MVP** (decision §0.1-4, HTML deck instead). Confirm, or V2 it explicitly in the roadmap.
4. **Email / battlecard seed templates** — formats are specified and renderer-supported, but 0010 seeds only datasheet/banner/deck (each exercises a distinct renderer path). Confirm admin-authored-later is acceptable, or ask for a follow-up seed migration.
5. **Exemplar linking** is a display-only path string into `reference output/Output/` (no file serving — those are binary PDFs/PPTX outside `app/`). Confirm, or scope a static file route.
6. **Studio template source switch** (§4.3): Studio's gallery moves to `GET /api/templates`; `studio.ts` GET /templates becomes redundant but is left in place untouched for MVP. Confirm leaving it (removal is a cleanup ticket).

**Proposed (not applied) CLAUDE.md repository-map update:** none required — `app/docs/blueprints/` addition was already proposed in the foundation-questionnaire blueprint and still stands.
