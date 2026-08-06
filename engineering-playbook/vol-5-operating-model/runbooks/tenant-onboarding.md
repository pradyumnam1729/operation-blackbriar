# Runbook: Tenant onboarding (PRE-AUTOMATION)

> Version: `v0.1 — 2026-07-23` • Owner: Delivery Engineering • Reviewed: `2026-07-23`

> **[!] READ THIS FIRST — this is a pre-automation runbook.** Tenant onboarding is a
> Delivery Engineer procedure today. Phase 6 of `execution-plan.md § Data migration
> tooling` replaces it with self-service tooling (target: months 8–10). Until Phase 6
> ships, every new paying customer follows this runbook. If you find yourself running
> this more than twice a month, that's the signal to prioritize Phase 6.

---

## Symptom

Not an incident. Read when:

- Sales closed a new customer and Delivery has been asked to spin up their tenant.
- A prospect wants a dedicated demo tenant (not the shared `demo` tenant) — same steps,
  but flag as `IsDemo = true`.
- An existing tenant needs to be cloned for a training environment.

---

## Severity + expected TTR

- **New paying customer onboarding:** target 3 business days end-to-end (SQL work,
  credential setup, initial import, verification). Delivery commitment; not an SLO.
- **Demo tenant:** target 1 business day.
- **Reactive fix during an onboarding:** whatever severity band the customer's blocker
  matches from `README.md § Severity + TTR reference`.

---

## Preconditions

- Sales has completed the Order Form and shared the customer's:
  - Legal name (goes into `Tenant.Name`).
  - Industry vertical (goes into `Tenant.IndustryVertical` — must match an enum value
    in `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Enums/
    IndustryVertical.cs`; common values include `PublicAgency`, `Private`, plus
    the primus vertical set — verify the value exists BEFORE running the INSERT).
  - Primary admin's first name, last name, work email.
  - Which integrations they will connect on day one (Cityworks, Maximo, ArcGIS, Aurigo
    Plan, Aurigo Build — determines which credential intake to schedule).
  - Whether they will provide initial asset data via file drop (CSV / GeoJSON /
    Shapefile) or hand-key.
- You have `psql` access to the target environment's RDS instance (via bastion or IAM
  DB auth) with `INSERT` on the `tenants`, `roles`, `role_page_permissions`,
  `app_users`, `user_roles`, `asset_classes`, `assessment_templates`, `unit_cost_rates`,
  `inflation_config`, `model_settings` tables.
- You have Secrets Manager write access for the tenant's future integration credentials.
- You have `TenantProvisioner` code understood — see
  `backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/
  Persistence/TenantProvisioner.cs`. It exists as a class today and IS invoked via the
  admin console for local dev, but production ops has not yet exposed a UI or CLI for
  Delivery — the manual SQL below mirrors what the class does. When Phase 6 lands, this
  runbook collapses into "click Provision in the admin console."

---

## Diagnosis steps (pre-onboarding sanity)

1. **Confirm the tenant slug is not taken.**
   ```
   psql "$RDS_URL" -c "SELECT id, name, slug FROM tenants WHERE slug = '<proposed-slug>';"
   ```
   - Expected: zero rows.
   - Failure: row exists → pick a new slug. Slugs are stable; do NOT reuse them.

2. **Confirm the admin email is not taken.**
   ```
   psql "$RDS_URL" -c "SELECT id, tenant_id, email FROM app_users \
     WHERE lower(email) = lower('<admin-email>');"
   ```
   - Expected: zero rows.
   - Failure: email in use — a person cannot be admin of two tenants under the same
     email. Coordinate with Sales to get a distinct admin email OR use a `+tenant` alias
     (`admin+customera@company.com`) if the customer's mail server strips them.

3. **Confirm the industry vertical exists.**
   ```
   grep -n "IndustryVertical\." \
     backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Domain/Enums/IndustryVertical.cs
   ```
   - Expected: your target vertical appears in the enum.
   - Failure: does not exist → do NOT add it inline as part of onboarding. File a
     backend ticket to add the enum value + seed data, then wait. Adding a value at the
     end of the enum is additive (safe per `db-migration.md § Additive checklist`);
     reordering is not.

