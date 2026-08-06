# Lifecycle Domain Expert

## Mission

The Lifecycle Domain Expert is the most unusual role in an engineering organization: a practitioner of infrastructure asset management embedded within a software development team. This person is not a software engineer. They are a former public works director, DOT bridge program manager, facilities engineer, or pavement program specialist who has spent years making the decisions that Maintain automates.

Their value is specific and irreplaceable: they know what is real. They know that a bridge deck condition curve doesn't decline linearly — it stays relatively high for years and then drops sharply. They know that FHWA TAMP guidance requires specific language when discussing performance gap analysis that a language model doesn't understand unless trained on it. They know that "good" condition for a culvert and "good" condition for a bridge have different practical implications for an agency budget cycle.

AI can research AASHTO standards faster than any human. AI cannot know whether a calculation result makes sense — that requires the visceral intuition of someone who has managed 200 bridges and felt the budget pressure of replacing three of them in the same year.

---

## Responsibilities

### Calculation and Model Validation

Review every new calculation engine before it ships to production. This means: understanding what the calculation is trying to model, reviewing the mathematical formulation, running the calculation with representative inputs, and evaluating whether the output passes the sanity check: "Would I believe this if an engineer showed it to me?"

Common failure modes in AI-generated calculation code:
- Deterioration curves that are too optimistic (assets live forever at good condition) or too pessimistic (assets hit poor condition after 5 years regardless of type)
- RUL calculations that return negative numbers for already-degraded assets (should return zero or flag as past-due)
- Risk scores where a high-traffic urban bridge scores lower than a rural farm road due to incorrect weight configuration
- ARV calculations using unit costs that haven't been inflation-adjusted, producing current-year cost estimates from 10-year-old RS Means data
- Capital plan optimization results where replacing every bridge is recommended in Year 1 (optimizer found a local optimum, not a realistic plan)

The domain expert's validation is the final gate before a calculation feature ships. No amount of unit tests substitutes for "this produces numbers that make sense in the real world."

### TAMP and Regulatory Compliance Review

Review every TAMP-related feature for compliance with FHWA guidance. This is not a legal review — it is a domain review: does the software produce data and narratives that meet the intent and letter of 23 CFR Part 515 and the associated FHWA guidance documents?

Specific responsibilities:
- Validate that the life cycle cost analysis section produces output that complies with FHWA's preferred analysis format
- Validate that performance targets are framed using FHWA's standard terminology (SGR — State of Good Repair, targets must be measurable and tied to investment levels)
- Review AI-generated TAMP narrative sections for regulatory accuracy (not just fluency — FHWA reviewers will flag technically incorrect statements)
- Validate that the asset condition definitions (Good/Fair/Poor thresholds) align with National Bridge Inspection Standards and MAP-21/FAST Act requirements for NHS bridges

### Domain Vocabulary Training

Train the engineering team on infrastructure asset management domain vocabulary. Engineers who don't know the domain will produce features that are technically correct but operationally wrong. Examples:

- "Rehabilitation" vs. "reconstruction" vs. "replacement" have specific meanings in infrastructure (different cost structures, different condition outcomes, different federal eligibility rules)
- "Remaining useful life" is calculated differently for bridge elements vs. pavement (AASHTO vs. PCI methodology)
- A "capital need" is not a work order — it is a future, unfunded requirement that may or may not become a funded project
- "Asset inventory" and "asset condition assessment" are distinct activities with different workforce requirements
- "Level of service" is a specific metric in transportation planning that has regulatory implications for performance-based planning

Run a monthly "domain vocabulary" session with the engineering team where a new concept is explained with field examples, implications for the data model are discussed, and any existing features that got the semantics wrong are identified for correction.

### Feature Feasibility Review

Review new feature proposals for domain feasibility before sprint commitment. Not every technically possible feature reflects how infrastructure asset management actually works. Examples of infeasible features that might be proposed:

- A feature that suggests inspection frequency based only on age (inspectors know that condition drives inspection frequency, not age — a well-maintained 50-year-old bridge needs less frequent inspection than a newly-built bridge with construction defects)
- A risk score that increases linearly with traffic volume (consequence of failure is not linear with AADT — a 40,000-vehicle bridge and a 60,000-vehicle bridge fail very differently)
- A TAMP narrative generator that produces specific dollar figures for capital needs based on undiscounted costs (FHWA requires discounting methodology to be stated; undiscounted costs in a TAMP narrative would be flagged)

The domain expert reviews the PM's feature briefs before they become stories and flags any that reflect a misunderstanding of domain operations.

### Field Experience Translation

When Maintain features need to reflect field realities, the domain expert is the translator. Examples:

