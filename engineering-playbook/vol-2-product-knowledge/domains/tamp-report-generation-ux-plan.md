# TAMP Report Generation — UX Plan

> Volume 2 · Product Knowledge · Domain · UX Plan
> Owner: `ux-strategist` (author) with `product-manager`, `tech-architect`, `frontend-lead` viewpoints represented inline.
> Status: **Plan — awaiting user sign-off before implementation.**
> Scope: restructure `/reports/tamp` from a flat tab layout to a wizard-shaped generation workflow; relocate `Saved Reports` from the left nav into the Reports module surface.
> Not in scope: any code changes. This document is the blueprint.

---

## 0. Why we are doing this

The user's directive:

> Instead of having separate tabs in the TAMP module, there should be a proper workflow in the Report generation process where a user selects and goes through each of these sections to complete them — select the horizon, scenario, and then click on Generate report. There can be another tab called "Saved Reports" in the Reports module (No need to have it on left navbar).

Two distinct problems being solved:

1. **Cognitive load on `reports.tamp.tsx`** — the page mixes input controls (horizon + scenario picker), a 6-tab narrative editor strip, an 8-section output report, and 4 modal launchers (Save, Consistency letter, Print, Version history sidebar). No visible order tells a new user what to do first. The § 515.9(d/e/h/i/k) narratives are treated as parallel tabs even though FHWA reviewers expect them to accompany the report as a bound artifact.
2. **Left-nav pollution** — the `Saved Reports` entry recently added under `CAPITAL_PROGRAM` (see `.claude/memory` note history) conflates a top-level workflow with a sub-workflow of Reports. Reports → Saved Reports is the correct home.

---

## 1. Current-state map

### 1a. Files & responsibilities

| File | Path | Role |
|---|---|---|
| TAMP main page | `frontend/asset-maintenance-web/src/routes/reports.tamp.tsx` (1578 LOC) | Everything: pickers, tab strip, 8 report sections, frozen-version banner, 3 modals |
| Saved Reports | `frontend/asset-maintenance-web/src/routes/reports.tamp.versions.tsx` | Full-page version-history table (sorting/filtering) |
| Narrative editor | `frontend/asset-maintenance-web/src/features/reports/TampNarrativeTab.tsx` | Markdown + preview per § 515.9 subsection |
| Save modal | `frontend/asset-maintenance-web/src/features/reports/CreateTampVersionModal.tsx` | POST `/api/v1/tamp/versions` |
| Data hooks | `frontend/asset-maintenance-web/src/features/reports/hooks/useTampVersions.ts` | Query + mutations for versions |
| Left nav | `frontend/asset-maintenance-web/src/routes/__root.tsx` L38-43 | `CAPITAL_PROGRAM` group; currently holds the stray `Saved Reports` entry |

### 1b. Current tab strip on `/reports/tamp`

Rendered only when `isPublicAgencyVertical === true` (lines 710-719 of `reports.tamp.tsx`). Each tab is a lateral peer; nothing gates progression between them.

