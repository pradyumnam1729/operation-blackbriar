# Supabase setup

The database holds metadata and the query/answer log; content truth stays in
`GTM-War-Room/` markdown (see `pmm-playbook/vol-3-architecture/02-data-model.md`).
The backend degrades gracefully: with no Supabase credentials it runs file-only.

## Hosted (recommended)

1. Create a project at https://supabase.com/dashboard (any region; free tier is fine).
2. Run `migrations/0001_init.sql` in the project's **SQL Editor** (paste + run),
   or link the CLI: `supabase link --project-ref <ref>` then `supabase db push`.
3. In **Project Settings → API**, copy:
   - Project URL → `SUPABASE_URL`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`
4. Put both in `app/backend/.env`. Never commit the service-role key and never
   ship it to the frontend — all DB access goes through the backend.

## Local (Docker)

Requires Docker Desktop running:

```
supabase init      # if config is not present
supabase start     # prints API URL + service_role key → put in app/backend/.env
```

Migrations in `migrations/` are applied automatically by `supabase start` /
`supabase db reset`.

## What gets stored

| Table | Purpose |
|-------|---------|
| `products` | Product registry (seeded with the Aurigo portfolio) |
| `query_log` | Every Ask-the-War-Room Q&A — feeds messaging-effectiveness and gtm-performance metrics |
| `assets` | Generated-asset lifecycle: draft → final gate state, guard results, pointer to the war-room file |

RLS is enabled with no public policies: only the backend (service role) can read/write.
