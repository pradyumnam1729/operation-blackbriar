-- Demo seed data. Idempotent: fixed UUIDs + on conflict do nothing.
-- Product ids: 111...101-103 Masterworks Plan/Build/Maintain, 111...104-106 Primus Plan/Build/Maintain.

-- ---------- team tags ----------
insert into team_tags (id, name) values
  ('22222222-2222-2222-2222-222222222201', 'Sales'),
  ('22222222-2222-2222-2222-222222222202', 'Marketing'),
  ('22222222-2222-2222-2222-222222222203', 'Product'),
  ('22222222-2222-2222-2222-222222222204', 'ELT')
on conflict (name) do nothing;

-- ---------- features (catalog seed; mock until watcher is live) ----------
insert into features (id, product_id, name, description, category, release_date, status, source_url) values
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', 'Capital Needs Scoring', 'Score and rank capital needs across the program using configurable criteria.', 'Capital Planning', '2026-03-15', 'active', 'https://example.com/rn/mw-plan-2026-03'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111101', 'Scenario Comparison', 'Compare funding scenarios side by side with constraint-aware trade-off views.', 'Capital Planning', '2026-05-01', 'active', 'https://example.com/rn/mw-plan-2026-05'),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111101', 'Federal Fund Tracking', 'Track federal funding sources against projects with drawdown visibility.', 'Funding', '2026-01-20', 'changed', 'https://example.com/rn/mw-plan-2026-01'),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111102', 'Change Order Workflows', 'Configurable review and approval workflows for change orders with full audit history.', 'Construction Management', '2026-04-10', 'active', 'https://example.com/rn/mw-build-2026-04'),
  ('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111102', 'RFI Management', 'Route, track, and close RFIs with response-time reporting.', 'Construction Management', '2026-02-14', 'active', 'https://example.com/rn/mw-build-2026-02'),
  ('33333333-3333-3333-3333-333333333306', '11111111-1111-1111-1111-111111111102', 'Paper-Based Submittal Import', 'Import legacy paper-based submittal logs during onboarding.', 'Migration', '2025-11-05', 'deprecated', 'https://example.com/rn/mw-build-2025-11'),
  ('33333333-3333-3333-3333-333333333307', '11111111-1111-1111-1111-111111111103', 'Asset Condition Inspections', 'Mobile-first inspections with offline capture and photo evidence.', 'Inspections', '2026-06-01', 'active', 'https://example.com/rn/mw-maintain-2026-06'),
  ('33333333-3333-3333-3333-333333333308', '11111111-1111-1111-1111-111111111103', 'Preventive Maintenance Scheduling', 'Schedule recurring maintenance from condition and usage triggers.', 'Maintenance', '2026-03-22', 'active', 'https://example.com/rn/mw-maintain-2026-03'),
  ('33333333-3333-3333-3333-333333333309', '11111111-1111-1111-1111-111111111104', 'Portfolio Investment Modeling', 'Model capital portfolio investments across facilities with sensitivity analysis.', 'Portfolio Planning', '2026-04-18', 'active', 'https://example.com/rn/pr-plan-2026-04'),
  ('33333333-3333-3333-3333-33333333330a', '11111111-1111-1111-1111-111111111105', 'Contractor Collaboration Portal', 'External contractor access with scoped permissions and document exchange.', 'Construction Management', '2026-05-12', 'active', 'https://example.com/rn/pr-build-2026-05'),
  ('33333333-3333-3333-3333-33333333330b', '11111111-1111-1111-1111-111111111106', 'Warranty Claim Tracking', 'Track warranty claims from initiation to resolution with vendor SLAs.', 'Maintenance', '2026-02-28', 'active', 'https://example.com/rn/pr-maintain-2026-02'),
  ('33333333-3333-3333-3333-33333333330c', '11111111-1111-1111-1111-111111111106', 'Work Order Dispatch', 'Dispatch and track work orders with technician assignment and status.', 'Maintenance', '2026-06-20', 'active', 'https://example.com/rn/pr-maintain-2026-06')
on conflict (id) do nothing;

