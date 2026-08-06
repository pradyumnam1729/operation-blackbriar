# PMM Agent — Web App

The application layer of Operation Blackbriar. Two packages:

```
app/
├── backend/    Express + TypeScript API. Wraps the Claude API, loads the GTM War Room
│               as its knowledge base, enforces guardrails (forbidden words, draft gate).
└── frontend/   React + Vite UI. Foundation-doc builder, role-aware Ask, asset generator,
                approvals queue. Styled per Aurigo Brand Standards (Dark Teal, Roboto,
                sharp corners).
```

Architecture reference: `../pmm-playbook/vol-3-architecture/`. The app encodes the same rules the Claude Code workspace enforces: brand DNA is always in context (cached prompt prefix), positioning → messaging → copy, drafts before finals, deterministic forbidden-words checks.

## Run it

Backend (port 3001):

```
cd app/backend
npm install
copy .env.example .env   # set ANTHROPIC_API_KEY
npm run dev
```

Frontend (port 5173, proxies /api to 3001):

```
cd app/frontend
npm install
npm run dev
```

## Key endpoints

| Endpoint | What it does |
|----------|--------------|
| `POST /api/query` | `{question, role}` → war-room-grounded answer framed for the role, with source citations |
| `GET /api/foundation` | List foundation-doc sections (from `GTM-War-Room/BRAND-DNA/` + library) |
| `POST /api/assets/generate` | `{type, product, audience}` → draft asset (battlecard, one-pager, exec brief) |
| `GET /api/assets` | List drafts awaiting approval |
| `POST /api/assets/:id/approve` | Promote draft → final (PMM admin gate) |

The backend reads the war room from `../../GTM-War-Room` by default (`WAR_ROOM_DIR` to override) — the app and the Claude Code workspace share one knowledge base.
