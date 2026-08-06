# ADR-[NNN]: [Short Title]

---

## Header

| Field | Value |
|-------|-------|
| **ADR Number** | ADR-[NNN] |
| **Title** | [Short, declarative title — what was decided] |
| **Status** | Proposed / Accepted / Deprecated / Superseded by ADR-[NNN] |
| **Date** | YYYY-MM-DD |
| **Deciders** | [Name (role)], [Name (role)] |
| **Context Tags** | [backend / frontend / database / infra / security / calculations / integration] |
| **Supersedes** | ADR-[NNN] (if applicable) |

---

## Context

[Two to four paragraphs. Describe the situation as it existed when this decision was made: the technical landscape, the constraints we were operating under, and the forces in tension. Write this section as if the reader has never heard of the system — future engineers reading this in 3 years need enough context to understand why the decision was sensible at the time, even if circumstances have changed.]

### Constraints Active at Decision Time

- [Constraint 1 — e.g., "PostgreSQL + PostGIS was already the locked-in database technology."]
- [Constraint 2 — e.g., "The Phase 3 deadline was 6 weeks out with 2 engineers available."]
- [Constraint 3 — e.g., "We had no domain expert in bridge structural engineering on staff."]

---

## Decision

**We will [clear declarative statement of the decision].**

[Two to four paragraphs elaborating the decision: what it means concretely, where it applies, and where it does not apply. Be precise about scope. If the decision involves a specific version of a library or a specific configuration, state it explicitly.]

---

## Rationale

[Three to six bullet points explaining why this decision was the right call given the constraints. Each bullet should name a specific factor. Avoid vague justifications like "it's simpler" — instead write "it reduces the number of abstraction layers a new engineer must learn before making their first change to RUL calculation logic."]

- [Factor 1]
- [Factor 2]
- [Factor 3]

---

## Alternatives Considered

### [Alternative A Name]

[Brief description of this alternative.]

**Reason not chosen:** [Specific reason.]

### [Alternative B Name]

[Brief description of this alternative.]

**Reason not chosen:** [Specific reason.]

---

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Trade-off 1 — every real decision has trade-offs; do not leave this empty]
- [Trade-off 2]

### Neutral
- [Side effect that is neither clearly good nor bad]

---

## Compliance

[How do we know engineers are following this decision? Describe the mechanism: a linter rule, a code review checklist item, a CI gate, a naming convention enforced by a base class, a note in CLAUDE.md.]

- [Compliance mechanism 1]
- [Compliance mechanism 2]

---

## Related Decisions

- [ADR-NNN: Title] — [brief relationship]
- [RFC-NNN: Title] — [brief relationship]

---
---

## Example: ADR-009 — Use Weibull Deterioration Model as Default for Mechanical Asset Classes

### Header

| Field | Value |
|-------|-------|
| **ADR Number** | ADR-009 |
| **Title** | Use Weibull Deterioration Model as Default for Mechanical Asset Classes |
| **Status** | Accepted |
| **Date** | 2026-05-14 |
| **Deciders** | Kiran Menon (ED), Priya Nambiar (EM), Dr. Suresh Iyer (Domain Consultant) |
| **Context Tags** | calculations / domain / backend |
| **Supersedes** | N/A |

### Context

The Asset Maintenance prototype must estimate Remaining Useful Life (RUL) for civil infrastructure assets across multiple classes: roads (flexible and rigid pavement), bridges, mechanical systems (pumps, HVAC, generators, elevators), and miscellaneous structures. RUL is the foundational output of the system — it drives ARV calculation, risk scoring, and capital needs planning. Getting the deterioration model wrong means every downstream output is systematically biased.

