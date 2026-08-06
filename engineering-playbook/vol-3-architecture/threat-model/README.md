# Threat Model Workshop Kit — Aurigo Maintain

> Volume 3 · Architecture · Threat Model
> Owner: Tech Architect · Facilitator: Engineering Director
> Status: **Pre-workshop draft — Week 3 target**

---

## Purpose

This folder is a **workshop kit**, not a threat model in itself. It exists so the Week 3 threat-model workshop can start hot instead of from a blank whiteboard. The five files here compress ~2 hours of prep into a shared reading pack:

1. `README.md` — this file. How to run the workshop.
2. `data-flow-diagrams.md` — five DFDs (login, asset create, inspection submit, capital-need push, TAMP publish) with trust boundaries drawn.
3. `threat-catalog-seed.md` — 20+ STRIDE threats already identified, mapped to DFDs, with existing mitigations cited.
4. `output-template.md` — the workshop's deliverable template, pre-filled with system-specific context (tenants, auth model, external systems, compliance surface).
5. `mitigation-owners.md` — routing table: threat category → role responsible for authoring the mitigation.

The **output** of the workshop is a completed `SEC-YYYY-NNNN-maintain-threat-model.md` (using `output-template.md`), committed to `vault/security/`.

---

## How to Run the Workshop

### Duration

**4 hours** (half-day), with two 15-minute breaks:

| Time | Segment | Owner |
|---|---|---|
| 00:00 – 00:15 | Kickoff: scope, ground rules, review DFDs on-screen | Engineering Director |
| 00:15 – 01:00 | Walk DFD-1 (Auth) + DFD-2 (Asset Create) — accept/reject/refine seeded threats | Tech Architect (scribe) |
| 01:00 – 01:15 | **Break** | — |
| 01:15 – 02:00 | Walk DFD-3 (Inspection → RUL/ARV/Risk) + DFD-4 (Capital Need → Plan) | Tech Architect |
| 02:00 – 02:30 | Walk DFD-5 (TAMP publish) — highest external-exposure surface | Tech Architect |
| 02:30 – 02:45 | **Break** | — |
| 02:45 – 03:30 | Elevation-of-privilege / cross-cutting threats (secrets, supply chain, DoS) | Backend Lead + DevOps |
| 03:30 – 03:50 | Assign mitigation owners + due dates per `mitigation-owners.md` | Engineering Director |
| 03:50 – 04:00 | Close: confirm output artifact, follow-up ADRs, next review date | Engineering Director |

### Attendees

Roles referenced from `engineering-playbook/vol-4-ai-organization/`:

**Required — no proxies:**
- `01-engineering-director.md` — **facilitator**. Owns time, blocks tangents, arbitrates severity disputes, assigns owners at close.
- `03-tech-architect.md` — **scribe + technical lead**. Walks the DFDs, reads seeded threats aloud, records new threats and refined mitigations directly into `output-template.md` on-screen.
- `04-backend-lead.md` — authoritative on JWT validation, EF query filters, `SaveChangesInterceptor`, `HttpBodyScrubber`, `SubmitInspectionCommand` cascade. Also called out as mitigation owner for most Authentication/Authorization/Tenancy threats.
- `05-frontend-lead.md` — authoritative on JWT handling in the SPA, CSP headers, `dangerouslySetInnerHTML` risk on TAMP markdown, printable-PDF path.
- `07-devops-engineer.md` — authoritative on Secrets Manager, IAM, WAF, ALB, ECS, RDS network posture, Dependabot/Snyk coverage.
- `09-integration-strategist.md` — authoritative on Aurigo Plan OAuth, Maximo/Cityworks/Primavera credentials, retry/backoff, echo detection.

**Optional — attend if available, otherwise brief async:**
- `06-qa-lead.md` — regression suite for `TenantIsolationTests.cs`, injection fuzzing, negative-path coverage.
- `11-business-analyst.md` — clarifies which data classes are Restricted-PII vs Confidential (inspector PII, agency financials, TAMP attestations).

Not invited (to keep the room tight): Product Manager, UX Strategist, Lifecycle Domain Expert, AI Engineer, Documentation Engineer. Read-out is delivered to them after.

### Pre-Work (mandatory — 60 min of reading)

Each attendee MUST read before walking in:

1. All 5 files in this folder (`README.md`, `data-flow-diagrams.md`, `threat-catalog-seed.md`, `output-template.md`, `mitigation-owners.md`).
2. `engineering-playbook/vol-3-architecture/07-security.md` — current security baseline (authn, input validation, injection prevention, secrets, audit log, compliance).
3. `engineering-playbook/vol-3-architecture/08-authorization.md` — RBAC hierarchy, permission matrix, EF global query filter pattern, SuperAdmin impersonation.
4. `engineering-playbook/vol-3-architecture/17-tenant-isolation-audit.md` — the four open tenant-leak bugs (BUG-01…BUG-04). These pre-populate Section 3 of the catalog and are the workshop's "known priors."

