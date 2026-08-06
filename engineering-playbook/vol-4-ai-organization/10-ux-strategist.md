# UX Strategist

## Mission

The UX Strategist designs the Maintain user experience for three radically different use contexts: a field inspector on a rain-wet tablet under a bridge with gloves on, a city council member squinting at a projected dashboard from the back of a conference room, and an asset manager doing deep portfolio analysis on a dual-monitor desktop at 7 PM. The same product must work excellently for all three — without compromise.

In an AI-native engineering organization, the UX Strategist uses AI agents to dramatically accelerate wireframing and research synthesis while spending more time on the irreplaceable human work: observing real users in context, making aesthetic judgment calls, and building the design system that constrains the entire frontend.

---

## Responsibilities

### Design System Ownership

Own the Maintain design system: the extension of shadcn/ui that defines every visual element used in the product. The design system is not aspirational — it is what is actually in production. Every component in `src/components/` has a design specification that the design system documents.

The design system defines:
- Color palette (primary, secondary, semantic colors for condition Good/Fair/Poor, risk Low/Medium/High/Critical)
- Typography scale (heading sizes, body sizes, label sizes, minimum sizes for accessibility)
- Spacing scale (4px base unit, consistent spacing tokens)
- Component library (all reusable components with all states: default, hover, active, disabled, loading, error)
- Icon library (standardized icon usage; no ad-hoc icon selection)
- Animation principles (subtle and purposeful; no gratuitous animation on data-dense views)
- Print style guidelines (what colors translate to print; how to handle dark backgrounds in printed reports)

The design system is documented in Storybook, which runs in CI and is published to an internal URL for the team to reference.

### Information Architecture

Define the navigation structure, page hierarchy, and information organization for the entire Maintain application. The IA must work for:
- Desktop: full navigation sidebar, multi-panel layouts, dense data tables
- Tablet: collapsible navigation, single-panel focus, larger touch targets
- Mobile (375px): bottom navigation, full-width panels, minimal chrome

The IA is documented as a site map in the vault. When new features are added, the UX Strategist defines where they live in the IA before engineering implements the route.

### User Research

Conduct user research to validate design decisions and surface new requirements. In an AI-native org, research is AI-accelerated at the synthesis stage but not at the observation stage — watching a city inspector struggle with a form is irreplaceable.

Research methods:
- Contextual inquiry (field observation with working inspectors) — quarterly
- Remote moderated usability testing (screen share with agency users) — per major feature
- In-app analytics (click heatmaps, session recordings via PostHog or similar) — continuous
- User interviews (30-minute calls with PM and UX together) — monthly

AI-accelerated synthesis: session recordings are transcribed, then Claude analyzes the transcripts to identify friction patterns, vocabulary usage (what do users call things that differ from what the product calls them?), and feature requests.

### Wireframe and Prototype Development

Produce wireframes for every new feature before engineering begins implementation. Wireframes are the contract between design and engineering: they define what will be built.

AI-native wireframe process:
1. Write a wireframe brief (structured description of the feature, user goals, context)
2. Use Claude to generate a detailed wireframe description (component list, layout structure, interaction states)
3. Validate the AI description against the design system and the user research
4. Produce the actual wireframe (Figma) from the validated description
5. Review with the Frontend Lead for technical feasibility
6. Review with the PM for feature completeness

The AI generation step speeds up the mental work of "what should be on this screen and in what order?" — a process that previously took 2-4 hours now takes 30-45 minutes. The Figma production step still requires design craft.

### Accessibility Standards

Own accessibility standards for the Maintain product. Target: WCAG 2.1 Level AA for all public-facing and internal views. This is not optional — public agencies often have Section 508 compliance requirements for software they procure.

Accessibility standards the UX Strategist enforces:
- Color contrast: minimum 4.5:1 for normal text, 3:1 for large text and UI components
- Focus indicators: visible focus ring on all interactive elements
- Touch targets: minimum 44x44px on mobile
- Keyboard navigation: full keyboard operability for all workflows
- Screen reader compatibility: ARIA labels, roles, and live regions for dynamic content
- No information conveyed by color alone: always accompanied by text, icon, or pattern

The UX Strategist conducts a monthly accessibility audit using a combination of automated tools (axe DevTools) and manual testing with a screen reader (NVDA on Windows, VoiceOver on iOS).

### Mobile UX Patterns

The inspector mobile experience is the most challenging design problem in Maintain. Design principles specific to mobile inspector UX:

- **Glove-friendly**: all tap targets are minimum 56x56px (12px larger than minimum WCAG) because inspectors wear work gloves
- **One-handed operation**: primary actions are reachable with a thumb while holding the device in one hand
- **Offline-first UX**: the UI communicates connectivity state prominently; no feature silently fails offline
- **Bright sunlight legibility**: contrast ratios above the WCAG minimum because outdoor daylight washes out screens; minimum 7:1 contrast for primary text
- **Minimal typing**: photo capture, voice input, and selection controls are preferred over text entry; free text is the last resort
- **Forgiving input**: large tap targets overlap to prevent mis-taps; the user can always undo the last action before submitting
- **Battery consciousness**: animations and background processes are minimized on mobile to preserve battery during all-day field use

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| Design-to-Dev Handoff Quality | < 2 design clarification questions per feature during implementation | Per feature |
| Accessibility Violations (AA) | Zero in production; < 3 in staging | Monthly |
| Mobile Task Completion Rate | > 90% on representative inspection tasks at 375px | Quarterly |
| Design System Coverage | > 95% of UI components sourced from design system | Monthly |
| User Research Cadence | At least 1 contextual inquiry per quarter, 1 usability test per major feature | Quarterly |
| Wireframe Lead Time | All wireframes complete 1 sprint ahead of implementation sprint | Per sprint |
| Print Report Quality | Board-presentable output with agency logo, without manual editing | Per report |

---

## Authority

The UX Strategist has authority to:
- Block a frontend PR that violates the design system (wrong colors, wrong spacing, non-standard components)
- Require an accessibility fix before a feature ships
- Reject a wireframe implementation that doesn't match the specified design
- Define the information architecture (page routes, navigation structure)

The UX Strategist does not have authority to:
- Change product scope or feature requirements
- Override the Frontend Lead on technical implementation decisions
- Approve production deployments

---

## Deliverables

**Per feature**: Wireframes (all states and viewport sizes), accessibility checklist, component specification

**Monthly**: Accessibility audit report, design system update log, user research synthesis

**Quarterly**: Contextual inquiry report, IA review

**Annually**: Design system major version (accommodating accumulated changes and technical debt), user research roadmap

---

## Decision Making

When evaluating a design choice, the UX Strategist uses a priority hierarchy:
1. **User safety and accessibility**: Never sacrifice accessibility for aesthetics
2. **Task completion efficiency**: The design that gets the user to their goal fastest wins, even if it's less visually polished
3. **Mobile-first**: If the mobile design is correct, the desktop layout can use the extra space for enhanced functionality
4. **Design system consistency**: Consistent > novel; familiar UI patterns reduce cognitive load
5. **Aesthetic quality**: Polished, professional design builds trust with government users who make million-dollar procurement decisions

---

## Daily Workflow

**08:00–08:30** — Review in-app analytics: any new friction patterns, drop-off points, unusual navigation paths?

**08:30–09:30** — Wireframe work for upcoming sprint features.

**09:30–10:30** — PM sync (3x/week): review new feature requests, discuss UX implications, agree on approach before wireframing begins.

**10:30–11:30** — Frontend Lead sync (2x/week): review implementation against wireframes, resolve questions, validate mobile responsiveness.

**11:30–12:00** — Design system maintenance: update Storybook, add new component states, document new patterns.

**14:00–16:00** — Deep design work: complex interactions, accessibility validation, research synthesis.

**16:00–17:00** — User research: interviews, session recording review, accessibility testing.

---

## Collaboration

**With PM**: UX and PM are paired partners for feature design. The PM defines what the feature needs to accomplish; the UX Strategist defines how users accomplish it. They jointly present to engineering at sprint planning.

**With Frontend Lead**: Daily partnership on implementation. The UX Strategist produces the wireframes; the Frontend Lead implements them using the component library. When a wireframe requires a component not in the library, they jointly decide: add to the library (if reusable) or implement inline (if one-off).

**With Lifecycle Domain Expert**: Domain vocabulary in the UI. What do users call things? What terminology appears in the UI must match what inspectors and asset managers use in the field. The domain expert validates that UI labels use correct terminology.

**With QA Lead**: Accessibility testing partnership. The QA Lead's automated axe-core tests catch many accessibility issues; the UX Strategist's manual testing catches the nuanced issues that automated tools miss (logical reading order, focus management in modal dialogs, sensible ARIA labels).

---

## Escalation

The UX Strategist escalates to the ED when:
- An accessibility violation cannot be resolved without a significant UI rework
- A design decision creates an irreconcilable disagreement between UX and engineering
- User research reveals a fundamental usability problem with a shipped feature

---

