# UX Specification: Asset Warranty Attributes

> **Scope:** Visual placement and interaction design for the warranty feature (Version A).  
> This document is the UX design artifact referenced in `Organization_Simulation.md` and required by the Frontend Lead before building begins.

---

## Design Principles for This Feature

1. **Warranty is secondary information.** The asset condition score, RUL, and capital need are primary. Warranty status is contextual — it matters most when a user is about to authorise repair spend. It should be visible without dominating the page.

2. **Three states, always explicit.** Active warranty (green), expiring soon (amber), no warranty / expired (neutral). Never leave the user uncertain about which state they're in.

3. **Data entry happens at rehabilitation time, not as a separate flow.** The user records warranty information as part of logging a maintenance event — not by navigating to a separate "Warranty" section. This reduces friction and keeps the data in context.

---

## Screen 1: Asset Detail Page

### Layout (Desktop 1440px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Assets    Bridge 001 — Main Street Overpass                    [Edit]   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────────────────────┐ │
│  │  CONDITION           │  │  ASSET INFO                                  │ │
│  │  ●●●○○  3.2 / 5.0   │  │  Class: Bridge · Subclass: Overpass          │ │
│  │  Fair                │  │  Installed: Jun 2000 · Age: 26 years         │ │
│  │  RUL: 8 years        │  │  Material: Reinforced Concrete               │ │
│  └──────────────────────┘  └──────────────────────────────────────────────┘ │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠ WARRANTY EXPIRING SOON                            [View details] │   │
│  │  Smith Bros Construction · Expires Jan 15 2027 (89 days remaining)  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ↑ Amber banner — only shown when within LeadTimeDays of expiry             │
│                                                                             │
│  ┌─ Maintenance History ──────────────────────────────────────────────────┐ │
│  │  Jan 15 2025  Deck Rehabilitation — Full overlay replacement           │ │
│  │               Cost: $185,000  · Contractor: Smith Bros Construction    │ │
│  │               🛡 Under Warranty until Jan 15 2027                     │ │  ← green shield badge inline
│  │                                                                         │ │
│  │  Mar 2022     Bearing Replacement                                       │ │
│  │               Cost: $42,000  · No warranty recorded                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ WARRANTY ─────────────────────────────────────────────────────────────┐ │
│  │  🟢 ACTIVE WARRANTY                                                     │ │
│  │                                                                         │ │
│  │  Vendor          Smith Bros Construction                                │ │
│  │  Expires         January 15, 2027                                       │ │
│  │  Period          24 months                                              │ │
│  │  Days remaining  89 days                                                │ │
│  │  Notes           Contract ref: PW-2025-0142. Covers full deck overlay   │ │
│  │                  and waterproofing membrane.                            │ │
│  │                                                                         │ │
│  │  [Edit warranty]                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Warranty Panel — Three States

**State 1: Active warranty (green)**
```
┌─ WARRANTY ──────────────────────────────────────────────┐
│  🟢 ACTIVE WARRANTY                                      │
│  Vendor: Smith Bros Construction                         │
│  Expires: January 15, 2027 · 89 days remaining           │
│  [Edit warranty]                                         │
└──────────────────────────────────────────────────────────┘
```

**State 2: Expiring soon — within LeadTimeDays (amber, banner + panel)**
```
┌─ WARRANTY ──────────────────────────────────────────────┐
│  🟡 WARRANTY EXPIRING SOON                               │
│  Vendor: Smith Bros Construction                         │
│  Expires: January 15, 2027 · 89 days remaining           │
│  ⚠ Inspect the asset and file any claims before expiry. │
│  [Edit warranty]                                         │
└──────────────────────────────────────────────────────────┘
```

**State 3: No warranty or expired (neutral / collapsed)**
```
┌─ WARRANTY ──────────────────────────────────────────────┐
│  No active warranty                                      │
│  [Add warranty to a maintenance event]  ← links to      │
│                                          maintenance log │
└──────────────────────────────────────────────────────────┘
```

**State 4: Expired warranty (grey, historical)**
```
┌─ WARRANTY ──────────────────────────────────────────────┐
│  ⚪ EXPIRED                                              │
│  Vendor: Smith Bros Construction                         │
│  Expired: January 15, 2024                               │
│  [Add warranty to a maintenance event]                   │
└──────────────────────────────────────────────────────────┘
```

---

## Screen 2: Asset List — Under Warranty Filter

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Assets                                              [+ Add asset]  [Export]│
│─────────────────────────────────────────────────────────────────────────────│
│  Filters: [Asset class ▼] [Condition ▼] [Under Warranty ●] [Clear all]     │
│           ↑ Toggle pill — active state (filled) = filter on                  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Name                   Class    Condition  Warranty         Risk     │  │
│  │───────────────────────────────────────────────────────────────────────│  │
│  │  Bridge 001 Main St     Bridge   Fair 3.2   🟡 89 days left  High    │  │
│  │  Culvert 014 Oak Ave    Culvert  Good 4.1   🟢 210 days left  Low    │  │
│  │  Pathway 003 Park Blvd  Path     Good 4.5   🟢 340 days left  Low    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  3 assets under warranty                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

