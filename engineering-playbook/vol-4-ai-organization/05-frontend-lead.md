# Frontend Lead

## Mission

The Frontend Lead owns the quality, accessibility, and user experience of the Maintain React/TypeScript application. In an AI-native engineering organization, this role supervises the patterns that AI agents use to generate React components, TanStack Query hooks, TanStack Router routes, and Tailwind/shadcn/ui styled interfaces — ensuring that every screen the user sees is correct, accessible, performant, and consistent.

The Frontend Lead is the domain expert for the frontend stack (React 18, Vite 5, TypeScript 5, TanStack Router, TanStack Query, react-hook-form + zod, shadcn/ui, Mapbox GL JS) and for the UX principles that govern this product (mobile-first, progressive disclosure, print-ready, accessible).

---

## Responsibilities

### Frontend Code Review

Own PR review for all frontend code. Apply a pattern-recognition approach: the Frontend Lead is looking for the most common failure modes of AI-generated React code, not reading every line.

Primary failure mode categories:

**Data Fetching Violations**
AI agents frequently generate `useEffect` hooks for data fetching, which is the pre-TanStack Query pattern. In this codebase, all server state must use `useQuery` or `useMutation` from TanStack Query. Using `useEffect` for data fetching bypasses loading state management, caching, background refetch, and error handling.

```typescript
// Violation: useEffect for data fetching
useEffect(() => {
  fetch('/api/v1/assets').then(r => r.json()).then(setAssets);
}, []);

// Correct: TanStack Query
const { data: assets, isLoading, error } = useQuery({
  queryKey: ['assets', tenantId],
  queryFn: () => apiClient.getAssets({ tenantId }),
});
```

**Missing Loading and Error States**
AI agents frequently generate components that render only the success state. Every component that depends on async data must handle: loading (skeleton or spinner), error (user-friendly error message with retry option), and empty state (when data is valid but empty).

**Accessibility Violations**
Common AI accessibility gaps: missing ARIA labels on icon-only buttons, form fields without associated `<label>` elements, keyboard-inaccessible custom interactive elements, insufficient color contrast. Every interactive element must be keyboard-operable. Every image must have alt text.

**Component Size Violations**
Components exceeding 200 lines should be decomposed. AI agents tend to generate monolithic components when given a complex feature brief. The Frontend Lead catches and refactors these before they become unmaintainable.

**TypeScript Type Safety Gaps**
AI agents sometimes use `any` type annotations to avoid complex type inference, especially with the TanStack Router type-safe links. This codebase uses TanStack Router's type-safe navigation — `Link` and `useNavigate` must use typed route params.

**Mobile Layout Failures**
AI agents primarily design for desktop. The Frontend Lead checks every new component at 375px width. Missing responsive breakpoints, fixed-width containers that overflow on mobile, and touch targets smaller than 44x44px are common failures.

### Pattern Library Maintenance

Own the component library built on top of shadcn/ui primitives. When the same UI pattern appears in multiple features, the Frontend Lead extracts it into a reusable component in `src/components/`. Common patterns to maintain:

- `ConditionBadge`: standardized condition score display with color band
- `RiskScoreBadge`: risk score with color and label
- `AssetCard`: asset summary card used in lists and maps
- `InspectionStatusBadge`: inspection status with color coding
- `LoadingPage` and `ErrorPage`: standardized full-page loading and error states
- `PageHeader`: consistent page title + breadcrumb + action button layout
- `FilterBar`: reusable filter control pattern for list pages

When AI agents generate code that reimplements an existing shared component, the Frontend Lead blocks the PR and points to the shared component. Duplication creates maintenance burden and visual inconsistency.

### Accessibility Audit

Run a monthly accessibility audit using automated tools (axe-core via the Playwright test suite) and manual keyboard navigation testing. Report violations to the team. Critical (keyboard inaccessibility, missing ARIA) are resolved in the current sprint. High (insufficient contrast, missing labels) are resolved in the following sprint.

### Performance Monitoring

Monitor Core Web Vitals (LCP, CLS, FID/INP) in staging. Target: LCP < 2.5s on a 4G mobile connection, CLS < 0.1. Bundle size increases are reviewed with the ED before merging. Large dependencies (Mapbox GL JS excepted — it is required) must be justified.

---

## KPIs

| KPI | Target | Measurement Frequency |
|---|---|---|
| useEffect Violation Rate | Zero useEffect for data fetching in merged PRs | Per sprint |
| Missing Loading/Error State Rate | < 1 per 20 AI-generated components | Per sprint |
| Accessibility Violations (Critical) | Zero in staging | Monthly |
| Mobile Layout Violations | Zero at 375px breakpoint in merged PRs | Per sprint |
| Component Size Violations | < 5% of components exceeding 200 lines | Monthly |
| TypeScript Strict Mode Pass Rate | 100% of files pass TypeScript strict mode | Per CI run |
| Core Web Vitals (LCP) | < 2.5s on simulated 4G | Weekly |
| Component Reuse Rate | > 80% of list/card patterns use shared components | Monthly |

---

## Authority

The Frontend Lead has authority to:
- Block a PR for pattern violations (with specific code examples of the issue and the correction)
- Mandate accessibility fixes before a feature ships to production
- Require mobile layout testing before merge
- Update the shared component library

The Frontend Lead does not have authority to:
- Change product scope or feature design
- Override UX Strategist on design decisions
- Deploy independently to production

---

## Deliverables

**Per sprint**: Frontend PR review log (violation types and frequencies), mobile review report

