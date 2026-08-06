-- Knowledge base: ingested documents chunked with metadata for relevance
-- ranking. Sources: local Input folder, upload console, SharePoint sync.
-- Dedup: unique content hash at the document level.

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text,
  source text not null default 'upload' check (source in ('upload', 'local_folder', 'sharepoint', 'war_room', 'manual')),
  doc_type text not null default 'other' check (doc_type in ('prd', 'jtbd', 'transcript', 'release_note', 'battlecard', 'other')),
  product_id uuid references products(id) on delete set null,
  upload_id uuid references uploads(id) on delete set null,
  content_hash text not null unique,
  ai_enabled boolean not null default false,
  chunk_count int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  chunk_hash text not null,
  heading text,
  token_estimate int not null default 0,
  metadata jsonb not null default '{}',
  tsv tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_document_idx on document_chunks(document_id);
create index if not exists document_chunks_tsv_idx on document_chunks using gin(tsv);

alter table documents enable row level security;
alter table document_chunks enable row level security;

-- Ranked retrieval over AI-enabled documents only.
create or replace function match_chunks(q text, n int default 8)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  heading text,
  metadata jsonb,
  title text,
  doc_type text,
  rank real
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.heading,
    c.metadata,
    d.title,
    d.doc_type,
    ts_rank(c.tsv, websearch_to_tsquery('english', q)) as rank
  from document_chunks c
  join documents d on d.id = c.document_id
  where d.ai_enabled
    and c.tsv @@ websearch_to_tsquery('english', q)
  order by rank desc
  limit n
$$;