The "Under Warranty" column is visible on all asset list views (even when the filter is off) but shows "—" for assets with no active warranty. This keeps the column low-noise when browsing all assets.

---

## Screen 3: Add Warranty — Maintenance Event Form

Warranty is recorded as part of the "Log Maintenance Event" form, not as a separate navigation destination.

```
┌─ Log Maintenance Event ────────────────────────────────────────────────────┐
│                                                                             │
│  Event type   [Rehabilitation ▼]          Date  [Jan 15 2025]              │
│  Description  [Deck overlay replacement                     ]              │
│  Cost         [$185,000              ]    Contractor  [Smith Bros Constr.] │
│                                                                             │
│  ─ Warranty ─────────────────────────────────────────────────────────────  │
│                                                                             │
│  [ ] This event includes a contractor warranty                              │
│  ↑ Unchecked by default. Checking reveals the fields below.                │
│                                                                             │
│  ▼ (when checked):                                                          │
│                                                                             │
│  Warranty period   [24] months   OR   Expiry date  [Jan 15 2027]           │
│  (enter one — system computes the other from the event date)               │
│                                                                             │
│  Vendor / contractor   [Smith Bros Construction          ]                 │
│  (pre-filled from "Contractor" field above if present)                     │
│                                                                             │
│  Notes   [Contract ref: PW-2025-0142. Covers full deck overlay and         │
│           waterproofing membrane.                              ]            │
│                                                                             │
│  ────────────────────────────────────────────────────────────────────────  │
│                              [Cancel]  [Save maintenance event]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key UX decisions:**
- Warranty section is collapsed (opt-in checkbox) because most maintenance events do not have a warranty. Showing it by default would add noise to every routine maintenance log.
- Vendor field pre-fills from the "Contractor" field to reduce re-entry.
- Period (months) and expiry date are linked inputs — entering one computes the other. The user enters whichever appears in their contract document.

---

## Screen 4: Dashboard — Warranty Expiry Alert

The 90-day alert appears in the existing Capital Needs panel on the dashboard.

```
┌─ Capital Needs ──────────────────────────────────────────────────────────┐
│                                                                           │
│  🔴  3  Critical RUL (< 2 years)                                         │
│  🟠  7  High Risk assets requiring inspection                             │
│  🟡  2  Warranty expiring soon  ← new alert type                         │
│  ⚪  12  Deferred maintenance backlog items                               │
│                                                                           │
│  [View all capital needs]                                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

Clicking "2 Warranty expiring soon" navigates to the asset list pre-filtered to `warrantyActive=true&expiringWithin=90`.

---

## Mobile (375px) — Asset Detail

On mobile, the WARRANTY panel moves below the Condition panel and Maintenance History. It is collapsed by default ("Under warranty — tap to expand") to conserve vertical space on small screens. The expiring-soon amber banner always shows at full height above the fold.

```
┌───────────────────────┐
│ ← Bridge 001          │
│ Fair 3.2 · RUL 8yr    │
│                       │
│ ⚠ WARRANTY EXPIRING   │
│ Smith Bros · 89 days  │
│                       │
│ Maintenance History ▶ │
│ WARRANTY ▶            │  ← collapsed, tap to expand
│ Capital Needs ▶       │
└───────────────────────┘
```

---

## Accessibility Requirements

- Warranty status colours (green / amber / grey) are accompanied by text labels ("Active", "Expiring Soon", "Expired") — never colour alone
- `WarrantyStatusBadge` has `role="status"` and `aria-label="Warranty status: Active, expires January 15 2027, 89 days remaining"`
- The amber expiring-soon banner is an `<aside role="alert" aria-live="polite">` — screen readers announce it when it first renders
- "Under Warranty" toggle in asset list has `aria-pressed` state
- All form fields in the Add Warranty section have associated `<label>` elements

---

## Component Inventory (for Frontend Lead)

| Component | Location | Notes |
|---|---|---|
| `WarrantyStatusBadge` | `features/warranty/components/` | Inline badge: 🟢/🟡/⚪ + text |
| `WarrantyPanel` | `features/warranty/components/` | Full detail panel on asset detail page |
| `WarrantyExpiringBanner` | `features/warranty/components/` | Amber banner for expiring-soon state |
| `WarrantyFormSection` | `features/warranty/components/` | Collapsible section within maintenance event form |
| `useWarranty` | `features/warranty/api/` | TanStack Query hook: `GET /api/v1/assets/{id}/warranty` |
| `useAddWarranty` | `features/warranty/api/` | `useMutation` for `POST /api/v1/warranty` |
| `useUpdateWarranty` | `features/warranty/api/` | `useMutation` for `PUT /api/v1/warranty/{id}` |

---

## Related

- `vault/decisions/ADR-011-warranty-attributes.md`
- `engineering-playbook/vol-2-product-knowledge/domains/warranty.md`
- `Organization_Simulation.md` — role simulation that produced this specification