**Monthly**: Accessibility audit report, Core Web Vitals performance report, component reuse analysis

**Quarterly**: Frontend technology health check (are any dependencies outdated? security vulnerabilities? TanStack Router/Query major version considerations?)

---

## Decision Making

When reviewing an AI-generated frontend PR, the Frontend Lead uses a structured scan:

1. **Check TypeScript compilation**: Does it pass `tsc --noEmit` with zero errors? If not, block immediately.
2. **Check for useEffect violations**: Does any component use useEffect for data fetching? Block.
3. **Check loading/error states**: For every component with a query, are all three states (loading, error, success) handled?
4. **Check 375px layout**: Does the component render correctly on a 375px viewport? Open in browser devtools, resize.
5. **Check accessibility**: Tab through the component. Can every interactive element be reached and activated by keyboard?
6. **Check component size**: Is any component over 200 lines? If so, is there a clear decomposition strategy?
7. **Check shared component usage**: Does this component reinvent something already in `src/components/`?

---

## Daily Workflow

**08:00–08:30** — Review overnight CI results, check for TypeScript or test failures introduced overnight.

**08:30–10:30** — Frontend PR review queue. Target: zero PRs waiting more than 4 hours during business hours.

**10:30–11:30** — Component library work: reviewing new component requests, extracting patterns, writing component documentation.

**11:30–12:00** — UX Strategist sync (2x/week): review designs for upcoming features, validate technical feasibility, agree on component approach.

**14:00–16:00** — Deep work: accessibility testing, performance profiling, complex component design for upcoming sprint work.

**16:00–17:00** — Documentation: update the frontend pattern guide, add notes to constraint documents based on patterns seen in PR reviews.

---

## Collaboration

**With UX Strategist**: Daily partnership. UX Strategist designs the experience; Frontend Lead implements it using the component library. When a design requires a new component, the Frontend Lead sizes the effort and flags any accessibility or mobile concerns early.

**With Backend Lead**: API contract alignment. When a new endpoint is needed, the Frontend Lead drives the response shape from the UI's perspective (what data does the component actually need?) and coordinates with the Backend Lead to define the DTO.

**With QA Lead**: Frontend component testing standards. The QA Lead owns the Playwright E2E test strategy; the Frontend Lead ensures component-level tests (Vitest + React Testing Library) cover the unit behavior.

**With Mobile Inspector (indirectly)**: The Frontend Lead is the primary advocate for the mobile inspector experience within engineering. When a new feature is designed, the Frontend Lead asks: "What does this look like for an inspector on a tablet with gloves on?"

---

## Escalation

The Frontend Lead escalates to the ED when:
- An accessibility violation is disputed (some engineers resist accessibility work as "cosmetic")
- A performance budget increase requires a dependency addition
- Mobile layout requirements would significantly increase implementation complexity and may need to be phased

---

## Continuous Improvement

Weekly: review the violation log for pattern recurrence. If AI agents are consistently generating `useEffect` for data fetching despite the constraint document, the constraint needs to be rewritten with more concrete examples and explicit counter-examples.

Monthly: run the accessibility audit with a new set of features. Track the violation trend over time — the goal is a declining trend as agent constraints improve.

---

## Example Scenarios

### Scenario 1: Blocking a Complex Component for Missing States

An AI-generated PR adds the Capital Plan Gantt chart component. The component renders correctly in the happy path — a list of projects with bars on a timeline. But the Backend Lead notices: what happens when the data is loading? What happens when the API returns an error? What happens when the capital plan has zero projects?

The Frontend Lead checks the code: none of these states are handled. The component renders `null` during loading (blank screen), throws an uncaught exception on error, and renders an empty container with no message for empty state.

The Frontend Lead blocks the PR with specific requirements: (1) loading state: render the `<LoadingPage />` shared component, (2) error state: render the `<ErrorPage />` shared component with retry button, (3) empty state: render a helpful message "No projects in this capital plan. Add a project from the Capital Needs register." After the fix is applied, the PR is approved.

### Scenario 2: Decomposing a 450-Line Component

An AI-generated PR adds the Asset Detail page: condition history chart, inspection list, work order list, risk score panel, RUL gauge, ARV calculation, and action buttons. The component file is 450 lines.

The Frontend Lead blocks and provides a decomposition plan: `<AssetDetailPage />` is the page component (max 60 lines) that composes: `<ConditionHistoryPanel />`, `<InspectionListPanel />`, `<WorkOrderListPanel />`, `<AssetRiskPanel />`, `<AssetRulPanel />`, `<AssetArvPanel />`. Each panel fetches its own data using useQuery (not passed down as props from the parent) and handles its own loading/error states independently, so the page doesn't show a full-page loading screen while all panels load simultaneously.

This decomposition also significantly improves testability: each panel can be tested in isolation.

### Scenario 3: Mobile Layout Failure on the Inspection Form

An AI-generated inspection form PR is reviewed. On desktop, it looks clean: a two-column layout with labels on the left and inputs on the right. The Frontend Lead opens Chrome devtools, sets viewport to 375px, and the layout collapses: labels and inputs overlap, the submit button is partially hidden behind the mobile browser bottom bar, and the photo capture grid is 4 columns wide (completely illegible at 375px).

The Frontend Lead provides specific corrections: switch to single-column layout at breakpoints below `md`, use CSS env(safe-area-inset-bottom) for bottom button positioning, and reduce photo grid to 2 columns on mobile. The PR is blocked until these are fixed and a screenshot at 375px is included in the PR description.
