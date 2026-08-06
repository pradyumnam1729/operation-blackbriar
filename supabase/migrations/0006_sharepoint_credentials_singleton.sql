-- Enforce a single sharepoint_credentials row so concurrent/retried saves
-- cannot create duplicates (which would break getGraphCreds/maybeSingle-style
-- reads and wedge the connector into "not configured").
--
-- INVARIANT: the sharepoint_credentials row's config holds the Graph client
-- secret in plaintext jsonb. Every reader of the integrations table outside
-- /api/sharepoint MUST exclude kind = 'sharepoint_credentials' (see the
-- .neq() filter in app/backend/src/routes/integrations.ts). Longer term this
-- belongs in a dedicated secrets table or server-side encryption.
create unique index if not exists integrations_sharepoint_credentials_singleton
  on integrations (kind) where kind = 'sharepoint_credentials';