```
┌ [Report] [Investment Strategy] [Progress to Targets] [Strategy Process] [Resilience] [Methodology] ┐
│                                                                                                     │
│   picker card (horizon + scenario + Generate)   ← only visible on [Report] tab, and only when       │
│                                                    NOT viewing a frozen version                     │
│                                                                                                     │
│   ReportCards §1-§10  or  TampNarrativeTab       ← switched by `tab` state                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1c. Classifying the tabs by function

The insight that motivates the wizard: today's tabs are three different *kinds* of work presented as if they were peers.

| Tab | Category | Persona activity |
|---|---|---|
| Report | Output-consuming | Read; export; screenshot for FHWA reviewer |
| Investment Strategy | Input-shaping (narrative) | Author markdown; lock when finalized |
| Progress to Targets | Input-shaping (narrative) | Author markdown; lock when finalized |
| Strategy Process | Input-shaping (narrative) | Author markdown; lock when finalized |
| Resilience | Input-shaping (narrative) | Author markdown; lock when finalized |
| Methodology | Input-shaping (narrative) | Author markdown; lock when finalized |
| (Horizon + Scenario picker) | Input-shaping (structured) | Choose numbers; click Generate |
| (Version history sidebar) | Meta | Browse prior snapshots |
| (Saved Reports full page) | Meta | Same thing on a dedicated route |

The mental model the user actually holds: **inputs → generate → outputs → freeze**. The current UI presents inputs and outputs as adjacent siblings, requiring the user to hunt across tabs to complete a single generation cycle.

### 1d. Friction the audit already caught

From `engineering-playbook/vol-3-architecture/product-quality-audit-2026-07-23/ux-audit.md`:

- **UX-06** (High): Financial Plan silently shows $0 across every row when the user forgets the scenario picker. Wizard step gating eliminates this class of error.
- **UX-11** (High): public URL for a locked TAMP is not surfaced; the Saved Reports tab is where it belongs.
- **UX-15** (Medium): several dead affordances on the current page (Save button disabled without explanation until data loads). Wizard step gating replaces implicit disable with explicit "you are on step N of 3".
- **UX-21** (High): focus ring accessibility gaps on `reports.tamp.tsx` and `TampNarrativeTab.tsx`. Any redesign inherits these — see §7 accessibility checklist.

---

## 2. Proposed workflow architecture

Three options considered.

### Option A — Wizard route (`/reports/tamp/new/step-1`)

Deep URL per step; TanStack Router file-based. Each step is its own file; router enforces gating via `beforeLoad` when prior steps aren't satisfied.

- **Pros:** browser back button behaves as expected (mid-wizard is a real URL); shareable deep link ("Fill in Step 2, then send me the link"); each step file stays under ~300 LOC; URL is the source of truth for wizard state so a reload lands you back on the same step.
- **Cons:** wizard state has to survive step-to-step; either serialize to search params (verbose) or persist a `Draft` server-side on Step 1 exit and pass the id forward. The second is the correct answer but adds a backend contract.

### Option B — Split-pane single page

Left column shows the checklist ticker; right pane shows the active step. One URL.

- **Pros:** simplest to implement (no routing changes); animation between steps is trivial.
- **Cons:** back button escapes the wizard entirely (bad); no deep-link mid-wizard; violates WCAG 2.4.4 "Link Purpose" for the ticker items (each is a link semantically but goes to the same URL); mobile has to choose one column.

### Option C — Modal wizard from Reports landing

Reports landing shows Saved Reports as the primary surface with a "Generate new TAMP" CTA that opens a full-screen modal. Wizard lives entirely inside the modal.

- **Pros:** great for a one-shot task; matches how Aurigo Engage AI panel already presents workflows; deep-link to a specific saved report remains simple.
- **Cons:** page reload during a modal wizard loses state (unrecoverable without server-side draft); users treating this as a multi-day task cannot resume; modal hijacks the back button in a way most users can't reason about; ADA screen-reader focus trap for a modal that spans 3 substantive steps is fragile.

### Recommendation — **Option A** (wizard route) with the following contracts

1. **URL shape**
   - `/reports/tamp` → Reports landing (Generate tab active by default; also renders the Saved Reports tab strip). The Generate tab shows a "Start a new TAMP" CTA plus, if a draft exists for the current fiscal year, a "Resume draft" card.
   - `/reports/tamp/new` → redirects to `/reports/tamp/new/step-1-horizon` (or resumes at the furthest completed step if a draft id is in URL).
   - `/reports/tamp/new/step-1-horizon` → Step 1: horizon + scenario.
   - `/reports/tamp/new/step-2-narratives` → Step 2: the 5 § 515.9 narratives + Methodology (tab strip *inside* Step 2, but this is now scoped, not top-level).
   - `/reports/tamp/new/step-3-review` → Step 3: preview + Generate.
   - `/reports/tamp/versions` → Saved Reports (redirects into `/reports/tamp?tab=saved` after landing-page conversion — see §4).
   - `/reports/tamp/versions/$id` → single frozen version (unchanged).

2. **State persistence** — the wizard operates on a Draft `TampVersion` row created on Step 1 exit (fiscal year tag + horizon + scenario). Steps 2 and 3 update the same row. This means "save-draft" isn't a separate feature — every generation is a draft until the user promotes it in Step 3. Escapes: a "Discard draft" button on every step; auto-cleanup of untouched drafts after 30 days.

3. **Back-navigation** — from a later step to an earlier one is allowed. Editing an earlier step invalidates any generated preview on Step 3 with a "your inputs changed — regenerate?" banner (NOT auto-regenerate — the user may just be checking their numbers).

4. **Wizard step labels for accessibility** — WCAG 2.1 SC 3.3.2 requires each field to have a programmatically-associated label. For a wizard, add `aria-current="step"` on the active step in the ticker, `aria-label="Step 2 of 3: Author narratives"` on the wizard container, and a live region announcing "Now on Step N" on transition.

---

## 3. Step-by-step spec

### Step 1 — Horizon & Scenario (required)

**Entry conditions:** none (fresh visit, or "Start a new TAMP" from landing).

**Content:**
- Fiscal year tag input (defaulted to `FY{year}-{year+horizon}`, editable — matches `CreateTampVersionModal` pattern already in place).
- Horizon selector (5 / 10 / 15 / 20 years) — currently a plain `<select>`; per UX-01 this becomes `RCDropDownList` for tonal consistency.
- Scenario picker — dropdown of the tenant's LCP scenarios (id + name + status). Already implemented; migrate as-is.
- **Preview card** — as soon as horizon + scenario are chosen, show 3 read-only KPIs pulled from the scenario: total NPV cost, treatment tier mix (Preventive / Rehab / Reconstruct), and horizon-end condition target. Gives the user confidence they picked the right scenario before proceeding.
- Info callout: "You can leave the scenario blank for an inventory-only report — but the Financial Plan will show $0 across every year." (Directly closes UX-06.)

**Exit conditions:** fiscal year tag non-empty AND horizon selected. Scenario optional but if left blank, an amber-warned confirmation on Continue: "No scenario selected. Financial Plan will be blank. Continue anyway?"

**Save-draft behavior:** on Continue, POST creates a `TampVersion` row with status=Draft. If the user picks the same fiscal-year tag as an existing draft, offer "Resume existing draft" or "Create a second draft".

**Back navigation from later steps:** allowed. Edits update the same draft row; if the row was already generated, mark preview stale.

### Step 2 — Author narratives (5 § 515.9 subsections + Methodology)

**Entry conditions:** Step 1 satisfied. Draft id in URL.

**Content:** the existing `TampNarrativeTab` component, but now with:
- An inner tab strip listing the 6 subsections — each tab shows a badge: `authored`, `locked`, `not started`. (Uses same Lock / Unlock semantics that exist today.)
- Persona hint on the "not started" cards: "This section is optional but FHWA reviewers flag omissions. Skip only if your prior-cycle TAMP already covered it and you're doing an interim update."
- A running "completion" counter at the top of the pane: `4 of 6 authored`.

**Exit conditions:** none required. The user can continue with 0/6 authored — but each unauthored section shows a warning chip in Step 3 "review" step.

**Save-draft behavior:** narratives are already server-side (`/api/v1/reports/tamp/narratives`). No change.

**Back navigation:** allowed and non-destructive — narratives are independent from the horizon/scenario, so Step 2 can be revisited after Step 3 preview without invalidating anything.

### Step 3 — Review & Generate

**Entry conditions:** Step 1 satisfied. Step 2 optional but visited (bounce a first-time visitor back to Step 2 if they came here with nothing authored — after that visit, allow direct entry).

**Content:**
- **Left column (30%)** — a summary/checklist:
  - Horizon: 10 years
  - Scenario: "Baseline Preservation" · Approved
  - Narratives authored: 4/6 (list of which; missing ones amber-tagged)
  - Estimated report length: 42 pages (computed from populated sections)
- **Right column (70%)** — the same 8-section rendered report the current page already produces, but *this is the preview*. All export/print/save-as-draft actions are here.
- **Actions bar** —
  - Primary: "Generate & save version" — opens a compact confirmation (version tag, change log) then commits the Draft to a saved snapshot. Post-commit: redirect to `/reports/tamp/versions/{id}`.
  - Secondary: "Export PDF" (works on preview).
  - Secondary: "Consistency letter" (works on preview).
  - Tertiary: "Save as draft" (persists without committing; returns to landing).
  - Danger: "Discard draft".

**Exit conditions:** committing generates a saved report and redirects to the read-only version view.

**Save-draft behavior:** the draft row is already persisted; Save just closes the wizard.

**Back navigation:** yes; if the user changes Step 1 inputs, banner in Step 3 says "Inputs changed since last preview — click Regenerate preview." (No auto-regenerate; expensive query and the user may still be exploring.)

### Post-generate

Redirect to `/reports/tamp/versions/{id}` — the frozen, read-only view. From here the user can: Lock it, Copy public URL (once locked, closing UX-11), Clone as new draft, Return to Saved Reports.

---

## 4. Saved Reports relocation

### 4a. Left-nav change

**Remove** from `frontend/asset-maintenance-web/src/routes/__root.tsx` (both worktrees per the config-drift memo):

```ts
// DELETE this entry from CAPITAL_PROGRAM:
{ to: '/reports/tamp/versions', label: 'Saved Reports', Icon: FileText, ... }
```

`CAPITAL_PROGRAM` returns to: Lifecycle Planning · Capital Needs · Job Orders. Consistent with "plan → formalize → execute → report" mental model; Reports lives under a different affordance (TAMP is public-agency vertical only, and Primus currently redirects `/reports` — see `reports.tsx`).

### 4b. Reports landing on `/reports/tamp`

Replace the top of the current page with a segmented tab strip that has two, and only two, tabs:

```
┌─────────────────────────────────────────────────────────────────┐
│ Reports · Transportation Asset Management Plan                  │
│                                                                 │
│   [ Generate ]   [ Saved Reports ]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **Generate** (default) — the landing card described in §2 recommendation. "Start a new TAMP" primary CTA. If drafts exist, "Resume draft" cards below.
- **Saved Reports** — hosts the `TampVersionsPage` component (currently at `/reports/tamp/versions`) inline in this tab.