## Continuous Improvement

Quarterly: conduct a usability audit of the most-used features (based on analytics). Even features that were well-designed at launch develop friction as the product evolves around them. Identify the top 3 friction points and address them in the following quarter.

Annually: design system audit. What patterns have accumulated as one-offs that should be standardized? What components have evolved in the product but haven't been updated in Storybook?

---

## Example Scenarios

### Scenario 1: Designing the Inspection Form for Glove Use

The PM wants a rich inspection form that captures element condition ratings, defect codes with severity, measurements, and photo attachments. The desktop wireframe is complex: a table of elements with dropdowns and text fields.

The UX Strategist tests the wireframe on a 375px phone in a simulated outdoor environment (bright overhead light, one-handed hold) and immediately identifies problems: the dropdown targets are 28px (too small for gloves), the table layout requires horizontal scrolling, and the photo attachment button is in the top-right corner (unreachable with one hand).

Redesign: replace the table with a card-per-element layout (full width, one element at a time), replace dropdowns with large tap targets for condition ratings (segmented buttons showing Good/Fair/Poor), move the photo button to the bottom of each element card (accessible with thumb), and add a voice-to-text button for the notes field.

The redesigned form is tested with 2 inspectors who confirm it is operable with gloves and in direct sunlight. The PM approves the redesign; the Frontend Lead implements it.

### Scenario 2: AI-Assisted Wireframe Generation

The PM writes a feature brief for a new "Capital Needs Heat Map" — a map view showing assets colored by capital need urgency, with filters for asset class, year range, and funding source.

The UX Strategist uses Claude: "Generate a detailed wireframe description for a capital needs heat map page in an infrastructure asset management application. The page has a full-width Mapbox map, filter controls for asset class (multi-select), year range (slider), and funding source (radio buttons). Hovering an asset shows a tooltip with: asset name, estimated need (dollars), year needed, and risk score. A right sidebar shows a summary of filtered results: total assets shown, total estimated need, count by priority tier. Include mobile (375px) and desktop (1280px) layout descriptions."

Claude produces a detailed wireframe description in 3 minutes. The UX Strategist reviews it: the filter placement is good, but the tooltip content is missing the action button ("View Asset" link) that allows users to drill through. The sidebar summary is missing the "Export" action. The mobile layout doesn't address how the sidebar collapses on mobile.

The UX Strategist makes these corrections, then produces the Figma wireframe from the corrected description. Total wireframe time: 45 minutes instead of 3 hours.

### Scenario 3: Accessibility Remediation for Color-Only Status Indicators

A post-launch accessibility audit reveals that the risk score badges in the asset list use color alone to convey risk level: green, yellow, orange, red circles with no text inside them. For a user with deuteranopia (red-green color blindness, the most common form), green and red circles are indistinguishable.

The UX Strategist redesigns the risk score badge to use both color and text: a colored pill with the text label inside ("Low", "Medium", "High", "Critical"). For cases where space is constrained (small cards), a colored dot with a visible text label adjacent.

The change is applied to the design system first (updating the RiskScoreBadge component specification), then the Frontend Lead updates the component implementation. The accessibility audit is re-run after the change; the violation is resolved. The UX Strategist adds a design system rule: "Never use color as the sole means of conveying information. Always provide a text, icon, or pattern equivalent."

---

## AI Agent Pairing

The UX Strategist pairs with a **UX Design Agent** — a Claude Code session used for user research synthesis, accessibility auditing, and component specification.

**What the agent handles autonomously:**
- Synthesising interview notes and usage logs into structured JTBD (Jobs-to-be-Done) statements
- Generating Tailwind + shadcn component specs and accessibility checklists for new UI flows
- Auditing existing components against WCAG 2.1 AA criteria (color contrast, ARIA label coverage, keyboard navigation)
- Drafting mobile UX flows (375px viewport, touch targets, offline states) based on persona requirements
- Generating A/B test hypotheses from usage data and design changes
- Reviewing PR diffs for frontend changes that affect user-facing behavior

**What requires the human's judgment:**
- Final visual design decisions (layout, hierarchy, color system choices)
- Tradeoffs between field-inspector simplicity and power-user configurability
- Accepting or rejecting accessibility audit findings (some findings have acceptable-risk business justifications)
- Deciding when a usability issue is severe enough to block a release

**Prompt guidance:** Brief the agent with the relevant persona (from `vault/personas/`), the target viewport (desktop 1440px vs. mobile 375px), and a description of the current flow including pain points. See `engineering-playbook/vol-10-claude-prompts/` for templates.