Three mainstream deterioration modeling families exist: linear (simplest), Markov chain (process-based, used in FHWA's HERS model), and parametric survival models (Weibull, gamma, log-normal). Each has different data requirements, calibration complexity, and suitability by asset class.

When this decision was made, Aurigo had no existing deterioration model library. The implementation deadline for Phase 3 (RUL) was 6 weeks away. The engineering team had two senior .NET engineers and access to one civil engineering domain consultant for 4 hours per week. No historical inspection dataset was available for model calibration — we would be shipping with manufacturer-recommended default parameters until customers accumulate sufficient inspection history.

#### Constraints Active at Decision Time

- No historical inspection dataset available for model calibration at launch time; default parameters must be defensible from published literature.
- Calculation engines must be pure C# with no external ML dependencies (CLAUDE.md convention).
- RUL computation must run in under 10ms per asset to remain viable on the dashboard load path.
- The domain consultant confirmed that mechanical assets exhibit early-failure behavior that linear models cannot capture.

### Decision

**We will use the two-parameter Weibull survival function as the default deterioration model for all mechanical asset classes (pumps, HVAC units, generators, elevators, and similar electromechanical equipment), with the shape parameter beta defaulting to 2.0 (approximating the infant-mortality-to-wear-out transition region) and the scale parameter eta defaulting to the manufacturer-rated MTBF where available, falling back to asset-class defaults from ASCE 25-17 Table B-3.**

The decision applies to all asset classes tagged as `MechanicalEquipment` in the `AssetClass` enum. It does not apply to civil structural assets (roads, bridges, retaining walls), which will use a linear deterioration model for Phase 3 and may be revisited in a future ADR as inspection data accumulates.

The model is encapsulated in `Application/Calculations/WeibullRulCalculator.cs`. The shape and scale parameters are stored per asset class in the `ModelSettings` table (introduced in migration `20260512_AddModelSettings`) so that customers can tune them without code changes.

### Rationale

- The Weibull distribution is the standard model used in ISO 14224 and IEC 60300 for mechanical asset reliability, giving us defensible published defaults before customer-specific data is available.
- The two-parameter form has a closed-form CDF and hazard function, making it trivially fast in pure C# with no matrix operations — benchmarks show < 0.05ms per asset.
- The shape parameter beta = 2 (Rayleigh distribution, a Weibull special case) is a well-documented conservative approximation for equipment in the early-wear phase, confirmed as appropriate by our domain consultant.
- Storing beta and eta in the `ModelSettings` table rather than hardcoding them means the model is self-calibrating: customers accumulate inspection data, Aurigo support can update parameters per-tenant without a deployment.
- The Weibull family subsumes exponential (beta = 1) and closely approximates normal wear-out behavior (beta approx 3.5), so if we later determine a different beta is appropriate for a sub-class, we change a database row, not code.

### Alternatives Considered

#### Linear Deterioration

A simple linear model: condition decreases at a fixed rate per year from installation date to end-of-life.

**Reason not chosen:** Linear models cannot represent the bathtub curve characteristic of mechanical equipment (elevated early failure rate, low mid-life failure rate, rising wear-out failure rate). Dr. Suresh Iyer explicitly advised against linear models for mechanical assets as they systematically underestimate early-life RUL and overestimate mid-life RUL.

#### Markov Chain / State-Transition Model

Assets transition between condition states (Excellent to Good to Fair to Poor to Failed) with transition probabilities estimated from inspection history.

**Reason not chosen:** Markov models require historical inspection data to estimate transition probabilities. We have no such data at launch. The model cannot produce meaningful output with default parameters, and the implementation complexity (matrix exponentiation for multi-period projections) exceeds our 10ms per-asset performance budget on large tenants.

#### Log-Normal Survival Model

Similar to Weibull but with a log-normal failure time distribution.

**Reason not chosen:** Log-normal models are common in biostatistics but less standardized for infrastructure assets. The Weibull family has direct support in ISO 14224, which several of our DOT customers are required to reference in their asset management plans.

### Consequences

#### Positive
- Default parameters are defensible from ISO 14224 and ASCE 25-17, reducing customer pushback during implementation.
- Model is tunable per-tenant via database without deployment, enabling continuous improvement as inspection data accumulates.
- Pure C# implementation satisfies the CLAUDE.md constraint on calculation engines.

#### Negative
- The default parameters are generic; a newly onboarded customer's RUL estimates will be inaccurate until their inspection history is sufficient to calibrate the model (estimated 18-24 months of data for statistical significance). This must be clearly communicated to customers in onboarding.
- Two-parameter Weibull cannot model assets with a guaranteed minimum lifetime (no location parameter gamma). For assets with known minimum lifetimes, estimates may be pessimistic in the early years.

#### Neutral
- Civil structural assets (roads, bridges) continue to use a linear model under a separate interface. This creates two distinct calculation paths in the codebase, which is a minor maintenance overhead.

### Compliance

- `WeibullRulCalculator` is the only class permitted to implement `IRulCalculator` for the `MechanicalEquipment` asset class category. A code review checklist item in the Architecture Review template explicitly asks: "Does any new asset class use a deterioration model other than the one defined in the relevant ADR?"
- `ModelSettings` seed data is included in `Infrastructure/DataSeeding/ModelSettingsSeed.cs` and verified in the integration test `ModelSettingsSeedTests.cs`.
- The vault note `vault/calculations/RulCalculator.md` references this ADR.

### Related Decisions

- ADR-010: Linear Pavement Deterioration Model for Road and Bridge Asset Classes
- RFC-003: RUL Calculation Engine Design (precursor RFC to this ADR)