---

## Recovery steps (the actual onboarding)

Numbered. Do these in order. Each step has a verification.

### Step 1 — Create the tenant row

```sql
INSERT INTO tenants (
  id, name, slug, industry_vertical, is_demo, created_at, created_by
) VALUES (
  gen_random_uuid(),                       -- id
  '<Customer Legal Name>',                 -- name
  '<customer-slug>',                       -- slug (kebab-case, unique)
  <IndustryVertical enum int>,             -- industry_vertical (see MEMORY.md — enums serialize as ints)
  FALSE,                                   -- is_demo
  now(),                                   -- created_at
  '<your-app-user-id>'                     -- created_by
) RETURNING id;
```

Save the returned `id` — you'll use it as `TENANT_ID` for every subsequent step.

Verify:
```
psql "$RDS_URL" -c "SELECT id, name, slug FROM tenants WHERE id = '<TENANT_ID>';"
```

### Step 2 — Seed roles

The standard role set is defined in
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/
DefaultRbacSeed.cs`. In production, Delivery runs the equivalent SQL:

```sql
-- Copy the standard role set for this tenant.
-- Roles: Administrator, AssetManager, Inspector, Planner, Viewer (see DefaultRbacSeed.cs
-- for the current authoritative list).
INSERT INTO roles (id, tenant_id, name, description, is_system, created_at)
SELECT gen_random_uuid(), '<TENANT_ID>', name, description, is_system, now()
FROM roles WHERE tenant_id = '<DEMO_TENANT_ID>' AND is_system = TRUE;

-- Copy the role → page permission mappings.
INSERT INTO role_page_permissions (id, tenant_id, role_id, page_key, permission, created_at)
SELECT gen_random_uuid(), '<TENANT_ID>', new_r.id, rpp.page_key, rpp.permission, now()
FROM role_page_permissions rpp
JOIN roles old_r ON old_r.id = rpp.role_id AND old_r.tenant_id = '<DEMO_TENANT_ID>'
JOIN roles new_r ON new_r.tenant_id = '<TENANT_ID>' AND new_r.name = old_r.name;
```

Verify:
```
psql "$RDS_URL" -c "SELECT name, is_system FROM roles WHERE tenant_id = '<TENANT_ID>';"
```
- Expected: at least Administrator, AssetManager, Inspector, Planner, Viewer.

### Step 3 — Copy configuration from the demo tenant

`TenantProvisioner.ProvisionAsync` copies configuration (asset classes + components,
assessment templates, unit-cost rates, inflation, model settings) but no assets or
inspections. Mirror it in SQL:

```sql
-- Asset classes
INSERT INTO asset_classes (id, tenant_id, name, description, ...)
SELECT gen_random_uuid(), '<TENANT_ID>', name, description, ...
FROM asset_classes WHERE tenant_id = '<DEMO_TENANT_ID>';

-- Asset components (linked to the new asset_classes)
-- ... build the mapping in a CTE or a script; the column list is long, use \d asset_components
--     to enumerate.

-- Assessment templates + attributes (same pattern)
-- Unit cost rates
-- Inflation config
-- Model settings
```

For any tenant with a non-standard vertical (e.g. Primus's private-sector), consult the
vertical's seed override in
`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/Persistence/
SeedRunner.cs` before running — some verticals ship a different default catalog. If in
doubt, run `SeedRunner`'s vertical-specific path via a one-off Fargate task rather than
by-hand SQL (safer, matches what the code does).

Verify counts match a healthy tenant:
```
psql "$RDS_URL" -c "SELECT \
  (SELECT count(*) FROM asset_classes WHERE tenant_id = '<TENANT_ID>') AS classes, \
  (SELECT count(*) FROM asset_components WHERE tenant_id = '<TENANT_ID>') AS comps, \
  (SELECT count(*) FROM assessment_templates WHERE tenant_id = '<TENANT_ID>') AS tmpls, \
  (SELECT count(*) FROM unit_cost_rates WHERE tenant_id = '<TENANT_ID>') AS rates;"
