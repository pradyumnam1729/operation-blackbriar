-- Two branded battlecard templates (asset_type='battlecard'), modeled on real
-- PMM reference documents (a portrait quick-reference sheet and a landscape
-- detailed comparison), restyled to Aurigo's actual palette/typography —
-- the source files used ad-hoc colors and Arial, outside brand guardrails.
-- Also: landscape support (new `orientation` column, defaults to the existing
-- portrait behavior for every template already in the table) and provenance/
-- filtering columns so generated battlecards can be tagged by competitor and
-- vertical and found later.

alter table templates add column if not exists orientation text not null default 'portrait'
  check (orientation in ('portrait', 'landscape'));

alter table artifacts add column if not exists competitor_id uuid references competitors(id) on delete set null;
alter table artifacts add column if not exists vertical text;

alter table artifact_renders add column if not exists ci_report_id uuid references ci_reports(id) on delete set null;

insert into templates (id, name, asset_type, product_line, preview_color, approved,
                       format, orientation, audience, persona, funnel_stage, exemplar_path, body, slots)
values
(
  '33333333-3333-3333-3333-333333330001',
  'Competitive Insights Sheet',
  'battlecard',
  null,
  '#053445',
  true,
  'html',
  'portrait',
  'Sales, Proposals',
  'Account Executive',
  'decision',
  null,
  $insights_tpl$<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{our_product}} vs {{competitor_name}} — Competitive Insights Sheet</title>
<style>
/* LOCKED LAYOUT — Aurigo Brand Standards: Dark Teal/Darkest Teal, Roboto,
   sharp corners (no border-radius anywhere), Red accent for competitor-risk
   callouts only. Portrait, US-Letter-proportioned canvas. */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Roboto, Calibri, Arial, sans-serif; color: #383838; background: #fff;
       width: 816px; min-height: 1056px; margin: 0 auto; font-size: 12.5px; line-height: 1.5; }
