# UI/UX Design Review

---

## Header

| Field | Value |
|-------|-------|
| **Review ID** | DR-[NNN] |
| **Feature / Story** | [Story ID and title] |
| **Designer** | [Name] |
| **Frontend Engineer** | [Name] |
| **Reviewer** | [Lead Frontend Engineer name] |
| **Date** | YYYY-MM-DD |
| **Figma Frame** | [Link to Figma frame, or "Wireframe in PR description"] |
| **Product** | Masterworks / Primus / Both |
| **Module** | [Module name] |

---

## Design Description

[Two to four sentences describing what UI change is being introduced. What screen or component is new or modified? What user action does it enable? What is the primary interaction pattern?]

---

## Target Personas

| Persona | How They Use This UI |
|---------|---------------------|
| [Persona name] | [One sentence describing their primary interaction with this UI] |
| [Persona name] | [One sentence] |

---

## Design Goals

1. [Specific design goal — e.g., "Allow a field inspector to record a condition rating in under 60 seconds on a mobile device."]
2. [Specific design goal]
3. [Specific design goal]

---

## Figma / Wireframe Reference

[Link to Figma frame with the proposed design. If Figma is not available, attach wireframe screenshots to the PR description and note "See PR description" here.]

Screens included in this review:
- [Screen 1 name] — [brief description]
- [Screen 2 name] — [brief description]
- [Screen 3 name] — [brief description]

---

## Accessibility Checklist

Rate each item: **Pass**, **Fail**, or **N/A**.

### Keyboard Navigation

| # | Check | Result | Notes |
|---|-------|--------|-------|
| KN-1 | All interactive elements (buttons, links, inputs, dropdowns) are reachable via Tab key | | |
| KN-2 | Tab order follows a logical reading sequence (left-to-right, top-to-bottom) | | |
| KN-3 | No keyboard trap: pressing Tab eventually leaves every component | | |
| KN-4 | Dialogs and modals trap focus correctly (Tab cycles within the dialog; Escape closes) | | |
| KN-5 | Dropdown menus and comboboxes are navigable with arrow keys per ARIA APG patterns | | |

### Focus Indicators

| # | Check | Result | Notes |
|---|-------|--------|-------|
| FI-1 | All interactive elements have a visible focus ring that is distinct from the hover state | | |
| FI-2 | Focus ring meets 3:1 contrast ratio against adjacent background color | | |
| FI-3 | Custom components do not remove the browser default focus ring without providing an equivalent | | |

### ARIA Labels and Semantics

| # | Check | Result | Notes |
|---|-------|--------|-------|
| AR-1 | All icon-only buttons have an `aria-label` or visually-hidden `<span>` text | | |
| AR-2 | All form inputs have an associated `<label>` element (not just placeholder text) | | |
| AR-3 | Error messages are associated with their input via `aria-describedby` | | |
| AR-4 | Status messages and toasts use `role="status"` or `role="alert"` appropriately | | |
| AR-5 | Tables (if any) use `<thead>`, `<th scope="col">`, and `<caption>` or `aria-label` | | |
| AR-6 | Modals use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the title | | |

### Color Contrast

| # | Check | Result | Notes |
|---|-------|--------|-------|
| CC-1 | Normal text (< 18pt / non-bold < 14pt): contrast ratio >= 4.5:1 | | |
| CC-2 | Large text (>= 18pt / bold >= 14pt): contrast ratio >= 3:1 | | |
| CC-3 | UI components and icons: contrast ratio >= 3:1 against adjacent color | | |
| CC-4 | Color is not the sole means of conveying information (e.g., status icons use icon + color, not color alone) | | |
| CC-5 | Focus rings meet 3:1 contrast against background | | |

### Screen Reader Test

| # | Check | Result | Notes |
|---|-------|--------|-------|
| SR-1 | Primary user journey completed using VoiceOver (Mac) or NVDA (Windows) without mouse | | |
| SR-2 | Decorative images use `alt=""` so they are skipped by screen readers | | |
| SR-3 | Dynamic content updates (e.g., loading state, filter results) are announced | | |

### Motion and Animation

| # | Check | Result | Notes |
|---|-------|--------|-------|
| MO-1 | All non-essential animations respect `prefers-reduced-motion: reduce` media query | | |
| MO-2 | No content flashes more than 3 times per second | | |

