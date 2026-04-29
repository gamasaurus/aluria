-- ============================================================
-- Aluria Production Upgrade — Migration 001
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add description to projects
alter table public.projects
  add column if not exists description text not null default '';

-- 2. Add depth_score and completion_score columns to knowledge_bases
alter table public.knowledge_bases
  add column if not exists depth_score float not null default 0,
  add column if not exists completion_score float not null default 0;

-- 3. knowledge_depth table — per-section depth breakdown
create table if not exists public.knowledge_depth (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade not null,
  actors_depth  jsonb not null default '{"count":0,"has_roles":false,"has_permissions":false,"score":0}'::jsonb,
  process_depth jsonb not null default '{"step_count":0,"has_decisions":false,"has_edge_cases":false,"score":0}'::jsonb,
  functional_depth jsonb not null default '{"count":0,"has_actions":false,"has_io":false,"score":0}'::jsonb,
  rules_depth   jsonb not null default '{"has_constraints":false,"has_validations":false,"score":0}'::jsonb,
  updated_at    timestamptz default now() not null,
  unique(project_id)
);

-- 4. documents_preview table — persisted editable document content
create table if not exists public.documents_preview (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade not null,
  content     text not null default '',
  updated_at  timestamptz default now() not null,
  unique(project_id)
);

-- 5. Indexes
create index if not exists knowledge_depth_project_id_idx on public.knowledge_depth(project_id);
create index if not exists documents_preview_project_id_idx on public.documents_preview(project_id);

-- 6. RLS for new tables
alter table public.knowledge_depth    enable row level security;
alter table public.documents_preview  enable row level security;

create policy "Users can manage knowledge_depth in their projects"
  on public.knowledge_depth for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = knowledge_depth.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = knowledge_depth.project_id and p.user_id = auth.uid()
    )
  );

create policy "Users can manage documents_preview in their projects"
  on public.documents_preview for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = documents_preview.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = documents_preview.project_id and p.user_id = auth.uid()
    )
  );