Optional but recommended:
- `engineering-playbook/vol-6-integration-strategy/00-integration-overview.md` § Integration Security Model (credential storage, rotation, network isolation, audit).
- `engineering-playbook/vol-2-product-knowledge/domains/tamp.md` — the external compliance surface (§ 515.9 TAMP, § 490 PM2 metrics, 4-year cycle with annual consistency determination).

**Enforcement:** the ED opens the workshop by asking each attendee to confirm they read the four required docs. Anyone who hasn't is sent to read for 30 min before rejoining. No exceptions — an unprepared attendee slows the whole room.

### Ground Rules

1. **No scope creep to fixes.** The workshop identifies threats and assigns owners. Fixes are separate work items authored by the owner post-workshop.
2. **Cite the standard.** Every mitigation must reference an existing doc (`vol-3-architecture/07-security.md`, `08-authorization.md`, `17-tenant-isolation-audit.md`, `vol-6-integration-strategy/*`). If no standard exists yet, flag as `OPEN — needs ADR` and the Tech Architect adds it to the follow-up list.
3. **STRIDE per DFD, not per component.** We walk data flows, not services. This keeps the room on trust-boundary crossings, which is where threats live.
4. **Severity is jointly assigned.** The scribe proposes, the room challenges, the ED breaks ties. Use CVSS-style Low / Medium / High / Critical.
5. **Every threat gets an owner or gets dropped.** Threats without owners rot. If no role in the room owns it, either the ED takes it or the threat is explicitly deferred with a review date.

### Facilitator Checklist (Day-Of)

**Before the room opens:**

- [ ] Big screen shows `output-template.md` open in an editor with the pre-filled sections visible.
- [ ] Second screen shows `data-flow-diagrams.md` rendered (Mermaid preview works in VS Code + GitHub).
- [ ] Attendee list confirmed 24 hours prior; any absences reassigned or workshop rescheduled.
- [ ] Pre-work confirmation Slack thread posted the morning-of with a thumbs-up react required.
- [ ] Room booked with whiteboard AND video-call bridge (assume 1–2 remote attendees).

**During the workshop:**

- [ ] Timer visible. Each DFD segment is time-boxed per the schedule above.
- [ ] Scribe updates `output-template.md` in real time — no post-hoc reconstruction from photos of a whiteboard.
- [ ] Every threat lands in the STRIDE table with columns filled: `ID | STRIDE cat | Threat | Existing mitigation | Residual risk | Owner | Due date`.
- [ ] Any "OPEN — no standard" flag is captured in a running list on the second screen.

**Before the room closes:**

- [ ] Every threat has an owner name (not a role — a specific person).
- [ ] Every "OPEN — no standard" is either accepted as a follow-up ADR (with target ADR number) or explicitly rejected.
- [ ] Next review date scheduled (default: 90 days, or on next major architecture change per `vol-3-architecture/07-security.md` § Security Review Requirements).

**After the workshop (within 48 hours):**

- [ ] Completed `SEC-YYYY-NNNN-maintain-threat-model.md` committed to `vault/security/`.
- [ ] Follow-up ADRs opened for every `OPEN` flag, assigned to Tech Architect.
- [ ] Read-out email sent to non-attendees (Product Manager, UX, AI Engineer, Documentation Engineer) with the top 5 threats and their owners.
- [ ] `vault/security/README.md` updated with a link to the new threat model and its next review date.

---

## When to Refresh This Kit

The seed catalog reflects the codebase as of **2026-07-23** (branch `primusmaintain-v2`). Refresh triggers:

- Any new external integration reaches production (extend DFDs, add adapter-specific threats).
- Any new controller adds `[AllowAnonymous]` (extend DFD-5 template — public surface expansion).
- A tenant-isolation regression is found and added to `17-tenant-isolation-audit.md`.
- SOC 2 Type II pen-test surfaces threats not already catalogued (see `vol-8-roadmaps/03-ga.md` § SOC 2 Type II).
- Quarterly, per Tech Architect Continuous Improvement cadence (`03-tech-architect.md`).

---

## Cross-References

- `engineering-playbook/vol-3-architecture/07-security.md` — authentication, input validation, injection, secrets, audit
- `engineering-playbook/vol-3-architecture/08-authorization.md` — RBAC, EF global query filter, SuperAdmin
- `engineering-playbook/vol-3-architecture/17-tenant-isolation-audit.md` — open tenant-leak bugs (BUG-01…BUG-04)
- `engineering-playbook/vol-6-integration-strategy/00-integration-overview.md` — integration security model
- `engineering-playbook/vol-9-templates/security-review-template.md` — parent template for the output
- `engineering-playbook/vol-4-ai-organization/03-tech-architect.md` — scribe role definition
- `engineering-playbook/vol-4-ai-organization/01-engineering-director.md` — facilitator role definition
