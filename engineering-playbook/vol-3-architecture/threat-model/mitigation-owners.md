# Mitigation Owners — Routing Table

> Companion to `threat-catalog-seed.md`. Use this to assign owners quickly at the workshop.
> Roles are references to `engineering-playbook/vol-4-ai-organization/*.md`. Standards are references to the playbook docs the owner must cite when authoring the mitigation.

---

## Routing Table

| Threat category | Owning role | Playbook doc for standards | Rationale |
|---|---|---|---|
| **Authentication / JWT** | `04-backend-lead.md` | `vol-3-architecture/07-security.md` § Authentication | Backend Lead owns JwtBearer middleware config, JWKS wiring, refresh-token rotation. |
| **Authorization / RBAC** | `04-backend-lead.md` + `03-tech-architect.md` | `vol-3-architecture/08-authorization.md` | Backend Lead implements `[Authorize(Roles=...)]` and handler-level checks; Tech Architect defines the role-hierarchy pattern and reviews violations. |
| **Tenant isolation** | `04-backend-lead.md` | `vol-3-architecture/17-tenant-isolation-audit.md` | Backend Lead owns the `IgnoreQueryFilters()` audit trail and the four open BUG-01…BUG-04 fixes. Regression suite lives in `TenantIsolationTests.cs`. |
| **Input validation / injection** | `04-backend-lead.md` + `06-qa-lead.md` | `vol-3-architecture/07-security.md` § Input Validation + § Injection Prevention | Backend Lead writes FluentValidation rules; QA Lead owns fuzz / property-based test coverage. |
| **XSS / markdown sanitization** (T-23) | `05-frontend-lead.md` + `04-backend-lead.md` | `vol-3-architecture/07-security.md` § XSS | Frontend renders the markdown; backend controls what markdown is allowed to be stored. Both are on the hook. |
| **Secrets / IAM / infra** | `07-devops-engineer.md` | `vol-8-roadmaps/11-mvp1-execution-plan.md` § Phase 1 (Deploy infrastructure) + `vol-3-architecture/07-security.md` § Secrets Management | DevOps owns Secrets Manager, IAM roles, ALB/WAF, ECS task-role least-privilege. |
| **External integration security** | `09-integration-strategist.md` (+ `07-devops-engineer.md` for creds) | `vol-6-integration-strategy/00-integration-overview.md` § Integration Security Model | Integration Strategist owns per-tenant credential provisioning + rotation; DevOps owns the Secrets Manager side. |
| **Retry / backoff / dead-letter** (T-18) | `09-integration-strategist.md` + `07-devops-engineer.md` | `vol-6-integration-strategy/18-integration-monitoring.md` | Integration Strategist defines the pattern; DevOps wires alarms + dead-letter queues. |
| **Webhook idempotency** (T-19) | `09-integration-strategist.md` | `vol-6-integration-strategy/11-webhooks.md` | Cross-cutting standard needed to replace per-adapter ad-hoc echo detection. |
| **Supply-chain / dependencies** | `07-devops-engineer.md` + `03-tech-architect.md` | `vol-3-architecture/07-security.md` (Section — dependencies not explicitly covered today; expand). CI gate lives in `.github/workflows/ci.yml`. | DevOps runs Snyk / Dependabot / `dotnet list package --vulnerable` in CI; Tech Architect approves dependency additions with license + maintenance criteria. |
| **Compliance / audit / attestation** | `03-tech-architect.md` + `13-documentation-engineer.md` | `vol-2-product-knowledge/domains/tamp.md` + `vol-3-architecture/07-security.md` § Compliance | Tech Architect owns audit-log schema + tamper-evidence design; Documentation Engineer owns the SOC 2 evidence collection and public-facing security docs. |
| **Rate limiting / DoS protection** | `07-devops-engineer.md` + `04-backend-lead.md` | `vol-3-architecture/07-security.md` (rate-limit standard OPEN — workshop ADR follow-up) | DevOps configures WAF + AWS-side rate limits; Backend Lead adds per-endpoint app-layer limits. |
| **Public / anonymous endpoints** (T-24, TB-9) | `04-backend-lead.md` + `07-devops-engineer.md` | `vol-3-architecture/08-authorization.md` § Default: Require Authentication | Any new `[AllowAnonymous]` requires Backend Lead PR + DevOps rate-limit config + Tech Architect sign-off. |
| **Logging / observability of security events** | `04-backend-lead.md` + `07-devops-engineer.md` | `vol-3-architecture/11-logging.md` + `vol-3-architecture/12-observability.md` | Backend Lead emits structured events (auth failures, SuperAdmin actions, tenant-context sets); DevOps wires them to the SIEM / alert channel. |
| **Threat-model refresh cadence** | `03-tech-architect.md` | `engineering-playbook/vol-4-ai-organization/03-tech-architect.md` § Continuous Improvement | Tech Architect owns the quarterly refresh of this folder + the annual full re-workshop. |

---

## Ownership Anti-Patterns to Avoid

The workshop must not fall into these traps when assigning owners:

1. **"DevOps owns all security."** Wrong. Security ownership is distributed by layer. DevOps owns infra + secrets; Backend Lead owns app-layer authn/authz/tenancy; Frontend Lead owns client-side; Integration Strategist owns per-integration. The Tech Architect owns the cross-cutting patterns and the audit.
2. **"Assign the CISO."** The CISO signs off but does not implement. Assign the implementer.
3. **"Assign the whole team."** Ownerless. Every threat gets exactly one accountable owner (a specific person by name), even if multiple people contribute.
4. **"Defer to next sprint."** Only if the Engineering Director explicitly accepts the risk in writing on the threat row.
5. **"AI Engineer owns it."** The AI Engineer (`12-ai-engineer.md`) is not in the workshop room. AI-generated code that violates security patterns is a Tech Architect issue (constraint document quality) or Backend Lead issue (review gate), not AI Engineer.

---

## Escalation Path

- **Owner disputes severity** → Engineering Director breaks the tie in the room.
- **Owner refuses assignment** → Engineering Director reassigns; escalates to VP Engineering if role dispute persists.
- **Fix cost exceeds sprint capacity** → move to `.ai/repository/technical-debt.md` with the ED's signature and a scheduled re-review date; do NOT let the threat sit un-owned.
- **New threat category not in this table** → Tech Architect adds a row here + fills the owning role + standards doc references before the workshop closes.

---

## Cross-References

- `engineering-playbook/vol-4-ai-organization/README.md` — role directory
- `engineering-playbook/vol-3-architecture/16-definition-of-done.md` — where the "new-controller checklist" additions will land post-workshop
- `engineering-playbook/vol-8-roadmaps/11-mvp1-execution-plan.md` § Phase 2 — the security & compliance baseline this workshop feeds into
