# Ticket: Lint rule forbidding inline `style=` in `useRCToast` content strings

- **Status:** filed (not started)
- **Filed by:** frontend-lead
- **Filed on:** 2026-07-23 (W7.2 wave-2 remediation)
- **Suggested owner:** devops (adds the rule) + frontend-lead (fixes existing violations)
- **Priority:** medium — CSP rollout blocks silently on this pattern

## Problem

The `useRCToast().show(...)` primitive accepts an HTML string in its `content`
field so callers can embed anchors or emphasis inside a Syncfusion toast. When
authors compose that HTML with inline `style="…"` attributes, the anchor
styling breaks silently under Content Security Policy `style-src 'self'`
because the browser strips the inline style — no console error, just an
unstyled affordance.

## Recurrence log

**Framing (W9-FE #7 revision):** filed as **preventive-only** after a single
occurrence, not as a two-recurrence triage per
`vol-3-architecture/13-testing.md § "Preventable regressions."` A `git log
--all -p --grep="style="` sweep across `frontend/` on 2026-07-23 turned up
zero prior fixes to inline `style="..."` inside toast content strings; the
UX-strategist pattern-violation flag was speculative rather than a citable
recurrence. The ticket is retained because the CSP-rollout blast radius
justifies a lint rule even at a single-occurrence cost.

1. Sprint W6.1 — `JobOrderPushStatusTab.tsx` persistence-failed toast used
   `style="text-decoration:underline;font-weight:600;"` on the recovery
   anchor. Fixed W7.2 by moving to `.toast-charter-link` class in `index.css`
   (Wave-2 blocker UX-B1); anchor styles element-scoped to `a.toast-charter-link`
   in W9-FE #5.

If a second occurrence lands before the rule ships, upgrade this ticket from
`preventive-only` to `remediation-triage` per the two-recurrences threshold.

## Proposed rule

**Preferred:** an ESLint custom rule (repo already runs ESLint via
`frontend/asset-maintenance-web/.eslintrc*`), or a Biome rule if the team
migrates. Rule shape:

- **Rule name:** `no-inline-style-in-rc-toast-content`
- **Category:** security / CSP compliance
- **Trigger:** a template literal or string concatenation passed as the
  `content` property of an object literal that is itself an argument to a
  `.show(...)` call on any identifier ending in `Toast` (matches
  `toast.show({ content: \`...\` })` where the string literal contains
  `style="`).
- **Auto-fix suggestion:** cannot auto-fix (needs a class name); emit a
  message pointing at `index.css § "Toast anchor styles"` and instruct the
  author to add a new `.toast-*` class rather than inline the style.

## Enforcement

- CI blocks on the rule (error, not warn) once the existing codebase is
  clean. Grep for `useRCToast|toast.show` × `style="` inside content string
  literals returns zero matches today after W7.2 remediation.
- The rule scope is intentionally narrow — it only fires inside
  `content:` values of `.show({...})` calls, not on JSX `style={...}`
  props elsewhere in the tree.

## Effort estimate

- Rule authoring + tests: 1 day (devops)
- Fixing any newly-surfaced violations: <1 day (frontend-lead)
- Rollout: single PR, no per-worktree divergence
