-- 0017: Masterworks AI branded datasheet template — dark header + orange
-- accents, two-column layout modeled on the approved reference datasheet
-- (exemplar: reference output/Output/Masterworks AI/Datasheets/Masterworks AI Overview Datasheet.pdf).
-- Slot schema and section wiring are identical to template 0001, so the
-- slot-fill pipeline works unchanged. Idempotent: safe to re-run.

insert into templates (id, name, asset_type, product_line, preview_color, approved, format, body, slots, audience, persona, funnel_stage, exemplar_path, template_version)
values (
  '22222222-2222-2222-2222-222222220010',
  'Masterworks AI Datasheet — Product (US Letter)',
  'datasheet',
  'Masterworks',
  '#141416',
  true,
  'html',
  $mwai_tpl$<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{headline}}</title>
<style>
/* LOCKED LAYOUT — Masterworks AI product branding (dark + orange), modeled on
   the approved reference datasheet. Roboto; US Letter. */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
@page { size: Letter; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Roboto, Calibri, Arial, sans-serif; color: #2b2b2e; background: #f4f4f5;
       width: 816px; min-height: 1056px; margin: 0 auto; font-size: 13.5px; line-height: 1.55; }
.sheet { padding: 18px; }
.hero { background: linear-gradient(135deg, #141416 0%, #2a2a2e 100%); color: #fff;
        border-radius: 14px 14px 0 0; padding: 34px 40px 30px; }
.hero .wordmark { font-weight: 900; font-size: 15px; letter-spacing: 2.5px; margin-bottom: 22px; }
.hero .wordmark .spark { color: #F5A623; }
.hero h1 { font-weight: 700; font-size: 27px; line-height: 1.2; max-width: 620px; }
.hero .sub { margin-top: 10px; font-size: 14px; color: #c9c9cf; max-width: 600px; }
.heat { height: 7px; border-radius: 0 0 3px 3px;
        background: linear-gradient(90deg, #141416 0%, #E8590C 45%, #F5A623 75%, #EE3135 100%); }
main { display: flex; gap: 26px; padding: 26px 22px 8px; }
.left { flex: 1.15; }
.left .hook { color: #55555c; margin-bottom: 16px; }
.left .overview { margin-bottom: 20px; }
.bar { display: inline-block; background: linear-gradient(90deg, #E8590C, #F5A623);
       color: #fff; font-weight: 700; font-size: 15px; padding: 8px 18px; border-radius: 6px;
       margin-bottom: 12px; }
.caps ul { list-style: none; }
.caps li { padding: 7px 0 7px 22px; position: relative; border-bottom: 1px solid #e4e4e7; }
.caps li:before { content: "\2726"; color: #E8590C; position: absolute; left: 2px; }
.proof { margin-top: 18px; font-size: 12.5px; color: #55555c; font-style: italic; }
.right { flex: 1; background: #fff; border-radius: 12px; padding: 22px 22px 10px;
         box-shadow: 0 1px 4px rgba(20,20,22,.10); align-self: flex-start; }
.right h2 { font-size: 17px; font-weight: 700; color: #1c1c1e; margin-bottom: 14px; }
.row { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #ececef; }
.row:last-child { border-bottom: 0; }
.badge { flex: 0 0 34px; height: 34px; border-radius: 50%; background: #faf1e6;
         color: #E8590C; font-size: 16px; display: flex; align-items: center; justify-content: center; }
.row b { display: block; font-size: 14px; color: #1c1c1e; margin-bottom: 2px; }
.row p { font-size: 12.5px; color: #55555c; }
footer { margin: 20px 22px 0; background: #141416; color: #fff; border-radius: 10px;
         padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
footer .cta { font-weight: 700; font-size: 14.5px; }
footer .mark { font-weight: 900; font-size: 12px; letter-spacing: 2px; color: #c9c9cf; }
</style>
</head>
<body>
<div class="sheet">
  <div class="hero">
    <div class="wordmark">MASTERWORKS AI<span class="spark"> ✦</span></div>
    <h1>{{headline}}</h1>
    <div class="sub">{{subheadline}}</div>
  </div>
  <div class="heat"></div>
  <main>
    <div class="left">
      <p class="hook">{{reader_hook}}</p>
      <div class="overview">{{overview}}</div>
      <div class="bar">Key capabilities</div>
      <div class="caps"><ul>{{capabilities}}</ul></div>
      <p class="proof">{{proof}}</p>
    </div>
    <div class="right">
      <h2>What it makes possible</h2>
      <div class="row"><div class="badge">✦</div><div><b>{{pillar_1_title}}</b><p>{{pillar_1_body}}</p></div></div>
      <div class="row"><div class="badge">◉</div><div><b>{{pillar_2_title}}</b><p>{{pillar_2_body}}</p></div></div>
      <div class="row"><div class="badge">➤</div><div><b>{{pillar_3_title}}</b><p>{{pillar_3_body}}</p></div></div>
    </div>
  </main>
  <footer>
    <div class="cta">{{cta}}</div>
    <div class="mark">HIVE BY AURIGO</div>
  </footer>
</div>
</body>
</html>$mwai_tpl$,
  $mwai_slots$[{"id":"headline","label":"Headline","render":"text","purpose":"Outcome-led headline opening from the reader's world, not the product","required":true,"max_chars":60,"source_sections":["B1"]},{"id":"subheadline","label":"Subheadline","render":"text","purpose":"One-sentence positioning: for whom, what, unlike what","required":true,"max_chars":140,"source_sections":["A5","B1"]},{"id":"reader_hook","label":"Reader hook","render":"text","purpose":"The economic buyer's top pain, in language close to their own words","required":true,"max_chars":220,"source_sections":["C1"]},{"id":"overview","label":"Overview","render":"multiline","purpose":"Plain-language description of what the product does day to day","required":true,"max_chars":450,"source_sections":["B3"]},{"id":"pillar_1_title","label":"Pillar 1 title","render":"text","purpose":"First value pillar name","required":true,"max_chars":40,"source_sections":["B2"]},{"id":"pillar_1_body","label":"Pillar 1 body","render":"text","purpose":"What pillar 1 means for the customer","required":true,"max_chars":160,"source_sections":["B2"]},{"id":"pillar_2_title","label":"Pillar 2 title","render":"text","purpose":"Second value pillar name","required":true,"max_chars":40,"source_sections":["B2"]},{"id":"pillar_2_body","label":"Pillar 2 body","render":"text","purpose":"What pillar 2 means for the customer","required":true,"max_chars":160,"source_sections":["B2"]},{"id":"pillar_3_title","label":"Pillar 3 title","render":"text","purpose":"Third value pillar name","required":true,"max_chars":40,"source_sections":["B2"]},{"id":"pillar_3_body","label":"Pillar 3 body","render":"text","purpose":"What pillar 3 means for the customer","required":true,"max_chars":160,"source_sections":["B2"]},{"id":"capabilities","label":"Key capabilities","render":"lines","purpose":"Named capability + its outcome, one item per line","required":true,"max_chars":540,"max_lines":6,"source_sections":["B5"]},{"id":"proof","label":"Proof","render":"text","purpose":"Quantified proof the right to win is real — numbers exactly as approved","required":true,"max_chars":260,"source_sections":["A4"]},{"id":"cta","label":"Call to action","render":"text","purpose":"Concrete next step framed as the reader's move","required":true,"max_chars":120,"source_sections":["E2"]}]$mwai_slots$::jsonb,
  'public-sector capital program owners',
  'Capital Program / PMO Director',
  'consideration',
  'reference output/Output/Masterworks AI/Datasheets/Masterworks AI Overview Datasheet.pdf',
  1
)
on conflict (id) do update set
  name = excluded.name,
  body = excluded.body,
  slots = excluded.slots,
  format = excluded.format,
  approved = excluded.approved,
  exemplar_path = excluded.exemplar_path;