-- ---------- opportunities (~20 mock, until Salesforce is provisioned) ----------
insert into opportunities (id, sf_id, name, account_name, product_line, stage, amount, competitor, loss_reason, closed_at, owner) values
  ('44444444-4444-4444-4444-444444444401', 'SF-0001', 'State DOT Capital Program Modernization', 'Mountain State DOT', 'Masterworks', 'closed_won', 1850000, 'Oracle Primavera', null, '2026-05-14', 'R. Alvarez'),
  ('44444444-4444-4444-4444-444444444402', 'SF-0002', 'Regional Transit CIP Platform', 'Bayline Transit Authority', 'Masterworks', 'closed_won', 920000, 'e-Builder', null, '2026-04-02', 'S. Iyer'),
  ('44444444-4444-4444-4444-444444444403', 'SF-0003', 'County Public Works Program', 'Harrison County', 'Masterworks', 'closed_lost', 410000, 'Kahua', 'Price', '2026-03-19', 'R. Alvarez'),
  ('44444444-4444-4444-4444-444444444404', 'SF-0004', 'City Water Infrastructure Program', 'City of Delmont', 'Masterworks', 'closed_lost', 680000, 'e-Builder', 'Incumbent relationship', '2026-02-27', 'T. Okafor'),
  ('44444444-4444-4444-4444-444444444405', 'SF-0005', 'Airport Expansion Program Controls', 'Northgate Airport Authority', 'Masterworks', 'closed_won', 2400000, 'Kahua', null, '2026-06-09', 'S. Iyer'),
  ('44444444-4444-4444-4444-444444444406', 'SF-0006', 'Data Center Capital Portfolio', 'Vantex Data Centers', 'Primus', 'closed_won', 1300000, 'Procore', null, '2026-05-30', 'M. Chen'),
  ('44444444-4444-4444-4444-444444444407', 'SF-0007', 'Life Sciences Campus Buildout', 'Helixion Labs', 'Primus', 'closed_lost', 750000, 'Procore', 'Feature gap - field tools', '2026-04-21', 'M. Chen'),
  ('44444444-4444-4444-4444-444444444408', 'SF-0008', 'Utility Grid Modernization Portfolio', 'Central Plains Energy', 'Primus', 'closed_won', 1950000, 'Oracle Primavera', null, '2026-03-08', 'D. Whitfield'),
  ('44444444-4444-4444-4444-444444444409', 'SF-0009', 'Municipal Facilities Program', 'City of Arden', 'Masterworks', 'closed_lost', 290000, 'Spreadsheets/Status quo', 'No decision', '2026-01-30', 'T. Okafor'),
  ('44444444-4444-4444-4444-44444444440a', 'SF-0010', 'Statewide Bridge Program', 'Lakeland DOT', 'Masterworks', 'closed_won', 3100000, 'AgileAssets', null, '2026-06-25', 'R. Alvarez'),
  ('44444444-4444-4444-4444-44444444440b', 'SF-0011', 'Manufacturing Plant Expansion', 'Ironvale Manufacturing', 'Primus', 'closed_lost', 520000, 'Kahua', 'Price', '2026-05-05', 'M. Chen'),
  ('44444444-4444-4444-4444-44444444440c', 'SF-0012', 'Port Authority Program Controls', 'Eastbay Port Authority', 'Masterworks', 'closed_won', 1450000, 'e-Builder', null, '2026-02-12', 'S. Iyer'),
  ('44444444-4444-4444-4444-44444444440d', 'SF-0013', 'Higher-Ed Campus Program', 'Ridgemont University', 'Masterworks', 'closed_lost', 380000, 'e-Builder', 'Procurement timing', '2026-04-15', 'T. Okafor'),
  ('44444444-4444-4444-4444-44444444440e', 'SF-0014', 'Energy Storage Facilities Rollout', 'Brightcell Energy', 'Primus', 'closed_won', 860000, 'Procore', null, '2026-01-22', 'D. Whitfield'),
  ('44444444-4444-4444-4444-44444444440f', 'SF-0015', 'County Road Maintenance Program', 'Silver Creek County', 'Masterworks', 'closed_won', 540000, 'Spreadsheets/Status quo', null, '2026-03-28', 'R. Alvarez'),
  ('44444444-4444-4444-4444-444444444410', 'SF-0016', 'Hospital Network Capital Program', 'Caremont Health', 'Primus', 'closed_lost', 1100000, 'Oracle Primavera', 'Executive sponsor change', '2026-06-02', 'M. Chen'),
  ('44444444-4444-4444-4444-444444444411', 'SF-0017', 'Water District CIP', 'Twin Rivers Water District', 'Masterworks', 'closed_won', 720000, 'Kahua', null, '2026-05-19', 'S. Iyer'),
  ('44444444-4444-4444-4444-444444444412', 'SF-0018', 'Semiconductor Fab Program', 'Corex Semiconductors', 'Primus', 'closed_won', 2750000, 'Kahua', null, '2026-04-30', 'D. Whitfield'),
  ('44444444-4444-4444-4444-444444444413', 'SF-0019', 'Transit Rail Extension Program', 'Metro Junction Transit', 'Masterworks', 'closed_lost', 1600000, 'Oracle Primavera', 'Feature gap - scheduling depth', '2026-02-05', 'T. Okafor'),
  ('44444444-4444-4444-4444-444444444414', 'SF-0020', 'Logistics Hub Portfolio', 'Crossdock Logistics', 'Primus', 'closed_lost', 430000, 'Procore', 'Price', '2026-03-11', 'M. Chen')
