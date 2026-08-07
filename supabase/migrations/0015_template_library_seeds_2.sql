-- Template Library — second seed wave: FAQ, one-pager, brochure, battlecard.
-- Closes the coverage gaps against "reference output/Output" exemplars that the
-- first wave (0011: datasheet/banner/deck) left open. Same contract as 0011:
-- layout-locked bodies with {{slot}} placeholders, slots jsonb validated by
-- validateTemplateDefinition, wiring against the 0009 fq_sections registry.
--
-- Numbering: 0011 seeded the first three templates; 0012_guardrails.sql,
-- 0013_agents.sql, and 0014_positioning_maps.sql were taken by parallel
-- sessions (0014 landed mid-write), so this wave is 0015 — the next free
-- number at commit time.
--
-- approved = true is deliberate for seeds (matching how 0011's seeds shipped):
-- seed templates are the demo-ready starting library, curated against Brand
-- Standards before commit. PMM-authored templates created through the UI start
-- unapproved; only the reviewed seed set ships ready-to-use.
--
-- Fixed UUIDs extend 0011's 22222222-…-222222220001-3 range with 0004-0007 so
-- the insert is idempotent under `npm run migrate` replays (on conflict update).

insert into templates (id, name, asset_type, product_line, preview_color, approved,
                       format, audience, persona, funnel_stage, exemplar_path, body, slots)
values
  ('22222222-2222-2222-2222-222222220004', 'Masterworks AI — Sales FAQ', 'faq',
   'Masterworks', '#015F74', true, 'markdown',
   'sellers and sales engineers (internal reference, buyer-safe language)', 'Account Executive', 'consideration',
   'reference output/Output/Masterworks AI/FAQ/Masterworks AI FAQ.docx',
   $tpl$---
product: Masterworks AI
audience: sellers and sales engineers
persona: Account Executive
stage: draft
sources: [B3, B6, D4, A2, B5]
date: (set at export)
---

# {{faq_title}}

{{intro}}

## Product overview

<!-- slot:q1/a1 | What it is, in plain language | wired B3 -->
**{{q1}}**

{{a1}}

<!-- slot:q2/a2 | The problem it solves and why now | wired A2, B3 -->
**{{q2}}**

{{a2}}

<!-- slot:q3/a3 | Named capabilities and the job each takes on | wired B5 -->
**{{q3}}**

{{a3}}

## Platform and trust

<!-- slot:q4/a4 | How the platform grounds its intelligence | wired B6 -->
**{{q4}}**

{{a4}}

<!-- slot:q5/a5 | Certifications, oversight, and audit posture | wired B6 -->
**{{q5}}**

{{a5}}

## Handling the questions buyers push on

<!-- slot:q6/a6 | The team-replacement worry, answered | wired D4 -->
**{{q6}}**

{{a6}}

<!-- slot:q7/a7 | The accuracy and auditability worry, answered | wired D4 -->
**{{q7}}**

{{a7}}

## Getting started

<!-- slot:q8/a8 | Deployment path and the start-small motion | wired B6, B5 -->
**{{q8}}**

{{a8}}
$tpl$,
   $slots$[
 {"id":"faq_title","label":"FAQ title","purpose":"Document title naming the product and the sales audience, like the exemplar's product-name-plus-Sales-FAQ header","max_chars":70,"required":true,"render":"text","source_sections":["B3"]},
 {"id":"intro","label":"Intro line","purpose":"One sentence on what this FAQ covers and how sellers should use it","max_chars":200,"required":true,"render":"text","source_sections":["B3"]},
 {"id":"q1","label":"Q1 — what it is","purpose":"The plain what-is-this-product question a first-time buyer asks","max_chars":90,"required":true,"render":"text","source_sections":["B3"]},
 {"id":"a1","label":"A1 — what it is","purpose":"What the product does day to day, first-time-reader clear, no jargon","max_chars":480,"required":true,"render":"multiline","source_sections":["B3"]},
 {"id":"q2","label":"Q2 — problem solved","purpose":"The what-problem-does-it-solve question","max_chars":90,"required":true,"render":"text","source_sections":["A2"]},
 {"id":"a2","label":"A2 — problem solved","purpose":"The buyer's situation and why-now drivers, then what the product changes about it","max_chars":480,"required":true,"render":"multiline","source_sections":["A2","B3"]},
 {"id":"q3","label":"Q3 — capabilities","purpose":"Question asking what the product can actually do","max_chars":90,"required":true,"render":"text","source_sections":["B5"]},
 {"id":"a3","label":"A3 — capabilities","purpose":"Named capabilities with the specific job each one takes on for the team","max_chars":540,"required":true,"render":"multiline","source_sections":["B5"]},
 {"id":"q4","label":"Q4 — platform","purpose":"Question about how the underlying platform works or what grounds the intelligence","max_chars":90,"required":true,"render":"text","source_sections":["B6"]},
 {"id":"a4","label":"A4 — platform","purpose":"How the platform grounds answers in domain and program context — the facts that separate it from generic tools","max_chars":480,"required":true,"render":"multiline","source_sections":["B6"]},
 {"id":"q5","label":"Q5 — trust","purpose":"The security, governance, or certification question a cautious buyer asks","max_chars":90,"required":true,"render":"text","source_sections":["B6"]},
 {"id":"a5","label":"A5 — trust","purpose":"Certifications, access controls, audit trails, and human review — stated exactly as approved","max_chars":440,"required":true,"render":"multiline","source_sections":["B6"]},
 {"id":"q6","label":"Q6 — objection: my team","purpose":"The will-this-replace-my-team objection, phrased the way buyers say it","max_chars":90,"required":true,"render":"text","source_sections":["D4"]},
 {"id":"a6","label":"A6 — objection: my team","purpose":"The approved counter: capacity extended, humans decide, institutional knowledge kept","max_chars":420,"required":true,"render":"multiline","source_sections":["D4"]},
 {"id":"q7","label":"Q7 — objection: accuracy","purpose":"The how-do-we-trust-the-answers objection, phrased the way buyers say it","max_chars":90,"required":true,"render":"text","source_sections":["D4"]},
 {"id":"a7","label":"A7 — objection: accuracy","purpose":"The approved counter: citations, confidence, approval gates, complete audit trail","max_chars":440,"required":true,"render":"multiline","source_sections":["D4"]},
 {"id":"q8","label":"Q8 — getting started","purpose":"The how-do-we-start question: deployment effort and first step","max_chars":90,"required":true,"render":"text","source_sections":["B6"]},
 {"id":"a8","label":"A8 — getting started","purpose":"Deployment path and the start-small-then-expand motion, with effort honestly stated","max_chars":400,"required":true,"render":"multiline","source_sections":["B6","B5"]}
]$slots$),
  ('22222222-2222-2222-2222-222222220005', 'Aurigo One-Pager — Leave-Behind (US Letter)', 'one-pager',
   'Masterworks', '#46B2BE', true, 'html',
   'public-sector capital program owners', 'Capital Program / PMO Director', 'decision',
   'reference output/Output/Masterworks Sales Enablement/Datasheet/Masterworks leavebehind _updated.pdf',
   $tpl$<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{headline}}</title>
<style>
/* LOCKED LAYOUT — Aurigo Brand Standards 2025. Leave-behind: one US Letter page
   a champion can hand to their leadership. Sharp corners only. Dark Teal #015F74
   headings, Light Teal #46B2BE accents, Red #EE3135 CTA only. Roboto; Calibri fallback. */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
@page { size: Letter; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; border-radius: 0 !important; }
body { font-family: Roboto, Calibri, Arial, sans-serif; color: #383838; background: #fff;
       width: 816px; min-height: 1056px; margin: 0 auto; font-size: 14px; line-height: 1.5; }
.hero { background: #015F74; color: #fff; padding: 40px 48px 34px; }
.hero .wordmark { font-weight: 900; font-size: 14px; letter-spacing: 3px; margin-bottom: 24px; }
.hero h1 { font-weight: 900; font-size: 34px; line-height: 1.12; max-width: 620px; }
.hero .trust { margin-top: 16px; font-size: 14px; font-weight: 500; color: #46B2BE;
               letter-spacing: 1px; }
.rule { height: 5px; background: #46B2BE; }
main { padding: 30px 48px 24px; }
h2 { font-weight: 700; font-size: 18px; color: #015F74; margin: 0 0 12px; }
.advantage { display: flex; gap: 14px; margin-bottom: 26px; }
.advantage .card { flex: 1; background: #F0F2F3; padding: 18px 16px; border-top: 4px solid #015F74;
                   font-size: 13px; line-height: 1.5; }
.strip { background: #053445; color: #fff; padding: 18px 48px; }
.strip h2 { color: #46B2BE; font-size: 13px; letter-spacing: 2px; text-transform: uppercase;
            margin-bottom: 10px; }
.strip ul { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 22px; }
.strip li { font-size: 12.5px; font-weight: 500; padding-left: 14px; position: relative; }
.strip li::before { content: ""; position: absolute; left: 0; top: 6px; width: 6px; height: 6px;
                    background: #46B2BE; }
.proof-band { margin: 26px 48px 0; background: #EAEDF0; border-left: 5px solid #015F74;
              padding: 16px 18px; font-size: 14px; font-weight: 500; color: #015F74; }
.cta-band { background: #015F74; color: #fff; padding: 22px 48px; margin-top: 28px;
            display: flex; align-items: center; justify-content: space-between; }
.cta-band .cta { font-size: 15px; font-weight: 500; max-width: 540px; }
.cta-band .cta::before { content: ""; display: block; width: 40px; height: 5px;
                         background: #EE3135; margin-bottom: 8px; }
.cta-band .mark { font-weight: 900; letter-spacing: 3px; font-size: 13px; color: #46B2BE; }
</style>
</head>
<body>
  <div class="hero">
    <div class="wordmark">AURIGO</div>
    <!-- slot:headline | Outcome-led headline in the reader's world (exemplar: unlock the program's full potential) | max 60 chars -->
    <h1>{{headline}}</h1>
  </div>
  <div class="rule"></div>
  <main>
    <h2>Why owners choose it</h2>
    <div class="advantage">
      <!-- slot:value_1..3 | Advantage pairs: the outcome, then what it means for the program | max 170 chars each -->
      <div class="card">{{value_1}}</div>
      <div class="card">{{value_2}}</div>
      <div class="card">{{value_3}}</div>
    </div>
  </main>
  <div class="strip">
    <h2>What it covers</h2>
    <!-- slot:capabilities | Capability strip: named capability areas, one per line | max 6 lines -->
    <ul>{{capabilities}}</ul>
  </div>
  <!-- slot:proof | Adoption and scale proof, numbers exactly as approved | max 200 chars -->
  <div class="proof-band">{{proof}}</div>
  <div class="cta-band">
    <!-- slot:cta | Next step framed as the reader's move | max 120 chars -->
    <div class="cta">{{cta}}</div>
    <div class="mark">AURIGO</div>
  </div>
</body>
</html>$tpl$,
   $slots$[
 {"id":"headline","label":"Headline","purpose":"Outcome-led headline opening from the owner's world, like the exemplar's unlock-your-capital-program line","max_chars":60,"required":true,"render":"text","source_sections":["B1"]},
 {"id":"value_1","label":"Advantage 1","purpose":"First advantage pair: the outcome named in a few words, then what it means for the program","max_chars":170,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"value_2","label":"Advantage 2","purpose":"Second advantage pair: outcome plus what it means for the program","max_chars":170,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"value_3","label":"Advantage 3","purpose":"Third advantage pair: outcome plus what it means for the program","max_chars":170,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"capabilities","label":"Capability strip","purpose":"Named capability areas the product covers, one per line, exemplar-style plan-build-operate breadth","max_chars":420,"required":true,"render":"lines","max_lines":6,"source_sections":["B5"]},
 {"id":"proof","label":"Proof line","purpose":"Adoption and scale proof — customer counts, program value, certifications — numbers exactly as approved","max_chars":200,"required":true,"render":"text","source_sections":["A4"]},
 {"id":"cta","label":"Call to action","purpose":"Concrete next step framed as the reader's move, with how to reach the team","max_chars":120,"required":true,"render":"text","source_sections":["E1"]}
]$slots$),
  ('22222222-2222-2222-2222-222222220006', 'Aurigo Brochure — Masterworks Story (4-page)', 'brochure',
   'Masterworks', '#053445', true, 'html',
   'public-sector capital program owners and agency executives', 'Agency Executive / Capital Program Director', 'awareness',
   'reference output/Output/Masterworks Sales Enablement/Brochure/Aurigo Masterworks Brochure.pdf',
   $tpl$<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{cover_title}}</title>
<style>
/* LOCKED LAYOUT — Aurigo Brand Standards 2025. Four-page print brochure following
   the exemplar arc: cover, story, capabilities, proof + CTA. Sharp corners only.
   Dark Teal #015F74, Darkest Teal #053445, Light Teal #46B2BE, Red #EE3135 CTA only. */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
@page { size: Letter; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; border-radius: 0 !important; }
body { font-family: Roboto, Calibri, Arial, sans-serif; color: #383838; background: #fff;
       width: 816px; margin: 0 auto; font-size: 14px; line-height: 1.55; }
section.page { width: 816px; min-height: 1056px; position: relative; overflow: hidden;
               page-break-after: always; padding: 56px 56px 64px; }
.p-cover { background: #053445; color: #fff; display: flex; flex-direction: column;
           justify-content: center; }
.p-cover .wordmark { font-weight: 900; font-size: 15px; letter-spacing: 4px; color: #46B2BE;
                     margin-bottom: 40px; }
.kicker { font-size: 15px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase;
          color: #46B2BE; margin-bottom: 16px; }
.p-cover h1 { font-weight: 900; font-size: 46px; line-height: 1.1; max-width: 620px; }
.p-cover .sub { margin-top: 20px; font-size: 17px; color: #D6DDE1; max-width: 560px; }
.accent { display: inline-block; width: 56px; height: 6px; background: #EE3135;
          margin-bottom: 16px; }
h2 { font-weight: 900; font-size: 30px; color: #015F74; line-height: 1.15; margin-bottom: 18px; }
.story-body { font-size: 15px; max-width: 640px; }
.why-now { margin-top: 30px; background: #F0F2F3; border-left: 5px solid #46B2BE;
           padding: 18px 20px; }
.why-now h3 { font-weight: 700; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;
              color: #015F74; margin-bottom: 10px; }
.why-now ul { list-style: none; }
.why-now li { margin-bottom: 8px; padding-left: 16px; position: relative; font-size: 13.5px; }
.why-now li::before { content: ""; position: absolute; left: 0; top: 7px; width: 7px;
                      height: 7px; background: #015F74; }
.what-body { font-size: 15px; max-width: 640px; margin-bottom: 24px; }
.pillars { display: flex; gap: 14px; margin-bottom: 26px; }
.pillar { flex: 1; background: #F0F2F3; padding: 18px 16px; border-top: 4px solid #015F74; }
.pillar h3 { font-weight: 700; font-size: 14px; color: #015F74; margin-bottom: 6px; }
.pillar p { font-size: 12.5px; }
.caps h3 { font-weight: 700; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;
           color: #015F74; margin-bottom: 10px; }
.caps ul { columns: 2; column-gap: 32px; list-style: none; }
.caps li { margin-bottom: 8px; padding-left: 16px; position: relative; font-size: 13.5px;
           break-inside: avoid; }
.caps li::before { content: ""; position: absolute; left: 0; top: 7px; width: 7px; height: 7px;
                   background: #46B2BE; }
.p-proof { background: #015F74; color: #fff; }
.p-proof h2 { color: #fff; }
.p-proof .stats ul { list-style: none; margin-top: 8px; }
.p-proof .stats li { font-size: 17px; font-weight: 500; margin-bottom: 14px; padding-left: 20px;
                     position: relative; }
.p-proof .stats li::before { content: ""; position: absolute; left: 0; top: 9px; width: 9px;
                             height: 9px; background: #46B2BE; }
.voice { margin-top: 34px; border-left: 5px solid #46B2BE; padding: 6px 0 6px 18px;
         font-size: 16px; font-style: italic; color: #D6DDE1; max-width: 600px; }
.cta-block { margin-top: 48px; background: #053445; padding: 26px 28px; }
.cta-block h3 { font-weight: 900; font-size: 22px; margin-bottom: 10px; }
.cta-block h3::before { content: ""; display: block; width: 48px; height: 5px;
                        background: #EE3135; margin-bottom: 12px; }
.cta-block p { font-size: 14px; color: #D6DDE1; max-width: 560px; }
.mark { position: absolute; bottom: 30px; right: 40px; font-weight: 900; letter-spacing: 4px;
        font-size: 14px; color: #46B2BE; }
</style>
</head>
<body>
  <!-- PAGE 1 — cover (exemplar: dark cover, product era kicker, three-beat title) -->
  <section class="page p-cover">
    <div class="wordmark">AURIGO</div>
    <!-- slot:cover_kicker | Why-now framing line, reads uppercase | max 40 chars -->
    <div class="kicker">{{cover_kicker}}</div>
    <!-- slot:cover_title | Umbrella message as the cover title | max 60 chars -->
    <h1>{{cover_title}}</h1>
    <!-- slot:cover_subtitle | Positioning one-liner under the title | max 140 chars -->
    <div class="sub">{{cover_subtitle}}</div>
    <div class="mark">AURIGO</div>
  </section>
  <!-- PAGE 2 — the story (exemplar: letter-style narrative + market stakes) -->
  <section class="page">
    <span class="accent"></span>
    <!-- slot:story_headline | The belief about the customer's world that opens the story | max 70 chars -->
    <h2>{{story_headline}}</h2>
    <!-- slot:story_body | Narrative in the reader's world: their mandate, the stakes, what changes | max 900 chars -->
    <div class="story-body">{{story_body}}</div>
    <div class="why-now">
      <h3>Why now</h3>
      <!-- slot:why_now | Why-now drivers with sourced figures, one per line | max 3 lines -->
      <ul>{{why_now}}</ul>
    </div>
    <div class="mark">AURIGO</div>
  </section>
  <!-- PAGE 3 — what it does (exemplar: suite overview + platform capability spread) -->
  <section class="page">
    <span class="accent"></span>
    <!-- slot:what_headline | What-it-does headline | max 60 chars -->
    <h2>{{what_headline}}</h2>
    <!-- slot:what_body | Plain-language overview of what the product does end to end | max 450 chars -->
    <div class="what-body">{{what_body}}</div>
    <div class="pillars">
      <div class="pillar">
        <!-- slot:pillar_1_title / pillar_1_body | Value pillar name + what it means | -->
        <h3>{{pillar_1_title}}</h3>
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
    <div class="caps">
      <h3>Capabilities</h3>
      <!-- slot:capabilities | Named capability + its outcome, one per line | max 8 lines -->
      <ul>{{capabilities}}</ul>
    </div>
    <div class="mark">AURIGO</div>
  </section>
  <!-- PAGE 4 — proof + CTA (exemplar: scale stats, customer voice, closing block) -->
  <section class="page p-proof">
    <!-- slot:proof_headline | Scale and outcomes claim as a headline | max 60 chars -->
    <h2>{{proof_headline}}</h2>
    <div class="stats">
      <!-- slot:proof_points | Quantified proof, one stat per line, numbers exactly as approved | max 4 lines -->
      <ul>{{proof_points}}</ul>
    </div>
    <!-- slot:customer_voice | The buyer's world in language close to their own words | max 240 chars -->
    <div class="voice">{{customer_voice}}</div>
    <div class="cta-block">
      <!-- slot:cta_headline | The advance, framed as the reader's move | max 70 chars -->
      <h3>{{cta_headline}}</h3>
      <!-- slot:cta_body | What the reader gets from taking the next step | max 180 chars -->
      <p>{{cta_body}}</p>
    </div>
    <div class="mark">AURIGO</div>
  </section>
</body>
</html>$tpl$,
   $slots$[
 {"id":"cover_kicker","label":"Cover kicker","purpose":"Why-now framing line for the cover, reads uppercase, exemplar-style era announcement","max_chars":40,"required":true,"render":"text","source_sections":["A2"]},
 {"id":"cover_title","label":"Cover title","purpose":"Umbrella message as the cover title — short, declarative, outcome-led","max_chars":60,"required":true,"render":"text","source_sections":["B1"]},
 {"id":"cover_subtitle","label":"Cover subtitle","purpose":"Positioning one-liner: for whom, what, unlike what","max_chars":140,"required":true,"render":"text","source_sections":["A5"]},
 {"id":"story_headline","label":"Story headline","purpose":"The belief about the customer's world that opens the story, exemplar-style build-a-better-tomorrow register","max_chars":70,"required":true,"render":"text","source_sections":["A1"]},
 {"id":"story_body","label":"Story body","purpose":"Letter-style narrative opening from the reader's mandate and community stakes, then why this product exists","max_chars":900,"required":true,"render":"multiline","source_sections":["A1","A2"]},
 {"id":"why_now","label":"Why now","purpose":"Why-now drivers with sourced figures, one per line — funding surges, complexity, accountability pressure","max_chars":360,"required":true,"render":"lines","max_lines":3,"source_sections":["A2"]},
 {"id":"what_headline","label":"What-it-does headline","purpose":"Headline for the capability spread: what the suite does for the program","max_chars":60,"required":true,"render":"text","source_sections":["B3"]},
 {"id":"what_body","label":"What-it-does body","purpose":"Plain-language overview of what the product does end to end, first-time-reader clear","max_chars":450,"required":true,"render":"multiline","source_sections":["B3"]},
 {"id":"pillar_1_title","label":"Pillar 1 title","purpose":"First value pillar name","max_chars":40,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_1_body","label":"Pillar 1 body","purpose":"What pillar 1 means for the program","max_chars":160,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_2_title","label":"Pillar 2 title","purpose":"Second value pillar name","max_chars":40,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_2_body","label":"Pillar 2 body","purpose":"What pillar 2 means for the program","max_chars":160,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_3_title","label":"Pillar 3 title","purpose":"Third value pillar name","max_chars":40,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"pillar_3_body","label":"Pillar 3 body","purpose":"What pillar 3 means for the program","max_chars":160,"required":true,"render":"text","source_sections":["B2"]},
 {"id":"capabilities","label":"Capabilities","purpose":"Named capability + its outcome, one per line, spanning the plan-build-operate breadth","max_chars":640,"required":true,"render":"lines","max_lines":8,"source_sections":["B5"]},
 {"id":"proof_headline","label":"Proof headline","purpose":"Scale and outcomes claim as a headline, exemplar-style quality-of-life framing","max_chars":60,"required":true,"render":"text","source_sections":["A4"]},
 {"id":"proof_points","label":"Proof points","purpose":"Quantified proof, one stat per line, numbers exactly as approved — miles, dollars, agencies","max_chars":480,"required":true,"render":"lines","max_lines":4,"source_sections":["A4"]},
 {"id":"customer_voice","label":"Customer voice","purpose":"The economic buyer's world in language close to their own words — the pain the proof answers","max_chars":240,"required":true,"render":"text","source_sections":["C1"]},
 {"id":"cta_headline","label":"CTA headline","purpose":"The advance, framed as the reader's move","max_chars":70,"required":true,"render":"text","source_sections":["E1"]},
 {"id":"cta_body","label":"CTA body","purpose":"What the reader gets from taking the next step, with how to reach the team","max_chars":180,"required":true,"render":"text","source_sections":["E1"]}
]$slots$),
  ('22222222-2222-2222-2222-222222220007', 'Masterworks AI Battlecard — Objection Handling (Internal)', 'battlecard',
   'Masterworks', '#EE3135', true, 'markdown',
   'internal — sales and presales only, never customer-facing', 'Account Executive', 'decision',
   'reference output/Output/Masterworks AI/FAQ/Lumina Copilot Upsell - Value Prop and Objection Handling (Internal USe).docx',
   $tpl$---
product: Masterworks AI
audience: internal — sales and presales
persona: Account Executive
stage: draft
classification: INTERNAL USE ONLY — do not forward or attach externally
sources: [A4, A5, D1, D4, B6]
date: (set at export)
---

# {{card_title}}

> INTERNAL USE ONLY. Talk track and counters for sellers. Quote numbers and
> certification wording exactly as written — never improvise claims in a deal.

## The one-liner

<!-- slot:one_liner | The USP in one sentence, exemplar-style only-AI-that framing | wired A5 -->
{{one_liner}}

## Why we win

<!-- slot:win_1..3 | Durable attributes with the reason each is hard to copy | wired A4, D1 -->
**{{win_1_title}}** — {{win_1_body}}

**{{win_2_title}}** — {{win_2_body}}

**{{win_3_title}}** — {{win_3_body}}

### Trust anchors to cite

<!-- slot:trust_anchors | Platform and governance facts to anchor on, one per line | wired B6 -->
{{trust_anchors}}

## Objections and counters

<!-- slot:objection_1..4 / counter_1..4 | Buyer-voiced objection and the approved counter | wired D4 -->
| Objection (as the buyer says it) | Counter (approved response) |
|---|---|
| {{objection_1}} | {{counter_1}} |
| {{objection_2}} | {{counter_2}} |
| {{objection_3}} | {{counter_3}} |
| {{objection_4}} | {{counter_4}} |

## Traps to set

Discovery questions that surface what only we can answer:

<!-- slot:trap_questions | Questions the alternatives cannot answer well, one per line | wired D1 -->
{{trap_questions}}
$tpl$,
   $slots$[
 {"id":"card_title","label":"Card title","purpose":"Internal card title naming the product and the competitive moment it serves","max_chars":70,"required":true,"render":"text","source_sections":["A5"]},
 {"id":"one_liner","label":"The one-liner","purpose":"The USP in one sentence, exemplar-style: the only product that does X, Y, and Z — swap-test proof","max_chars":240,"required":true,"render":"text","source_sections":["A5"]},
 {"id":"win_1_title","label":"Win attribute 1 title","purpose":"First durable attribute competitors cannot copy, named in a few words","max_chars":40,"required":true,"render":"text","source_sections":["A4"]},
 {"id":"win_1_body","label":"Win attribute 1 body","purpose":"Why attribute 1 is hard to copy and what it means in a deal","max_chars":220,"required":true,"render":"text","source_sections":["A4","D1"]},
 {"id":"win_2_title","label":"Win attribute 2 title","purpose":"Second durable attribute, named in a few words","max_chars":40,"required":true,"render":"text","source_sections":["A4"]},
 {"id":"win_2_body","label":"Win attribute 2 body","purpose":"Why attribute 2 is hard to copy and what it means in a deal","max_chars":220,"required":true,"render":"text","source_sections":["A4","D1"]},
 {"id":"win_3_title","label":"Win attribute 3 title","purpose":"Third durable attribute, named in a few words","max_chars":40,"required":true,"render":"text","source_sections":["A4"]},
 {"id":"win_3_body","label":"Win attribute 3 body","purpose":"Why attribute 3 is hard to copy and what it means in a deal","max_chars":220,"required":true,"render":"text","source_sections":["A4","D1"]},
 {"id":"trust_anchors","label":"Trust anchors","purpose":"Platform and governance facts to anchor on — certifications, human approval gates, citations — one per line, each line starting with '- ', wording exactly as approved","max_chars":360,"required":true,"render":"lines","max_lines":3,"source_sections":["B6"]},
 {"id":"objection_1","label":"Objection 1","purpose":"Most common objection, phrased the way buyers actually say it","max_chars":120,"required":true,"render":"text","source_sections":["D4"]},
 {"id":"counter_1","label":"Counter 1","purpose":"Approved counter to objection 1: reframe, evidence, key message — single line for the table","max_chars":340,"required":true,"render":"text","source_sections":["D4"]},
 {"id":"objection_2","label":"Objection 2","purpose":"Second objection in the buyer's words","max_chars":120,"required":true,"render":"text","source_sections":["D4"]},
 {"id":"counter_2","label":"Counter 2","purpose":"Approved counter to objection 2 — single line for the table","max_chars":340,"required":true,"render":"text","source_sections":["D4"]},
 {"id":"objection_3","label":"Objection 3","purpose":"Third objection in the buyer's words","max_chars":120,"required":true,"render":"text","source_sections":["D4"]},
 {"id":"counter_3","label":"Counter 3","purpose":"Approved counter to objection 3 — single line for the table","max_chars":340,"required":true,"render":"text","source_sections":["D4"]},
 {"id":"objection_4","label":"Objection 4","purpose":"Fourth objection in the buyer's words","max_chars":120,"required":false,"render":"text","source_sections":["D4"]},
 {"id":"counter_4","label":"Counter 4","purpose":"Approved counter to objection 4 — single line for the table","max_chars":340,"required":false,"render":"text","source_sections":["D4"]},
 {"id":"trap_questions","label":"Traps to set","purpose":"Discovery questions the alternatives cannot answer well, one per line, each line starting with '- ', exemplar-style which-one-matters framing","max_chars":500,"required":true,"render":"lines","max_lines":4,"source_sections":["D1"]}
]$slots$)
on conflict (id) do update set
  name = excluded.name, format = excluded.format, body = excluded.body, slots = excluded.slots,
  audience = excluded.audience, persona = excluded.persona, funnel_stage = excluded.funnel_stage,
  exemplar_path = excluded.exemplar_path, approved = excluded.approved,
  template_version = templates.template_version + 1, updated_at = now();