```
- Expected: counts > 0 for all four.

### Step 4 — Create the first admin user

```sql
INSERT INTO app_users (
  id, tenant_id, email, first_name, last_name, status, created_at, created_by
) VALUES (
  gen_random_uuid(),
  '<TENANT_ID>',
  '<admin-email>',
  '<first-name>',
  '<last-name>',
  <UserStatus.PendingActivation enum int>,
  now(),
  '<your-app-user-id>'
) RETURNING id;
```

Save the returned `id` as `ADMIN_USER_ID`.

Assign the Administrator role:
```sql
INSERT INTO user_roles (id, tenant_id, user_id, role_id, granted_at, granted_by)
SELECT gen_random_uuid(), '<TENANT_ID>', '<ADMIN_USER_ID>', r.id, now(),
       '<your-app-user-id>'
FROM roles r
WHERE r.tenant_id = '<TENANT_ID>' AND r.name = 'Administrator';
```

Verify:
```
psql "$RDS_URL" -c "SELECT u.email, u.status, r.name \
  FROM app_users u \
  JOIN user_roles ur ON ur.user_id = u.id \
  JOIN roles r ON r.id = ur.role_id \
  WHERE u.tenant_id = '<TENANT_ID>';"
```

Then generate an activation invite link:

> **[!] Punt point.** The `IAccountMailer` interface is invoked by
> `TenantProvisioner.ProvisionAsync` to send the activation email. In production today,
> `IAccountMailer` has a stub implementation — no real email is sent. Delivery must
> manually construct the activation URL and share it with the customer over a secure
> channel (SSO-authenticated email, phone). The activation URL format is
> `https://<env>.maintain.aurigo.net/activate?token=<activation-token>`; the token is
> generated by calling the internal `POST /api/v1/admin/users/{id}/activation-link`
> endpoint. This is punted until the transactional email provider is wired (Phase 3,
> `execution-plan.md § Observability & ops` covers Sentry / error tracking but the
> transactional email service is NOT yet in a phase — file follow-up ticket during
> onboarding if it hasn't landed).

### Step 5 — Set up integration credentials

For each integration the customer will connect on day one, insert an encrypted
credential row into `tenant_integration_credentials`. The application encrypts the
secret at rest using the KMS-backed data protection key configured in
`Api/Program.cs`. Delivery does NOT put the raw secret into the SQL — instead:

1. Ask the customer to submit their credentials via the secure intake form (Aurigo's
   standard 1Password shared vault, per Security Policy §4).
2. Log into the admin console as the tenant admin (using the activation link from
   Step 4).
3. Navigate to Configuration → Integrations → `<vendor>` → Add credentials. Paste. Save.
4. The console encrypts + stores. Verify the row exists:
   ```
   psql "$RDS_URL" -c "SELECT id, vendor, connection_status, last_synced_at \
     FROM tenant_integration_credentials WHERE tenant_id = '<TENANT_ID>';"
   ```
   - Expected: one row per configured integration, `connection_status = 'Connected'`
     after the first successful test call.

> **[!] Punt point.** Bulk integration credential provisioning (e.g. "customer has 20
> Cityworks tenants across their orgs and needs each connected") has no scripted path
> today — Delivery clicks through the console once per credential set. Phase 6 tooling
> should replace this.

### Step 6 — Load initial asset data

Two paths, depending on how the customer is providing data.

**Path A — File drop (CSV / GeoJSON / Shapefile).** Use `PublicDataImporter`
(`backend/Aurigo.AssetMaintenance/src/Aurigo.AssetMaintenance.Infrastructure/
Persistence/PublicDataImporter.cs`). It's the same class the code uses for the demo
data seed. Run via the `run-public-import` Fargate one-shot task:
```
aws ecs run-task --cluster maintain-prod --task-definition maintain-public-import \
  --overrides '{
    "containerOverrides": [{
      "name": "importer",
      "environment": [
        {"name": "TENANT_ID", "value": "<TENANT_ID>"},
        {"name": "SOURCE_S3_URI", "value": "s3://customer-drops/<customer>/initial.geojson"},
        {"name": "ASSET_CLASS_MAPPING", "value": "<json map>"}
      ]
    }]
  }'
```

> **[!] Punt point.** The `run-public-import` Fargate task-def is spec'd in
> `execution-plan.md § Phase 1` but the specific overrides above are illustrative — the
> exact override contract has not yet been defined because `PublicDataImporter` is
> currently invoked in-process by seeders, not as a standalone binary. Delivery today
> uses a temporary workaround: SSH to a bastion, run `dotnet run --project
> src/Aurigo.AssetMaintenance.Api -- --import <path>` with a custom command-line handler.
> Formalizing the task-def is a Phase 1 backend follow-up.

**Path B — Manual insert.** For a customer with < 500 assets, Delivery hand-writes an
INSERT script from a spreadsheet. Template lives in `seeds/customer-onboarding-template.
sql` (create if missing — currently ad-hoc per customer). Do NOT commit customer-specific
scripts to the repo.

Verify:
```
psql "$RDS_URL" -c "SELECT count(*), \
  min(condition_rating), max(condition_rating), avg(condition_rating) \
  FROM assets WHERE tenant_id = '<TENANT_ID>';"
```
- Expected: count matches the customer's data set, condition ratings in a sensible band.

### Step 7 — Smoke test with the admin

1. Send the activation link (Step 4 punt point).
2. Ask the customer admin to log in, view the asset list, open one asset detail, run one
   inspection, generate a TAMP report preview.
3. On the Delivery side, verify audit log rows landed:
   ```
   psql "$RDS_URL" -c "SELECT count(*), min(created_at), max(created_at) \
     FROM audit_log WHERE tenant_id = '<TENANT_ID>';"
   ```
   - Expected: rows exist, timestamps cluster around the customer's login window.

---

## Post-onboarding actions

- [ ] Announce the new tenant in `#delivery` with the tenant slug, admin email, and
      integrations wired.
- [ ] File a Salesforce update on the Order Form.
- [ ] Add the customer to the on-call `tenants at higher risk of pages during their
      first 30 days` watch list (see `oncall-handoff.md § Expected customer touchpoints`).
- [ ] Schedule the 7-day check-in with the customer.
- [ ] If any punt point above required a manual workaround, file a Phase 6 follow-up
      ticket referencing this runbook version. Do NOT let manual workarounds become
      permanent — the whole runbook is temporary.
- [ ] Bump this runbook's version + reviewed date if any step was wrong.

---

## Related runbooks

- [`db-migration.md`](./db-migration.md) — if a customer requires a schema change
  (custom field, new enum value) as part of onboarding.
- [`incident-response.md`](./incident-response.md) — if onboarding steps fail in a way
  that affects other tenants (never should — every SQL above is tenant-scoped — but if
  something leaks, escalate immediately).

## Related dashboards

- Grafana `Tenants — active + new-in-week`.
- Grafana `Integration sync status by tenant`.
- CloudWatch `RDS query performance` — watch during large `PublicDataImporter` runs.

## Related alerts

- Not applicable — onboarding is manual and paced. If an alert fires during onboarding,
  it's an incident (jump to `incident-response.md`).

---

## Runbook feedback

Did this runbook help? Was a step wrong? Which punt point did you hit? Post in Slack
`#runbook-feedback` with:

```
Runbook: tenant-onboarding.md
Version: v0.1 — 2026-07-23
Customer: <slug>
Date onboarded: YYYY-MM-DD
Punt points hit: <list>
Manual workarounds used: <list>
What worked:
What was wrong or missing:
Suggested edit (optional):
Would Phase 6 tooling have avoided the pain?
```
