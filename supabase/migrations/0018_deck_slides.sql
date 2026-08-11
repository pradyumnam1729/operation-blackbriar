-- Deck Studio (blueprint app/docs/blueprints/deck-studio.md §2).
-- Structured slides for deck artifacts. content_html on the same row is ALWAYS
-- the server-derived HTML rendering of these slides — never edited directly.
-- Idempotent: the runner re-applies every migration each run.

alter table artifact_versions
  add column if not exists slides_json jsonb;

comment on column artifact_versions.slides_json is
  'DeckDoc (schema 1) for deck artifacts; null for documents and legacy versions. See app/backend/src/services/deck.ts.';