on conflict (sf_id) do nothing;

-- ---------- templates (mock Canva gallery) ----------
insert into templates (id, name, asset_type, product_line, preview_color, approved) values
  ('55555555-5555-5555-5555-555555555501', 'Masterworks Datasheet - Teal', 'datasheet', 'Masterworks', '#015F74', true),
  ('55555555-5555-5555-5555-555555555502', 'Masterworks Sales Deck - Standard', 'deck', 'Masterworks', '#053445', true),
  ('55555555-5555-5555-5555-555555555503', 'Masterworks One-Pager - Outcomes', 'one-pager', 'Masterworks', '#46B2BE', true),
  ('55555555-5555-5555-5555-555555555504', 'Primus Datasheet - Teal', 'datasheet', 'Primus', '#015F74', true),
  ('55555555-5555-5555-5555-555555555505', 'Primus FAQ - Standard', 'faq', 'Primus', '#053445', true),
  ('55555555-5555-5555-5555-555555555506', 'Primus One-Pager - Facility Owners', 'one-pager', 'Primus', '#46B2BE', true)
on conflict (id) do nothing;

-- ---------- prompt library ----------
insert into prompt_library (id, name, asset_type, body) values
  ('66666666-6666-6666-6666-666666666601', 'Datasheet from feature catalog', 'datasheet', 'Using the selected product''s feature catalog and positioning, produce a one-page datasheet: reader-first opening, three outcome-led capability sections, one proof point, clear next step.'),
  ('66666666-6666-6666-6666-666666666602', 'Competitive deck outline', 'deck', 'Produce a 10-slide sales deck outline following the 7-step narrative arc, tailored to the selected persona, with speaker notes per slide.'),
  ('66666666-6666-6666-6666-666666666603', 'FAQ from objection library', 'faq', 'Turn the objection library for the selected product into a customer-facing FAQ: natural-language questions, direct answers, AEO-structured.'),
  ('66666666-6666-6666-6666-666666666604', 'Executive one-pager', 'one-pager', 'Produce an executive one-pager: named program outcomes, decision being asked, differentiated capabilities, one proof point per claim.')
on conflict (id) do nothing;

-- ---------- sample artifacts with versions (demo diff/rollback) ----------
insert into artifacts (id, title, asset_type, product_id, persona, status, current_version) values
  ('77777777-7777-7777-7777-777777777701', 'Masterworks Build One-Pager - Public Owners', 'one-pager', '11111111-1111-1111-1111-111111111102', 'Program Director', 'final', 2),
  ('77777777-7777-7777-7777-777777777702', 'Primus Maintain Datasheet - Facility Owners', 'datasheet', '11111111-1111-1111-1111-111111111106', 'VP of Facilities', 'in_review', 3),
  ('77777777-7777-7777-7777-777777777703', 'Masterworks Plan FAQ - Capital Planners', 'faq', '11111111-1111-1111-1111-111111111101', 'Capital Planner', 'draft', 1)
