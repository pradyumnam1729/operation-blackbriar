# 12 — Release Preparation Prompt

Use this prompt to prepare a complete release package: release notes, API changelog, upgrade instructions, deployment checklist, and customer communication draft.

---

## When to Use

- Before every production deployment.
- When creating a release tag in git.
- When preparing customer-facing release notes.
- When briefing the support team on what changed.

## Prerequisites

- The git tag or commit hash of the last release (e.g., `v1.2.0`)
- The intended version number for this release, or "generate it from the changes"
- Any known breaking changes

---

## Release Preparation Prompt

Replace `[LAST_RELEASE_TAG]`, `[RELEASE_DATE]`, and `[TARGET_ENV]`. Paste the full prompt:

---

You are preparing a complete release package for the Aurigo Maintain product. Generate all required release artifacts from the git history since the last release.

**Release context:**
- Last release tag: `[LAST_RELEASE_TAG]`
- Target release date: `[RELEASE_DATE]`
- Target environment: `[TARGET_ENV]`
- Known breaking changes: `[NONE | list breaking changes if known]`

**Step 1 — Gather the changes:**
Run:
```
git log [LAST_RELEASE_TAG]..HEAD --oneline
git log [LAST_RELEASE_TAG]..HEAD --format="%H %s %an %ad" --date=short
git diff [LAST_RELEASE_TAG]..HEAD --name-only
```

For each commit that touches API, entity, or migration files, read the commit diff:
```
git show [COMMIT_SHA] --stat
```

**Step 2 — Read context for domain vocabulary:**
Read `vol-2-product-knowledge/` to ensure release notes use correct Aurigo terminology.

**Step 3 — Categorize all changes:**

- **New Feature** — new functionality that did not exist before
- **Improvement** — enhancement to existing functionality
- **Bug Fix** — correction of incorrect behavior
- **Breaking Change** — any change that requires action from operators or downstream systems
- **Infrastructure / Internal** — migrations, refactoring, dependency updates, CI/CD

**Step 4 — Determine the release version:**

Apply SemVer rules:
- Breaking Change present: MAJOR version bump (1.2.0 to 2.0.0)
- New Feature present, no breaking changes: MINOR version bump (1.2.0 to 1.3.0)
- Only Bug Fixes and Improvements: PATCH version bump (1.2.0 to 1.2.1)

**Step 5 — Produce all release artifacts:**

---

### ARTIFACT 1: Release Notes (Customer-Facing)

**Format requirements:**
- Group by module
- Within each module: new features first, then improvements, then bug fixes
- Write each feature description from the perspective of the affected persona
- Do NOT include infrastructure/internal changes
- Do NOT include PR numbers or commit hashes
- Flag breaking changes prominently at the top
- Use active voice present tense: "Asset Managers can now..." not "The ability to... has been added"

```markdown
# Aurigo Maintain — Release Notes v[VERSION]
Released: [RELEASE_DATE]

## Breaking Changes
> **Action Required**: [description of what operators must do]
[If none: None in this release.]

## What's New

### Asset Inventory
- **[Feature name]**: [1-2 sentences from the persona's perspective.]

### [Other modules as applicable]

## Improvements
- **[Module] — [Improvement]**: [1 sentence description]

## Bug Fixes
- **[Module] — [Fix]**: [1 sentence description of what was wrong and what is now correct]
```

---

### ARTIFACT 2: API Changelog

```markdown
# API Changelog v[VERSION]

## New Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/v1/[path] | [description] | [roles] |

## Modified Endpoints
| Method | Path | Change | Breaking? |
|--------|------|--------|-----------|
| [method] | /api/v1/[path] | [what changed] | Yes/No |

## Deprecated Endpoints
| Method | Path | Replacement | Removal Version |
|--------|------|-------------|-----------------|
| [method] | /api/v1/[path] | /api/v1/[new-path] | v[X.Y] |

## Schema Changes
| Entity/DTO | Field | Change | Breaking? |
|------------|-------|--------|-----------|
| [Name] | [field] | [added/removed/type changed/made required] | Yes/No |
```

---

### ARTIFACT 3: Upgrade Instructions

```markdown
# Upgrade Instructions — v[VERSION]

## Pre-Deployment Checklist
- [ ] Take a database backup: `pg_dump [database_name] > backup-pre-v[VERSION]-$(date +%Y%m%d).sql`
- [ ] Verify the deployment target has the correct environment variables set
- [ ] Verify the last migration in the current deployment matches expected

## New Environment Variables Required
[If none: None.]

| Variable | Description | Example Value |
|----------|-------------|---------------|
| [VAR_NAME] | [what it does] | [example] |

## Database Migrations
[List all new migration names in this release]
- `[MigrationName]` — [what schema change it makes]

Migrations run automatically on startup via `context.Database.MigrateAsync()`. To run manually:
```bash
dotnet ef database update --project src/Aurigo.AssetMaintenance.Infrastructure --startup-project src/Aurigo.AssetMaintenance.Api --connection "[CONNECTION_STRING]"
```

## Breaking Changes — Action Required
[If none: None. This is a backward-compatible release.]

## Post-Deployment Verification
- [ ] `GET /health` returns HTTP 200
- [ ] `GET /api/v1/assets` returns expected data (smoke test)
- [ ] Check application logs for any migration errors in the first 5 minutes

## Rollback Plan
1. Stop the application container
2. Restore the previous container image version
3. If migrations were applied and must be rolled back: `dotnet ef database update [PREVIOUS_MIGRATION_NAME]`
4. Restart with the previous image
5. Notify the on-call engineer
```

---

### ARTIFACT 4: Deployment Checklist

```markdown
# Deployment Checklist — v[VERSION] to [TARGET_ENV]
Date: [RELEASE_DATE]
Engineer: _______________

## Pre-Deployment (T-1 hour)
- [ ] Pre-deployment checklist from Upgrade Instructions complete
- [ ] Database backup verified
- [ ] Staging smoke test passed (if deploying to production)
- [ ] Team notified of deployment window

## Deployment
- [ ] Deploy new container image to [TARGET_ENV]
- [ ] Verify container started without errors
- [ ] Verify database migrations ran: `SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId" DESC LIMIT 1;`
  - Expected: `[LATEST_MIGRATION_NAME]`
- [ ] Verify health endpoint: `curl https://[HOST]/health` returns HTTP 200

## Post-Deployment Smoke Tests
- [ ] Login as a test user (Asset Manager role)
- [ ] Navigate to Asset Inventory — verify assets load
- [ ] Navigate to Dashboard — verify metrics load
- [ ] Test the newly released feature: [SPECIFIC_STEP_FOR_THIS_RELEASE]

## Sign-Off
- [ ] Deployment complete with no errors
- [ ] Release tag created: `git tag v[VERSION] && git push origin v[VERSION]`
- [ ] Release notes published to product portal
- [ ] Support team briefed
```

---

### ARTIFACT 5: Customer Communication Draft

```markdown
Subject: Aurigo Maintain Update — [Headline Feature Name] and [N] more improvements

Dear [Agency Name] Team,

We have released a new update to Aurigo Maintain that includes [N] improvements based on feedback from agencies like yours.

## What is new in this release

**[Top Feature — 2-3 sentences for a non-technical reader]**

**[Second Feature]**

## Also in this release
[Bullet points of other improvements, plain language, no more than 5]

## No action required
This update was applied automatically. All your data is intact and your existing workflows continue as before.
[If breaking change: "One change in this update requires attention — see the attached upgrade guide."]

## Questions?
Contact your Aurigo account manager or reach us at support@aurigo.com.

The Aurigo Maintain Team
```

---
