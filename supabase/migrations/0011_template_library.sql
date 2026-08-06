-- Template Library: layout-locked, slot-based templates filled from the latest
-- FINAL messaging doc. Constitution: §3.1 (no final doc -> no generation),
-- §3.2 (messaging is the bridge), §8.4 (outputs enter the draft->final machine).
-- (Blueprint numbered this 0010; 0010_competitive_intel.sql landed first, so it is 0011.)

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

-- ---------- seed templates (blueprint §1.2 — full bodies, fixed UUIDs) ----------
insert into templates (id, name, asset_type, product_line, preview_color, approved,
                       format, audience, persona, funnel_stage, exemplar_path, body, slots)
values
  ('22222222-2222-2222-2222-222222220001', 'Aurigo Datasheet — Overview (US Letter)', 'datasheet',
   'Masterworks', '#015F74', true, 'html',
   'public-sector capital program owners', 'Capital Program / PMO Director', 'consideration',
   'reference output/Output/Masterworks AI/Datasheets/Masterworks AI Overview Datasheet.pdf',
   $tpl$<!doctype html>
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
</html>$tpl$,
   $slots$[
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
]$slots$),
  ('22222222-2222-2222-2222-222222220002', 'Aurigo Banner — LinkedIn 1200x628', 'banner',
   'Masterworks', '#053445', true, 'svg',
   'public-sector capital program owners', 'Capital Program / PMO Director', 'awareness',
   'reference output/Output/Masterworks Sales Enablement/Brochure/Aurigo Masterworks Brochure.pdf',
   $tpl$<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628"
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
</svg>$tpl$,
   $slots$[
 {"id":"kicker","label":"Kicker","purpose":"Why-now context in a few words, reads uppercase","max_chars":36,"required":true,"render":"text","source_sections":["A2"]},
 {"id":"headline_1","label":"Headline line 1","purpose":"First line of the outcome headline; the two lines read as one sentence","max_chars":30,"required":true,"render":"text","source_sections":["B1"]},
 {"id":"headline_2","label":"Headline line 2","purpose":"Second line completing the headline","max_chars":30,"required":true,"render":"text","source_sections":["B1"]},
 {"id":"cta","label":"CTA","purpose":"Short imperative next step","max_chars":22,"required":true,"render":"text","source_sections":["E1"]}
]$slots$),
  ('22222222-2222-2222-2222-222222220003', 'Aurigo Pitch Deck — 6-slide narrative', 'deck',
   'Masterworks', '#46B2BE', true, 'deck',
   'buying committee (economic buyer + users)', 'Capital Program / PMO Director', 'decision',
   'reference output/Output/Masterworks Sales Enablement/Sales Deck/Aurigo Masterworks Sales Deck NEW April 2026.pptx',
   $tpl${
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
}$tpl$,
   $slots$[
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
]$slots$)
on conflict (id) do update set
  name = excluded.name, format = excluded.format, body = excluded.body, slots = excluded.slots,
  audience = excluded.audience, persona = excluded.persona, funnel_stage = excluded.funnel_stage,
  exemplar_path = excluded.exemplar_path, approved = excluded.approved,
  template_version = templates.template_version + 1, updated_at = now();