header { background: #053445; color: #fff; padding: 22px 28px 18px; position: relative; }
header .tag { position: absolute; top: 10px; right: 20px; font-size: 10px; letter-spacing: 2px;
              color: #46B2BE; font-weight: 700; }
header h1 { font-size: 24px; font-weight: 900; }
header .sub { margin-top: 4px; font-size: 13px; color: #B4D9DF; }
.bar { height: 5px; background: #EE3135; }
main { display: flex; }
.left { flex: 1.2; padding: 20px 22px; }
.right { flex: 1; background: #053445; color: #fff; padding: 20px 20px; min-height: 900px; }
.right h2 { font-size: 14px; font-weight: 700; color: #46B2BE; text-transform: uppercase;
            letter-spacing: 1.5px; margin-bottom: 12px; }
h2.section { font-size: 14px; font-weight: 700; color: #015F74; text-transform: uppercase;
             letter-spacing: 1px; margin: 16px 0 8px; border-bottom: 2px solid #EE3135; padding-bottom: 4px; }
h2.section:first-of-type { margin-top: 0; }
p.overview { font-size: 12.5px; color: #383838; margin-bottom: 4px; }
ul.reasons { list-style: none; margin-top: 6px; }
ul.reasons li { padding: 6px 0 6px 16px; position: relative; border-bottom: 1px solid #EAEDF0; }
ul.reasons li:before { content: "\25A0"; color: #015F74; font-size: 8px; position: absolute; left: 0; top: 10px; }
.split { display: flex; gap: 14px; margin-top: 6px; }
.split .col { flex: 1; }
.split .col.weak h3 { color: #EE3135; }
.split .col.win h3 { color: #015F74; }
.split h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
.split ul { list-style: none; }
.split li { padding: 5px 0 5px 14px; position: relative; font-size: 11.5px; border-bottom: 1px solid #EAEDF0; }
.split li:before { content: "\2013"; position: absolute; left: 0; }
.qa { margin-bottom: 16px; }
.qa .q { font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 4px; }
.qa .a { font-size: 11.5px; color: #D6DDE1; }
footer { padding: 10px 28px; border-top: 3px solid #EE3135; font-size: 10.5px; color: #B4B5B6;
         display: flex; justify-content: space-between; }
</style>
</head>
<body>
<header>
  <div class="tag">INTERNAL — SALES USE</div>
  <h1>Competitive Insights Sheet</h1>
  <div class="sub">{{our_product}} vs {{competitor_name}}</div>
</header>
<div class="bar"></div>
<main>
  <div class="left">
    <h2 class="section">Overview</h2>
    <!-- slot:overview | Plain-language framing of the matchup, our product first | max 500 chars | multiline -->
    <p class="overview">{{overview}}</p>

    <h2 class="section">Why choose {{our_product}}</h2>
    <!-- slot:why_choose_reasons | Top reasons to choose our product, one per line | max 600 chars | max 5 lines -->
    <ul class="reasons">{{why_choose_reasons}}</ul>

    <div class="split">
      <div class="col weak">
        <h3>{{competitor_name}}'s weaknesses</h3>
        <!-- slot:competitor_weaknesses | Sourced competitor gaps, one per line | max 600 chars | max 5 lines -->
        <ul>{{competitor_weaknesses}}</ul>
      </div>
      <div class="col win">
        <h3>Why {{our_product}} is better</h3>
        <!-- slot:why_we_win | Our differentiators against this competitor, one per line | max 600 chars | max 5 lines -->
        <ul>{{why_we_win}}</ul>
      </div>
    </div>
  </div>
  <div class="right">
    <h2>Objection handling</h2>
    <div class="qa">
      <!-- slot:objection_1_question | First objection, in the buyer's words | max 140 chars -->
      <div class="q">"{{objection_1_question}}"</div>
      <!-- slot:objection_1_answer | Honest counter to objection 1 | max 320 chars -->
      <div class="a">{{objection_1_answer}}</div>
    </div>
    <div class="qa">
      <!-- slot:objection_2_question | Second objection, in the buyer's words | max 140 chars -->
      <div class="q">"{{objection_2_question}}"</div>
      <!-- slot:objection_2_answer | Honest counter to objection 2 | max 320 chars -->
      <div class="a">{{objection_2_answer}}</div>
    </div>
    <div class="qa">
      <!-- slot:objection_3_question | Third objection, in the buyer's words | max 140 chars -->
      <div class="q">"{{objection_3_question}}"</div>
      <!-- slot:objection_3_answer | Honest counter to objection 3 | max 320 chars -->
      <div class="a">{{objection_3_answer}}</div>
    </div>
    <div class="qa">
      <!-- slot:objection_4_question | Fourth objection, in the buyer's words | max 140 chars -->
      <div class="q">"{{objection_4_question}}"</div>
      <!-- slot:objection_4_answer | Honest counter to objection 4 | max 320 chars -->
      <div class="a">{{objection_4_answer}}</div>
    </div>
  </div>
</main>
<footer>
  <!-- slot:last_updated | Auto-filled with today's date at generation time, not model-authored | max 20 chars -->
  <span>Last updated {{last_updated}}</span>
  <span>Hive by Aurigo</span>
</footer>
</body>
</html>$insights_tpl$,
  $insights_slots$[
 {"id":"our_product","label":"Our product","purpose":"The Aurigo product being positioned (Primus or Masterworks)","max_chars":30,"required":true,"render":"text","source_sections":[]},
 {"id":"competitor_name","label":"Competitor name","purpose":"The competitor this sheet compares against","max_chars":30,"required":true,"render":"text","source_sections":[]},
 {"id":"overview","label":"Overview","purpose":"Plain-language framing of the matchup, our product first","max_chars":500,"required":true,"render":"multiline","source_sections":[]},
 {"id":"why_choose_reasons","label":"Why choose reasons","purpose":"Top reasons to choose our product, one per line","max_chars":600,"required":true,"render":"lines","max_lines":5,"source_sections":[]},
 {"id":"competitor_weaknesses","label":"Competitor weaknesses","purpose":"Sourced competitor gaps, one per line","max_chars":600,"required":true,"render":"lines","max_lines":5,"source_sections":[]},
 {"id":"why_we_win","label":"Why we win","purpose":"Our differentiators against this competitor, one per line","max_chars":600,"required":true,"render":"lines","max_lines":5,"source_sections":[]},
 {"id":"objection_1_question","label":"Objection 1","purpose":"First objection, in the buyer's words","max_chars":140,"required":true,"render":"text","source_sections":[]},
 {"id":"objection_1_answer","label":"Objection 1 answer","purpose":"Honest counter to objection 1","max_chars":320,"required":true,"render":"text","source_sections":[]},
 {"id":"objection_2_question","label":"Objection 2","purpose":"Second objection, in the buyer's words","max_chars":140,"required":true,"render":"text","source_sections":[]},
 {"id":"objection_2_answer","label":"Objection 2 answer","purpose":"Honest counter to objection 2","max_chars":320,"required":true,"render":"text","source_sections":[]},
 {"id":"objection_3_question","label":"Objection 3","purpose":"Third objection, in the buyer's words","max_chars":140,"required":true,"render":"text","source_sections":[]},
 {"id":"objection_3_answer","label":"Objection 3 answer","purpose":"Honest counter to objection 3","max_chars":320,"required":true,"render":"text","source_sections":[]},
 {"id":"objection_4_question","label":"Objection 4","purpose":"Fourth objection, in the buyer's words","max_chars":140,"required":true,"render":"text","source_sections":[]},
 {"id":"objection_4_answer","label":"Objection 4 answer","purpose":"Honest counter to objection 4","max_chars":320,"required":true,"render":"text","source_sections":[]},
 {"id":"last_updated","label":"Last updated","purpose":"Auto-filled with today's date at generation time, not model-authored","max_chars":20,"required":true,"render":"text","source_sections":[]}
]$insights_slots$::jsonb
),
(
  '33333333-3333-3333-3333-333333330002',
  'Detailed Competitive Battlecard',
  'battlecard',
  null,
  '#015F74',
  true,
  'html',
  'landscape',
  'Sales, Proposals',
  'Account Executive',
  'decision',
  null,
  $detailed_tpl$<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{our_product}} vs {{competitor_name}} — Battlecard</title>
<style>
/* LOCKED LAYOUT — Aurigo Brand Standards: Dark Teal/Darkest Teal, Roboto,
   sharp corners (no border-radius anywhere). Landscape canvas. Capability
   table is fixed at 5 rows by design — never add more without a layout change. */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Roboto, Calibri, Arial, sans-serif; color: #383838; background: #fff;
       width: 1056px; min-height: 816px; margin: 0 auto; font-size: 10.5px; line-height: 1.4; }
header { background: #015F74; color: #fff; padding: 14px 24px; }
header h1 { font-size: 19px; font-weight: 900; }
header .sub { font-size: 12px; color: #B4D9DF; margin-top: 2px; }
.snapshot { display: flex; }
.snapshot .col { flex: 1; padding: 10px 20px; font-size: 10.5px; }
.snapshot .col.theirs { background: #EAEDF0; }
.snapshot .col.ours { background: #E5F1F3; }
.snapshot .col b { color: #053445; }
.frame { background: #053445; color: #F5A623; font-weight: 700; font-size: 11px; padding: 8px 20px; }
.cols3 { display: flex; }
.cols3 .col { flex: 1; border-right: 2px solid #fff; }
.cols3 .col:last-child { border-right: 0; }
.cols3 .hd { color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase;
             letter-spacing: .5px; padding: 6px 14px; }
.cols3 .hd.overview { background: #015F74; }
.cols3 .hd.pricing { background: #46B2BE; }
.cols3 .hd.positioning { background: #053445; }
.cols3 .bd { padding: 8px 14px; font-size: 10px; background: #F0F2F3; }
.cols3 .bd p { margin-bottom: 6px; }
.cols3 .bd b { color: #053445; }
.leads { display: flex; }
.leads .col { flex: 1; border-right: 2px solid #fff; }
.leads .col:last-child { border-right: 0; }
.leads .hd { color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 6px 14px; }
.leads .hd.us { background: #015F74; }
.leads .hd.them { background: #EE3135; }
.leads .hd.ask { background: #053445; }
.leads .bd { padding: 8px 14px; font-size: 9.5px; background: #fff; }
.leads ul { list-style: none; }
.leads li { padding: 4px 0 4px 12px; position: relative; border-bottom: 1px solid #EAEDF0; }
.leads li:before { content: "\2013"; position: absolute; left: 0; }
table.capability { width: 100%; border-collapse: collapse; font-size: 9.5px; }
table.capability th { background: #053445; color: #fff; text-align: left; padding: 6px 12px;
                       text-transform: uppercase; font-size: 10px; }
table.capability td { padding: 6px 12px; border-bottom: 1px solid #EAEDF0; vertical-align: top; }
table.capability tr:nth-child(even) td { background: #F0F2F3; }
.honest { display: flex; }
.honest .col { flex: 1; padding: 8px 14px; font-size: 9.5px; }
.honest .col.mines { background: #FBEAEA; }
.honest .col.counters { background: #F0F2F3; }
.honest .hd { font-weight: 700; text-transform: uppercase; font-size: 10.5px; margin-bottom: 6px; }
.honest .col.mines .hd { color: #EE3135; }
.honest .col.counters .hd { color: #053445; }
.honest ul { list-style: none; }
.honest li { padding: 3px 0 3px 12px; position: relative; }
.honest li:before { content: "\2013"; position: absolute; left: 0; }
footer { padding: 6px 24px; border-top: 3px solid #EE3135; font-size: 9px; color: #B4B5B6;
         display: flex; justify-content: space-between; }
</style>
</head>
<body>
<header>
  <h1>{{our_product}} vs {{competitor_name}}</h1>
  <!-- slot:category_line | Category/segment this battlecard covers | max 90 chars -->
  <div class="sub">{{category_line}}</div>
</header>
<div class="snapshot">
  <div class="col ours"><b>{{our_product}}: </b>
    <!-- slot:our_snapshot | Our company/product facts relevant to this deal | max 220 chars -->
    {{our_snapshot}}
  </div>
  <div class="col theirs"><b>{{competitor_name}}: </b>
    <!-- slot:competitor_snapshot | Sourced competitor facts, only what's confirmed | max 220 chars -->
    {{competitor_snapshot}}
  </div>
</div>
<div class="frame">
  <!-- slot:honest_frame | One honest sentence framing who's actually ahead where | max 280 chars -->
  {{honest_frame}}
</div>
<div class="cols3">
  <div class="col">
    <div class="hd overview">Product overview</div>
    <div class="bd">
      <!-- slot:overview_theirs | Competitor product overview, sourced only | max 260 chars -->
      <p><b>{{competitor_name}}:</b> {{overview_theirs}}</p>
      <!-- slot:overview_ours | Our product overview | max 260 chars -->
      <p><b>{{our_product}}:</b> {{overview_ours}}</p>
    </div>
  </div>
  <div class="col">
    <div class="hd pricing">Deal profile &amp; pricing</div>
    <div class="bd">
      <!-- slot:pricing_theirs | Competitor pricing/deal pattern, sourced only | max 260 chars -->
      <p><b>{{competitor_name}}:</b> {{pricing_theirs}}</p>
      <!-- slot:pricing_ours | Our pricing/deal pattern | max 260 chars -->
      <p><b>{{our_product}}:</b> {{pricing_ours}}</p>
    </div>
  </div>
  <div class="col">
    <div class="hd positioning">Positioning &amp; messaging</div>
    <div class="bd">
      <!-- slot:positioning_theirs | How the competitor positions itself, sourced only | max 260 chars -->
      <p><b>{{competitor_name}}:</b> {{positioning_theirs}}</p>
      <!-- slot:positioning_ours | How we position against them | max 260 chars -->
      <p><b>{{our_product}}:</b> {{positioning_ours}}</p>
    </div>
  </div>
</div>
<div class="leads">
  <div class="col">
    <div class="hd us">Where {{our_product}} genuinely leads</div>
    <!-- slot:where_we_lead | Our real, defensible advantages, one per line | max 480 chars | max 4 lines -->
    <div class="bd"><ul>{{where_we_lead}}</ul></div>
  </div>
  <div class="col">
    <div class="hd them">Where {{competitor_name}} leads — own it</div>
    <!-- slot:where_they_lead | Where the competitor genuinely leads, one per line | max 480 chars | max 4 lines -->
    <div class="bd"><ul>{{where_they_lead}}</ul></div>
  </div>
  <div class="col">
    <div class="hd ask">Questions to ask</div>
    <!-- slot:questions_to_ask | Discovery questions that expose the competitor's gaps, one per line | max 480 chars | max 4 lines -->
    <div class="bd"><ul>{{questions_to_ask}}</ul></div>
  </div>
</div>
<table class="capability">
<thead><tr><th>Capability</th><th>{{our_product}}</th><th>{{competitor_name}}</th><th>Verdict</th></tr></thead>
<tbody>
<tr>
  <!-- slot:capability_1_name | First capability being compared | max 40 chars -->
  <td>{{capability_1_name}}</td>
  <!-- slot:capability_1_us | Our stance on this capability | max 90 chars -->
  <td>{{capability_1_us}}</td>
  <!-- slot:capability_1_them | Their stance on this capability, sourced only | max 90 chars -->
  <td>{{capability_1_them}}</td>
  <!-- slot:capability_1_verdict | Who wins this row and why, one short clause | max 50 chars -->
  <td>{{capability_1_verdict}}</td>
</tr>
<tr>
  <!-- slot:capability_2_name | Second capability being compared | max 40 chars -->
  <td>{{capability_2_name}}</td>
  <!-- slot:capability_2_us | Our stance on this capability | max 90 chars -->
  <td>{{capability_2_us}}</td>
  <!-- slot:capability_2_them | Their stance on this capability, sourced only | max 90 chars -->
  <td>{{capability_2_them}}</td>
  <!-- slot:capability_2_verdict | Who wins this row and why, one short clause | max 50 chars -->
  <td>{{capability_2_verdict}}</td>
</tr>
<tr>
  <!-- slot:capability_3_name | Third capability being compared | max 40 chars -->
  <td>{{capability_3_name}}</td>
  <!-- slot:capability_3_us | Our stance on this capability | max 90 chars -->
  <td>{{capability_3_us}}</td>
  <!-- slot:capability_3_them | Their stance on this capability, sourced only | max 90 chars -->
  <td>{{capability_3_them}}</td>
  <!-- slot:capability_3_verdict | Who wins this row and why, one short clause | max 50 chars -->
  <td>{{capability_3_verdict}}</td>
</tr>
<tr>
  <!-- slot:capability_4_name | Fourth capability being compared | max 40 chars -->
  <td>{{capability_4_name}}</td>
  <!-- slot:capability_4_us | Our stance on this capability | max 90 chars -->
  <td>{{capability_4_us}}</td>
  <!-- slot:capability_4_them | Their stance on this capability, sourced only | max 90 chars -->
  <td>{{capability_4_them}}</td>
  <!-- slot:capability_4_verdict | Who wins this row and why, one short clause | max 50 chars -->
  <td>{{capability_4_verdict}}</td>
</tr>
<tr>
  <!-- slot:capability_5_name | Fifth capability being compared | max 40 chars -->
  <td>{{capability_5_name}}</td>
  <!-- slot:capability_5_us | Our stance on this capability | max 90 chars -->
  <td>{{capability_5_us}}</td>
  <!-- slot:capability_5_them | Their stance on this capability, sourced only | max 90 chars -->
  <td>{{capability_5_them}}</td>
  <!-- slot:capability_5_verdict | Who wins this row and why, one short clause | max 50 chars -->
  <td>{{capability_5_verdict}}</td>
</tr>
</tbody>
</table>
<div class="honest">
  <div class="col mines">
    <div class="hd">Landmines — don't say this</div>
    <!-- slot:landmines | Claims we cannot honestly make about ourselves vs this competitor, one per line | max 480 chars | max 4 lines -->
    <ul>{{landmines}}</ul>
  </div>
  <div class="col counters">
    <div class="hd">Honest counters — not spin</div>
    <!-- slot:honest_counters | Reframe scripts for the competitor's strongest claims, one per line | max 700 chars | max 2 lines -->
    <ul>{{honest_counters}}</ul>
  </div>
</div>
<footer>
  <!-- slot:last_updated | Auto-filled with today's date at generation time, not model-authored | max 20 chars -->
  <span>Last updated {{last_updated}}</span>
  <span>INTERNAL — Hive by Aurigo</span>
</footer>
</body>
</html>$detailed_tpl$,
  $detailed_slots$[
 {"id":"our_product","label":"Our product","purpose":"The Aurigo product being positioned (Primus or Masterworks)","max_chars":30,"required":true,"render":"text","source_sections":[]},
 {"id":"competitor_name","label":"Competitor name","purpose":"The competitor this battlecard compares against","max_chars":30,"required":true,"render":"text","source_sections":[]},
 {"id":"category_line","label":"Category line","purpose":"Category/segment this battlecard covers","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"our_snapshot","label":"Our snapshot","purpose":"Our company/product facts relevant to this deal","max_chars":220,"required":true,"render":"text","source_sections":[]},
 {"id":"competitor_snapshot","label":"Competitor snapshot","purpose":"Sourced competitor facts, only what's confirmed","max_chars":220,"required":true,"render":"text","source_sections":[]},
 {"id":"honest_frame","label":"Honest frame","purpose":"One honest sentence framing who's actually ahead where","max_chars":280,"required":true,"render":"text","source_sections":[]},
 {"id":"overview_theirs","label":"Overview — theirs","purpose":"Competitor product overview, sourced only","max_chars":260,"required":true,"render":"text","source_sections":[]},
 {"id":"overview_ours","label":"Overview — ours","purpose":"Our product overview","max_chars":260,"required":true,"render":"text","source_sections":[]},
 {"id":"pricing_theirs","label":"Pricing — theirs","purpose":"Competitor pricing/deal pattern, sourced only","max_chars":260,"required":true,"render":"text","source_sections":[]},
 {"id":"pricing_ours","label":"Pricing — ours","purpose":"Our pricing/deal pattern","max_chars":260,"required":true,"render":"text","source_sections":[]},
 {"id":"positioning_theirs","label":"Positioning — theirs","purpose":"How the competitor positions itself, sourced only","max_chars":260,"required":true,"render":"text","source_sections":[]},
 {"id":"positioning_ours","label":"Positioning — ours","purpose":"How we position against them","max_chars":260,"required":true,"render":"text","source_sections":[]},
 {"id":"where_we_lead","label":"Where we lead","purpose":"Our real, defensible advantages, one per line","max_chars":480,"required":true,"render":"lines","max_lines":4,"source_sections":[]},
 {"id":"where_they_lead","label":"Where they lead","purpose":"Where the competitor genuinely leads, one per line","max_chars":480,"required":true,"render":"lines","max_lines":4,"source_sections":[]},
 {"id":"questions_to_ask","label":"Questions to ask","purpose":"Discovery questions that expose the competitor's gaps, one per line","max_chars":480,"required":true,"render":"lines","max_lines":4,"source_sections":[]},
 {"id":"capability_1_name","label":"Capability 1","purpose":"First capability being compared","max_chars":40,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_1_us","label":"Capability 1 — us","purpose":"Our stance on this capability","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_1_them","label":"Capability 1 — them","purpose":"Their stance on this capability, sourced only","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_1_verdict","label":"Capability 1 verdict","purpose":"Who wins this row and why, one short clause","max_chars":50,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_2_name","label":"Capability 2","purpose":"Second capability being compared","max_chars":40,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_2_us","label":"Capability 2 — us","purpose":"Our stance on this capability","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_2_them","label":"Capability 2 — them","purpose":"Their stance on this capability, sourced only","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_2_verdict","label":"Capability 2 verdict","purpose":"Who wins this row and why, one short clause","max_chars":50,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_3_name","label":"Capability 3","purpose":"Third capability being compared","max_chars":40,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_3_us","label":"Capability 3 — us","purpose":"Our stance on this capability","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_3_them","label":"Capability 3 — them","purpose":"Their stance on this capability, sourced only","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_3_verdict","label":"Capability 3 verdict","purpose":"Who wins this row and why, one short clause","max_chars":50,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_4_name","label":"Capability 4","purpose":"Fourth capability being compared","max_chars":40,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_4_us","label":"Capability 4 — us","purpose":"Our stance on this capability","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_4_them","label":"Capability 4 — them","purpose":"Their stance on this capability, sourced only","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_4_verdict","label":"Capability 4 verdict","purpose":"Who wins this row and why, one short clause","max_chars":50,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_5_name","label":"Capability 5","purpose":"Fifth capability being compared","max_chars":40,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_5_us","label":"Capability 5 — us","purpose":"Our stance on this capability","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_5_them","label":"Capability 5 — them","purpose":"Their stance on this capability, sourced only","max_chars":90,"required":true,"render":"text","source_sections":[]},
 {"id":"capability_5_verdict","label":"Capability 5 verdict","purpose":"Who wins this row and why, one short clause","max_chars":50,"required":true,"render":"text","source_sections":[]},
 {"id":"landmines","label":"Landmines","purpose":"Claims we cannot honestly make about ourselves vs this competitor, one per line","max_chars":480,"required":true,"render":"lines","max_lines":4,"source_sections":[]},
 {"id":"honest_counters","label":"Honest counters","purpose":"Reframe scripts for the competitor's strongest claims, one per line","max_chars":700,"required":true,"render":"lines","max_lines":2,"source_sections":[]},
 {"id":"last_updated","label":"Last updated","purpose":"Auto-filled with today's date at generation time, not model-authored","max_chars":20,"required":true,"render":"text","source_sections":[]}
]$detailed_slots$::jsonb
)
on conflict (id) do update set
  name = excluded.name,
  body = excluded.body,
  slots = excluded.slots,
  format = excluded.format,
  orientation = excluded.orientation,
  approved = excluded.approved;