on conflict (id) do nothing;

insert into artifact_versions (artifact_id, version, content_html, note) values
  ('77777777-7777-7777-7777-777777777701', 1,
   '<h1>Deliver capital projects with confidence</h1><p>Your program is growing faster than your delivery capacity. Masterworks Build gives government agencies a unified system for construction management: change orders, RFIs, submittals, and pay estimates in one place.</p><h2>What changes for your team</h2><ul><li>Change orders reviewed in days, not weeks</li><li>Complete audit history on every decision</li><li>Field and office working from the same record</li></ul>',
   'Initial draft'),
  ('77777777-7777-7777-7777-777777777701', 2,
   '<h1>Deliver capital projects with confidence</h1><p>Your program is growing faster than your delivery capacity. Masterworks Build gives government agencies a unified system for construction management: change orders, RFIs, submittals, and pay estimates in one place.</p><h2>What changes for your team</h2><ul><li>Change orders reviewed in days, not weeks</li><li>Complete audit history on every decision</li><li>Field and office working from the same record</li></ul><h2>Proof</h2><p>Utah DOT manages its statewide program on Masterworks, saving an estimated $19.5M per year in program delivery costs.</p>',
   'Added proof point after evidence review'),
  ('77777777-7777-7777-7777-777777777702', 1,
   '<h1>Primus Maintain</h1><p>Keep every facility running at capacity. Primus Maintain brings work orders, preventive maintenance, and warranty tracking into one system for facility owners.</p>',
   'Initial draft'),
  ('77777777-7777-7777-7777-777777777702', 2,
   '<h1>Primus Maintain</h1><p>Unplanned downtime is the most expensive line item you do not budget for. Primus Maintain brings work orders, preventive maintenance, and warranty tracking into one system for facility owners.</p><h2>Capabilities</h2><ul><li>Condition-triggered preventive maintenance</li><li>Work order dispatch with technician tracking</li><li>Warranty claims with vendor SLAs</li></ul>',
   'Reader-first opening per voice review'),
  ('77777777-7777-7777-7777-777777777702', 3,
   '<h1>Primus Maintain</h1><p>Unplanned downtime is the most expensive line item you do not budget for. Primus Maintain brings work orders, preventive maintenance, and warranty tracking into one system for facility owners.</p><h2>Capabilities</h2><ul><li>Condition-triggered preventive maintenance</li><li>Work order dispatch with technician tracking</li><li>Warranty claims with vendor SLAs</li></ul><h2>Outcome</h2><p>Facility teams cut reactive maintenance share and extend asset life across the portfolio.</p>',
   'Added outcome section'),
  ('77777777-7777-7777-7777-777777777703', 1,
   '<h1>Masterworks Plan - Frequently Asked Questions</h1><h2>How does capital needs scoring work?</h2><p>Needs are scored against configurable criteria your agency defines, then ranked into a defendable, transparent priority list.</p><h2>Can we compare funding scenarios?</h2><p>Yes. Scenario comparison shows trade-offs side by side under real funding constraints.</p>',
   'Initial draft')
on conflict (artifact_id, version) do nothing;

-- ---------- integrations (local SharePoint stand-ins, disabled until flag on) ----------
insert into integrations (id, kind, name, config, enabled) values
  ('88888888-8888-8888-8888-888888888801', 'sharepoint_local', 'Masterworks release notes folder', '{"path": "./mock-sharepoint/masterworks", "doc_type": "release_note"}', false),
  ('88888888-8888-8888-8888-888888888802', 'sharepoint_local', 'Primus release notes folder', '{"path": "./mock-sharepoint/primus", "doc_type": "release_note"}', false),
  ('88888888-8888-8888-8888-888888888803', 'sharepoint_local', 'PRD & JTBD library folder', '{"path": "./mock-sharepoint/context", "doc_type": "prd"}', false)
on conflict (id) do nothing;
