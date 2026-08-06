-- PMM Workspace: Positioning & Messaging documents built from the standard
-- question set, with a Director approval workflow.

create table if not exists pmm_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  product text not null check (product in ('Masterworks', 'Essentials', 'Primus', 'Lumina')),
  status text not null default 'draft' check (status in ('draft', 'pending', 'changes', 'approved')),
  answers jsonb not null default '{}',
  owner_id uuid references profiles(id),
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  last_edited_by uuid references profiles(id),
  last_edited_at timestamptz,
  kb_document_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pmm_doc_comments (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references pmm_docs(id) on delete cascade,
  author_id uuid references profiles(id),
  role_label text not null default 'Director of PMM',
  body text not null,
  created_at timestamptz not null default now()
);

alter table uploads add column if not exists pmm_doc_id uuid references pmm_docs(id) on delete set null;

alter table pmm_docs enable row level security;
alter table pmm_doc_comments enable row level security;