- Mobile inspector flow: the domain expert knows that bridge inspectors work from a specific inspection sequence (approach, abutment, pier, deck, superstructure) that the inspection form should reflect — not an arbitrary alphabetical list of elements
- Condition rating scales: National Bridge Inspection Standards use a 0–9 scale for element ratings; many agencies use a 1–100 composite scale; the domain expert ensures Maintain maps between these correctly without information loss
- Defect code libraries: what defect codes are actually used in the field, how they map to element types, what severity gradations exist — the domain expert writes and maintains the seed data for defect codes
- Photo documentation requirements: certain inspection types (FHWA-mandated bridge inspections) require specific photo angles for specific elements; the domain expert defines these requirements for the mobile inspection module

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| Calculation Sanity Check Rate | 100% of new calculation engines reviewed before release | Per release |
| TAMP Compliance Issues | Zero FHWA-flagged issues in customer TAMP submissions | Per TAMP cycle |
| Domain Vocabulary Issues | < 2 customer-reported domain inaccuracies per quarter | Quarterly |
| Feature Feasibility Review Coverage | 100% of PM feature briefs reviewed before story writing | Per brief |
| Defect Code Library Currency | Defect codes reviewed and updated annually | Annually |
| Customer Domain Questions Resolved | < 24 hours for Tier 1 customer domain questions | Per question |

---

## Authority

The Domain Expert has authority to:
- Block a calculation feature from shipping if the output fails the sanity check
- Require a TAMP narrative section to be rewritten if it is regulatory non-compliant
- Override a data model decision where the model semantics are domain-inaccurate
- Update seed data (defect codes, condition rating scales, asset class definitions) at any time

The Domain Expert does not have authority to:
- Make software architecture decisions
- Approve or reject PRs on technical grounds
- Override the ED on delivery scope

---

## Deliverables

**Per calculation feature**: Domain validation report (inputs tested, outputs assessed, pass/fail with notes)

**Per TAMP feature**: Regulatory compliance checklist (FHWA guidance sections checked, issues found, corrections required)

**Monthly**: Domain vocabulary training session, domain accuracy issue log

**Quarterly**: Seed data review (are defect codes, condition scales, and cost indices current?), customer TAMP feedback summary

**Annually**: Regulatory update review (has FHWA or AASHTO published new guidance that affects Maintain features?), field experience update (has the domain expert conducted field observations recently?)

---

## Decision Making

The domain expert uses a structured checklist for calculation validation:

1. **Unit check**: Does the output have the right unit (years for RUL, dollars for ARV, 0–100 for risk score)?
2. **Range check**: Is the output within a plausible range? (RUL > 100 years is almost certainly wrong; ARV of $0 is almost certainly wrong)
3. **Monotonicity check**: Does the output change in the expected direction when inputs change? (Higher condition score should produce higher RUL; higher traffic volume should produce higher CoF)
4. **Boundary check**: What happens at the boundaries? (Condition = 100 should produce maximum RUL; condition = 0 should produce RUL = 0)
5. **Known-case check**: Test with a specific real-world asset type and verify the result matches field experience (a 20-year-old concrete bridge deck in good condition should have approximately 15–20 years of RUL remaining)
6. **Comparison check**: Run the same inputs through the calculation and through an independent reference (AASHTO manual calculation, agency's existing spreadsheet model). Results should agree within 10%.

---

## Daily Workflow

**08:00–08:30** — Review any new calculation issues reported by customers or flagged by the anomaly detection system.

**08:30–09:30** — Feature review: read PM feature briefs and upcoming sprint stories for domain accuracy. Flag issues before they become code.

**09:30–11:30** — Active validation work: running calculation engines with test inputs, reviewing TAMP narrative output, checking seed data accuracy.

**11:30–12:00** — Engineering team consultation: available for domain questions from engineers working on infrastructure features.

**14:00–16:00** — Research: use AI to rapidly research new regulatory guidance, AASHTO publications, and peer DOT practices. Synthesize findings into product recommendations.

**16:00–17:00** — Documentation: update the vault with new domain knowledge, document validation results, write training materials.

---

## Collaboration

**With PM**: Daily partnership on feature feasibility. The PM has product instincts; the domain expert has operational reality. Together they define features that are both desirable and domain-accurate.

**With AI Engineer**: Primary partner for calculation validation. The AI Engineer builds the math; the domain expert validates whether the math models real-world infrastructure behavior.

**With QA Lead**: Define known-good test vectors for calculation tests. "For a concrete culvert, diameter 36 inches, installed 1985, current condition 55, the expected RUL is 12 ± 2 years based on the APWA deterioration model." These become the anchoring test cases that prevent tautological tests.

**With Integration Strategist**: Validate that the canonical data model and EAM mappings reflect domain reality. "In SAP PM, what field contains the bridge deck area measurement?" The integration strategist knows the SAP data model; the domain expert knows whether that field is actually what agencies enter in practice.

---

## Escalation

The Domain Expert escalates to the PM when:
- A customer reports that a Maintain calculation produces results inconsistent with their agency's established methodology (may require a configuration option or a calculation adjustment)
- A new federal regulatory requirement changes the data or output requirements for a Maintain feature

The Domain Expert escalates to the ED when:
- A calculation engine fails validation and the fix is too complex to be addressed in the current sprint
- A TAMP compliance issue is discovered after a feature has already shipped to production

---

## Continuous Improvement

Quarterly: conduct a mini field observation — visit an active inspection team for a day. Nothing replaces firsthand experience with how the software is actually being used in the field vs. how it was designed to be used.

Annually: review the vault knowledge base for outdated content. AASHTO updates its guides; FHWA updates its TAMP guidance; cost indices change annually. Any outdated information in the vault that could influence AI agent behavior needs to be corrected.

---

## Example Scenarios

### Scenario 1: Catching an Unrealistic Deterioration Curve

The AI Engineer implements a Weibull deterioration model calibrated on the agency's historical inspection data. The model parameters are computed correctly from the statistical fitting algorithm. The Backend Lead has reviewed the code; the QA Lead has unit tests that pass. The calculation is ready to ship.

The Domain Expert runs the model with representative inputs: a concrete bridge deck, installed 1990, current condition 75. The model predicts that this bridge will remain above the rehabilitation threshold (condition 40) until 2055 — 65 years from installation. That would mean the deck lasts 65 years with no major rehabilitation.

The domain expert knows that concrete bridge decks in the Northeast (freeze-thaw climate) typically require major rehabilitation at 30–40 years. A 65-year deck life is unrealistic. Investigation reveals: the calibration dataset was heavily skewed toward newer bridges (installed after 2010) which haven't yet degraded significantly. The model fitted to young bridges produces an overly optimistic curve.

The fix: add a minimum deterioration rate parameter (floor, not allowing the calibrated rate to drop below the AASHTO minimum for the asset class and climate zone). The domain expert provides the AASHTO reference values. The feature ships with the corrected model.

### Scenario 2: Validating an AI-Generated TAMP Narrative Section

The TAMP narrative generator produces a draft Life Cycle Planning section. The AI has correctly structured it according to FHWA guidance and used the right terminology. It reads fluently and looks professional.

The domain expert reads it carefully and finds a factual error: the narrative states that "all preventive maintenance activities for bridges are eligible for NHPP funding." This is incorrect — only maintenance activities on NHS bridges are eligible, and even then, only certain categories of preventive maintenance qualify. If an agency submitted a TAMP with this statement, the FHWA reviewer would flag it, and it could affect funding eligibility.

The domain expert corrects the narrative template and adds a constraint to the AI generation prompt: "Do not make statements about federal funding eligibility for specific maintenance activities. Reference FHWA's own guidance documents for eligibility questions." The corrected template is tested against the FHWA TAMP review criteria checklist.

### Scenario 3: Translating Field Reality to Mobile UX

The UX Strategist has designed a mobile inspection form for bridge inspections that lists condition elements alphabetically: Abutment, Approach Roadway, Bearing Devices, Channel and Channel Protection, Culvert, Deck, Guardrail... The alphabetical order makes sense from a user-interface perspective (predictable, easy to find an element).

The domain expert raises a concern: bridge inspectors in the field follow a specific physical sequence as they move around the bridge structure. They start at the approach, move to the abutment, then the pier, then underneath (superstructure), then on top (deck), then the railing. Alphabetical order requires them to constantly mentally translate between where they are physically and where they are in the form.

The domain expert provides the standard NBI inspection sequence (as used in the federal bridge inspection training curriculum) and recommends re-ordering the form to match. The UX Strategist implements the sequence-based ordering, with a search field so experienced inspectors can jump to any element directly. Post-release testing with inspectors confirms the new ordering significantly reduces time per inspection.

---

## AI Agent Pairing

The Lifecycle Domain Expert pairs with a **Domain Validation Agent** — a Claude Code session specialised in infrastructure asset management research and calculation review.

**What the agent handles autonomously:**
- Researching AASHTO, FHWA, and MAP-21 guidance documents to answer technical questions
- Generating worked examples for calculation validation (inputs → expected outputs with source citations)
- Drafting TAMP narrative sections from structured data inputs
- Searching the vault for prior domain decisions and flagging contradictions with a proposed change
- Producing the Gate 5b calculation change summary checklist (see `vol-7-ai-engineering/14-human-approval-gates.md`)

**What requires the human's judgment:**
- Pass/fail decision on a calculation sanity check — the agent produces the worked examples, the domain expert determines if the numbers "feel right"
- Regulatory compliance rulings — the agent finds the FHWA text, the domain expert interprets whether the feature meets it
- Resolving ambiguity between competing domain standards (e.g., AASHTO vs. agency-specific methodology)
- Approving the final form of TAMP narrative sections before they ship

**Prompt guidance:** When briefing this agent, include: the asset class being modelled, the relevant regulatory standard (FHWA TAMP guidance, AASHTO, NBI), the calculation result being validated, and three representative real-world cases to check against. See `engineering-playbook/vol-10-claude-prompts/` for templates.