---

## Responsive Design Checklist

Test at the following breakpoints: 375px (iPhone SE), 768px (iPad portrait), 1280px (standard desktop), 1440px (wide desktop).

### 375px — Mobile

| # | Check | Result | Notes |
|---|-------|--------|-------|
| RD-1 | No horizontal scroll at 375px viewport width | | |
| RD-2 | Touch targets are at least 44x44px per WCAG 2.5.5 | | |
| RD-3 | Text does not overflow its container | | |
| RD-4 | Tables reflow to card layout or have horizontal scroll with accessible label | | |
| RD-5 | Sidebar / navigation is accessible (hamburger menu or collapsible panel) | | |

### 768px — Tablet

| # | Check | Result | Notes |
|---|-------|--------|-------|
| RD-6 | Layout uses the 768px breakpoint defined in `tailwind.config.ts` | | |
| RD-7 | Two-column layouts stack gracefully without content truncation | | |

### 1280px+ — Desktop

| # | Check | Result | Notes |
|---|-------|--------|-------|
| RD-8 | Content area does not exceed the maximum container width (1280px, defined in Tailwind config) | | |
| RD-9 | Whitespace is balanced; content is not stretched awkwardly on wide screens | | |

---

## Design System Compliance

| # | Check | Result | Notes |
|---|-------|--------|-------|
| DS-1 | All new components are built from shadcn/ui primitives where an appropriate primitive exists | | |
| DS-2 | No custom colors are introduced outside the Tailwind design token system | | |
| DS-3 | Typography uses only the type scale defined in `tailwind.config.ts` | | |
| DS-4 | Spacing uses Tailwind spacing tokens (no arbitrary pixel values in class names except documented exceptions) | | |
| DS-5 | Icons are from the approved icon library (Lucide React) with consistent size tokens | | |
| DS-6 | New variants of existing components are added to the component file, not duplicated | | |
| DS-7 | Component is added to the component catalogue if it will be reused | | |

---

## Content and Copy Review

| # | Check | Result | Notes |
|---|-------|--------|-------|
| CP-1 | All labels use consistent terminology with the rest of the application | | |
| CP-2 | Error messages are specific and actionable (not "Something went wrong") | | |
| CP-3 | Empty states are designed: both zero-data-ever and zero-results-for-filter are handled | | |
| CP-4 | Confirmation dialogs for destructive actions clearly state what will be deleted / changed | | |
| CP-5 | Help text or tooltips are present for fields that require domain knowledge | | |
| CP-6 | No lorem ipsum or placeholder copy in the implementation | | |

---

## Performance Checklist

| # | Check | Result | Notes |
|---|-------|--------|-------|
| PF-1 | No images larger than their rendered size are loaded (use `srcset` for responsive images) | | |
| PF-2 | Images are in WebP format (or SVG for icons) where possible | | |
| PF-3 | Components below the fold use `React.lazy()` or are loaded on interaction | | |
| PF-4 | Large data tables use virtualization (`tanstack-virtual`) for lists > 100 rows | | |
| PF-5 | No new synchronous blocking operations on the main thread | | |

---

## Findings

### Blockers
*Issues that prevent this design from being implemented as-is.*

| # | Screen | Finding |
|---|--------|---------|
| B-1 | [Screen name] | [Description] |

*(Write "None" if no blockers.)*

### Revisions Requested
*Changes required before implementation begins.*

| # | Screen | Finding |
|---|--------|---------|
| R-1 | [Screen name] | [Description and suggested fix] |

### Suggestions
*Optional improvements that would enhance quality but are not required.*

| # | Screen | Suggestion |
|---|--------|-----------|
| S-1 | [Screen name] | [Suggestion] |

---

## Decision

**Result:** Approved / Revision Required / Rejected

**Date:** YYYY-MM-DD

**Revision Notes:** [Describe required changes if Revision Required. Include which checklist items failed and what the designer / engineer must do to resolve them.]

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| Frontend Engineer | [Name] | YYYY-MM-DD |
| Lead Frontend Engineer / Reviewer | [Name] | YYYY-MM-DD |
| Product Manager (copy/content sign-off) | [Name] | YYYY-MM-DD |