URL contract:
- `/reports/tamp` → Generate tab
- `/reports/tamp?tab=saved` → Saved Reports tab (in same page; TanStack Router `validateSearch` picks up `tab`)
- `/reports/tamp/versions` → redirects to `/reports/tamp?tab=saved` (preserves bookmarks for one release, then can be retired)
- `/reports/tamp/versions/{id}` → unchanged frozen-version view

### 4c. Public-agency gating

`/reports/tamp` remains public-agency-only (guard already exists via `isPublicAgencyVertical`). For Primus (private-sector) tenants, `reports.tsx` continues to redirect. No change to the vertical gate.

---

## 5. Migration path

Two-phase to avoid muscle-memory whiplash for CSMs who demo TAMP weekly.

**Phase 1 (sprint N):**
1. Land Reports landing with tabs + wizard routes side-by-side with the existing page. Move the current `reports.tamp.tsx` implementation to `reports.tamp-legacy.tsx` (accessible at `/reports/tamp-legacy`) for one sprint.
2. Add an in-page banner on `/reports/tamp-legacy`: "The TAMP workflow has moved. [Try the new workflow] · [Give us feedback]".
3. Remove `Saved Reports` from left nav (`__root.tsx`) in both worktrees. Add redirect rule for `/reports/tamp/versions` → `/reports/tamp?tab=saved`.
4. Feature flag: `tamp.wizard.enabled` (default true; CSM can override to false for a specific demo tenant if a customer isn't ready).

**Phase 2 (sprint N+1):**
1. Delete `reports.tamp-legacy.tsx`. Retire the feature flag.
2. Delete the `/reports/tamp/versions` route file after 30 days of the redirect (analytics: if the redirect fires <1% of Reports traffic, safe to delete).

**Config-drift guard implication:** the `__root.tsx` nav delta is per-worktree (primus vs masterworks). Coordinate with the W5.3 config-drift guard so both worktrees stay aligned. Reference: `feedback_vite_config_per_worktree` and `feedback_masterworks_backport_primus_refs` memos.

---

## 6. Committee sign-off checklist

### [PM viewpoint] — product-manager

**Question:** does this collapse a workflow the CSM / TAMP Coordinator personas actually run?

**Answer (represented):** Yes for the primary user (TAMP Coordinator producing an annual snapshot). The wizard shape maps exactly to their 3-week cycle: (Week 1) pick horizon + validate scenario with the LCP team; (Week 2) write narratives with the resilience officer and engineering leads; (Week 3) preview, PE-attestation, submit. Today the flat tab layout hides "what comes next" — the wizard makes it explicit.

**Caveat to flag:** the Capital Planner persona sometimes wants to *view* the report against a different scenario without generating a new saved version — a "sandbox preview" mode. Today they can do this on the current page (pick, Generate, don't Save). The wizard as drafted requires a draft row on Step 1 exit. **Recommendation:** allow Step 3 to render a live preview without persisting a draft *iff* the user came from the landing "Preview against another scenario" secondary CTA (rare; add later if analytics say we need it).

**Risk:** if the PM discovers that TAMP Coordinators treat Investment Strategy + Strategy Process as parallel work with different authors, the "linear" wizard framing is wrong for them. The mitigation is that Step 2 is internally non-linear — it's a completion checklist, not a forced sequence.

### [Architect viewpoint] — tech-architect

**Question:** URL shape, back-button contract, browser history, state-persistence — architectural gotchas?

**Answer (represented):**
- **Draft persistence** — Step 1 exit creates a `TampVersion` row with status=Draft; each subsequent step updates it. Backend contract already supports draft rows. Existing `useCreateTampVersion` accepts `horizonYears`, `scenarioId`, `versionTag`, `fiscalYearTag`. Verified in `hooks/useTampVersions.ts`.
- **In-flight wizard survives reload** — because state lives on the server as the Draft row. Route reads draft id from URL search param (`?draft={id}`); if missing, redirect to Step 1 to start.
- **Auth-timeout edge case** — token expiry mid-Step-2 fails the narrative save silently today. Wizard must catch 401 and route to `/login?returnTo={current-step-url}`. `apiFetch` already surfaces status codes (see `apiFetch 204 handling` memo).
- **TanStack Router `beforeLoad` gating** — each step file's `beforeLoad` verifies the previous step's exit condition against the Draft row. Prevents URL-hopping past Step 1 without a valid draft.
- **Query staleness** — Step 3 preview should use `enabled: false` + manual `refetch()` (per `feedback_tanstack_manual_query_needs_refetch` memo) so a stale window doesn't auto-refire the expensive `/api/v1/reports/tamp` query.

**Concern:** the current `apiFetch` prefix pitfall (per memo `apiFetch prefix`) — every new endpoint must start with `/api/v1/`. Confirm all wizard step handlers include the full prefix during implementation.

**No new backend endpoints required.** All CRUD already exists on `TampVersion`.

### [Frontend viewpoint] — frontend-lead

**Question:** TanStack Router file-based routing implications, TanStack Query staleness, form state (react-hook-form) vs URL state — feasibility + effort estimate?

**Answer (represented):**
- **File-based routing** — TanStack Router picks up new files by convention. Wizard steps become:
  - `routes/reports.tamp.new.tsx` (layout with the step ticker + `<Outlet />`)
  - `routes/reports.tamp.new.step-1-horizon.tsx`
  - `routes/reports.tamp.new.step-2-narratives.tsx`
  - `routes/reports.tamp.new.step-3-review.tsx`
- **State ownership** — Step 1 form state is react-hook-form + zod on the client, committed to the Draft row on submit. Step 2 narratives already have their own persistence. Step 3 preview reads the Draft.
- **Component reuse** — the § 1–10 report cards from `reports.tamp.tsx` extract into a `<TampReportRender data={...} />` component reused in Step 3 preview and `/reports/tamp/versions/{id}`. The current page is 1578 LOC; the render section is ~800 LOC of that. Extract improves testability regardless.
- **Landing page** — `reports.tamp.tsx` shrinks dramatically (becomes just the two-tab container + landing card + the versions table inline). Estimated post-refactor LOC: ~300 for the landing, ~150 per wizard step, ~800 for the extracted renderer.

**Effort estimate:** **2 lead-weeks** (frontend-lead solo).
- Week 1: extract `<TampReportRender>`; scaffold the 3 wizard step files with skeleton content; wire draft-row lifecycle; ship landing page with two tabs.
- Week 2: preview integration in Step 3; Step 1 preview KPI card; migration path (legacy route + redirects + banner); axe-devtools sweep of new steps; regression suite update (`e2e/tamp.spec.ts` covers current tabs — needs a new spec for the wizard happy path).

**Blockers to raise before Week 1:**
- Design tokens for the wizard step ticker (progress bar tone: primary for complete, muted for pending, destructive for error). Verify against `tailwind.config.js`.
- `RCDropDownList` vs plain `<select>` — UX-01 already asks for this; do the swap here so we don't double-touch the picker.

### [UX viewpoint] — ux-strategist (me)

I own information architecture, empty/loading/error states, keyboard flow, accessibility, and mobile-viewport behavior.

**Information architecture:**
- Reports landing surfaces one primary action (Generate) and one supplementary surface (Saved Reports). Two tabs, not more. If additional report types are added later (private-sector Aurigo Plan output), they get their own left-nav entry, not a third tab here.

**States:** every wizard step needs all four states + a fifth wizard-specific one.

| State | Step 1 | Step 2 | Step 3 |
|---|---|---|---|
| Loading | Skeleton on the scenario dropdown | Skeleton on the tabbed narrative list | Skeleton on the preview |
| Empty | Zero scenarios exist → "Create a scenario in Lifecycle Planning first" with link | Zero narratives authored → shown as amber counters | Preview empty → cannot happen (Step 1 gated) |
| Error | Scenario fetch 500 → inline error + Retry | Narrative fetch 500 → per-tab inline error | Preview generate 500 → surface `error.detail` (closes UX-06 mention of masked errors) |
| Populated | Normal flow | Normal flow | Normal flow |
| Stale-inputs | N/A | N/A | "Inputs changed — Regenerate preview" banner |

**Keyboard flow:**
- Wizard ticker items are `<button role="link">` (visual list, semantic navigation).
- `Tab` order: ticker → primary content → action bar.
- `Enter` on Continue advances; `Esc` on the wizard triggers a "Save draft and exit?" confirmation.
- Focus lands on the first field of the new step after transition (announced via live region).

**Accessibility:**
- Preserve UX-21 remediation: focus rings on every button/link/select. Since this is a redesign, do NOT ship without an `axe-devtools` clean run on each step.
- Wizard ticker uses `aria-current="step"` on the active item.
- Live region (`role="status"`, `aria-live="polite"`) announces "Now on Step 2 of 3: Author narratives" on transition.
- Preview markdown is already rendered via `renderMarkdown` (escape-safe per UX-21). Do not swap the renderer in this sprint.

**Mobile:**
- Field Inspector doesn't file TAMPs; this is a desktop workflow. But we should not regress: at 375px, the step ticker collapses to a single "Step 2 of 3" pill with prev/next chevrons; step content stacks vertically. This costs no dedicated engineering time — it's a Tailwind media-query pattern already used elsewhere in the app.

---

## 7. Decisions confirmed (2026-07-24)

The 6 open questions have been answered by the user. Implementation should follow these decisions.

1. **Save-draft persistence horizon — 90 days, with a visible countdown timer in the UI.**
   - `TampVersion` gains a `DraftExpiresAtUtc` column, defaulted to `CreatedAtUtc + 90 days` on Draft rows (nullable for Locked/Submitted).
   - Wizard Step 1 header and the Saved Reports "Draft" row both render a chip showing days remaining (e.g. "Expires in 87 days"). Chip goes amber at ≤ 14 days, red at ≤ 3 days.
   - A background cleanup job runs daily and archives (soft-deletes) drafts past expiry — do NOT hard-delete; keep for a 30-day audit tail per `runbooks/data-retention.md`.
   - Backend contract: `PATCH /api/v1/tamp/versions/{id}/refresh-snapshot` extends `DraftExpiresAtUtc` by 90 days from `NowUtc` on each successful refresh (user is clearly still working on it).
2. **Step 2 narratives are optional-with-warning.**
   - Empty narrative sections do NOT block Step 3 progression. Instead, Step 3 shows an inline warning banner "3 of 6 narrative sections are empty — the generated report will contain visible blank sections. Continue?" with a "Back to Step 2" secondary button and a "Generate anyway" primary.
   - Locked versions never require all narratives — that stays a property of the FHWA revision cycle, not our tool.
3. **No role gate on Generate for now — Admin should have access.**
   - Wizard's "Generate & save version" button is available to any authenticated user with TAMP module access (matches today's `/reports/tamp` gate).
   - If a role gate is added later, Admin must be explicitly exempted (Admin bypasses all role gates by convention — see `vol-3-architecture/authz-model.md`).
   - No new backend authorization surface for this MVP.
4. **Ship both layouts for 1 sprint with a feature flag.**
   - New wizard route lives at `/reports/tamp/new/step-{1-horizon,2-narratives,3-review}`.
   - Legacy route `/reports/tamp-legacy` keeps the current tabbed layout live for 1 sprint (post-merge).
   - A dismissable in-page banner on `/reports/tamp` reads "New workflow — [Give feedback] · [Use legacy layout]" pointing at `/reports/tamp-legacy`.
   - Feature-flag key: `TAMP_WIZARD_ENABLED` (defaults to true on merge; ops flips off if a critical regression surfaces).
   - After 1 sprint the legacy route is deleted and the flag is retired.
5. **Preview and Generate are two separate actions.**
   - Step 3 has a "Regenerate preview" secondary CTA — free, live, no server row created. Refreshes the compiled render from the current input state.
   - "Generate & save version" is the primary CTA — commits the snapshot, freezes as a `TampVersion` row, redirects to the frozen version view.
   - The two actions never share the same button. Preview is idempotent; Generate is a one-way commit.
6. **Saved Reports = tab (not segmented control).**
   - Two tabs on `/reports/tamp`: `Generate` (workflow entry: "Start new TAMP" / "Resume draft" cards) and `Saved Reports` (embedded `TampVersionsPage`).
   - Tab strip pattern already in place (Report / Investment Strategy / ... / Saved Reports) as of commit `29e1ab4` / `91fd9e1` — no new UI primitive required.

### Scope delta from the original plan

The 90-day countdown UI (Q1) adds ~0.5 lead-day to Week 2 for the chip component + backend column + cleanup job.
The optional-narratives warning banner (Q2) adds ~0.25 lead-day to Week 2.
Everything else is inside the original 2 lead-week estimate. **New total: ~2.1 lead-weeks.**

---

## 8. Handoff checklist

Once the user signs off:
- [ ] `product-manager` — validate persona assumptions in §6 [PM viewpoint], especially the "sandbox preview" caveat.
- [ ] `tech-architect` — confirm no new backend contract needed; validate the auth-timeout return-to flow works with existing JWT.
- [ ] `frontend-lead` — start with the `<TampReportRender>` extraction as a standalone PR before the wizard scaffolding. Reduces risk of the two work streams stepping on each other.
- [ ] `qa-lead` — new Playwright spec for the wizard happy path; update existing `reports.tamp.spec.ts` to cover the legacy-route redirect during the migration sprint.
- [ ] `ux-strategist` (self) — axe-devtools review of each wizard step at 1440px and 375px; sign-off before merge.

---

## Appendix — References

- `frontend/asset-maintenance-web/src/routes/reports.tamp.tsx` — current TAMP page (1578 LOC)
- `frontend/asset-maintenance-web/src/routes/reports.tamp.versions.tsx` — current Saved Reports full-page table
- `frontend/asset-maintenance-web/src/features/reports/TampNarrativeTab.tsx` — narrative editor
- `frontend/asset-maintenance-web/src/features/reports/CreateTampVersionModal.tsx` — save modal (note: caller/callee prop drift exists, out of scope for this plan but worth a separate fix)
- `frontend/asset-maintenance-web/src/features/reports/hooks/useTampVersions.ts` — server-state contract
- `frontend/asset-maintenance-web/src/routes/__root.tsx` — left nav (Saved Reports removal target)
- `engineering-playbook/vol-2-product-knowledge/domains/tamp.md` — TAMP domain reference
- `engineering-playbook/vol-3-architecture/product-quality-audit-2026-07-23/ux-audit.md` — UX-06 / UX-11 / UX-15 / UX-21 findings that this redesign inherits
- `vault/personas/Capital-Planner.md`, `vault/personas/Director-Infrastructure.md` — persona anchors
