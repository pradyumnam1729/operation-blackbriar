# 05 — Security & Governance

---

## Threat Model, Sized Honestly

The PMM Agent holds go-to-market strategy, competitive intelligence, and win/loss findings — commercially sensitive, not regulated data. The realistic risks are: the wrong asset shipping (unapproved or stale content reaching a buyer), untraceable content (nobody can say where a claim came from), internal overexposure (a contractor reading the win/loss corpus), and prompt-carried leakage (war-room content pasted somewhere it shouldn't go). The controls below target those, in that order. This chapter defines the model; implementation depth is staged — the MVP implements the access split and the audit trail, and stubs the rest visibly rather than silently.

---

## Role-Based Access

Two access levels, deliberately few:

| Capability | PMM admin | Consumer |
|-----------|-----------|----------|
| Edit foundation sections, brand files, guardrail config | ✅ | ❌ |
| Approve / reject drafts; apply context-doc proposals | ✅ | ❌ |
| Dispatch agents directly; run always-on programs | ✅ | ❌ |
| View governance dashboard and audit trail | ✅ | ❌ |
| Ask questions (role-framed answers) | ✅ | ✅ |
| Request assets (arrive as drafts → approval queue) | ✅ | ✅ |
| View **final** assets for their role | ✅ | ✅ |
| View drafts, raw war-room files, other roles' query logs | ✅ | ❌ |

Design intents behind the table:

1. **Consumers get answers, not access** ([Vol 1, ch. 04](../vol-1-product/04-users-personas.md)). The knowledge engine mediates all consumer reads; raw `MARKET-INTELLIGENCE/` files (especially win/loss interviews, which may carry customer-identifying detail) are admin-only. What a consumer sees is always a framed, cited product of the war room — never the quarry itself.
2. **Drafts are invisible to consumers.** A rep who can see an unapproved battlecard will use it; the risk isn't malice, it's a deadline plus optimism. Draft visibility is the approval gate's other half.
3. **Role shapes framing, access level shapes rights.** A consumer's persona (Sales, Proposals, Leadership…) selects the answer dialect; it grants no additional rights. Adding a persona never widens access.
4. **Future third level:** a `contributor` (e.g., a sales engineer feeding field intel) who can submit intelligence *proposals* but not edit canon. Not built at MVP; noted so the two-level model isn't over-fitted.

---

## Audit Trail — Who Generated and Approved What

Every consequential action writes an immutable audit event; the [data model](02-data-model.md) already carries the fields. Minimum event set:

| Event | Recorded |
|-------|----------|
| Section edited / submitted for approval | actor, section, version, diff |
| Section approved / rejected | actor, version, notes |
| Asset generated | actor (requester), agent used, source_sections with versions, guardrail results |
| Asset approved → final / rejected | actor, notes |
| Query asked / answered / escalated / refused | actor, role, citations or escalation task |
| Context-doc proposal applied / declined | actor, proposal, target file |
| Guardrail config or forbidden-words change | actor, diff — changing the rules is itself audited |

The trail answers the governance questions that will actually get asked: *"Where did the claim on this one-pager come from?"* (trace + generation event), *"Who approved this and when?"* (approval event), *"Was this current when it shipped?"* (section versions at generation vs. now). For the seed customer this provenance discipline mirrors the audit-trail expectations Aurigo's own public-sector product lives under — content decisions should be as explainable as capital decisions.

---

## Tenant Thinking for the Multi-Product Future

MVP is single-tenant (Aurigo) — but "tenant" has two future axes, and naming them now keeps today's schema from blocking either:

1. **Product-space isolation (near term).** Multiple products in one company must not cross-contaminate: a Primus asset must never cite a Masterworks section, and program/portfolio language must never leak across. This is enforced *now* by `product_id` scoping on every generation and retrieval path — cheap today, painful to retrofit.
2. **Company tenancy (if the PMM Agent is offered beyond Aurigo).** Full isolation of war rooms, users, logs, and guardrail configs per tenant: `tenant_id` on Product, User, and all logs; per-tenant encryption and export; per-tenant model-context isolation (one tenant's brand DNA never appears in another's prompt). This is a GA-scale decision requiring an ADR and a review against `../../engineering-playbook/vol-3-architecture/07-security.md` and `08-authorization.md`; nothing in the MVP should prejudge it beyond carrying the id columns.

---

## Operational Hygiene (MVP Non-Negotiables)

- Claude API key via environment, never in the repo; the war room itself contains no credentials.
- Session-based auth with the two access levels enforced server-side (UI hiding is not access control).
- Prompt-injection posture: war-room files are trusted (PMM-curated), but any future *connected source* content (Vol 6 — transcripts, scraped competitor pages) is untrusted input to prompts and must be framed as data, not instructions, when injected.
- Governance dashboard shows the audit trail's health (event counts, gaps) — an audit trail nobody looks at is a checkbox, not a control.

---

*Back to [Volume 3 index](README.md). Next volume: [Volume 4 — Agent Organization](../vol-4-agent-organization/README.md)*

Last updated: 2026-08-06
