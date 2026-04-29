-- ============================================================
-- Aluria MVP Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (usually enabled by default in Supabase)
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  created_at  timestamptz default now() not null
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade not null,
  role        text not null check (role in ('user', 'ai')),
  content     text not null,
  created_at  timestamptz default now() not null
);

create table if not exists public.knowledge_bases (
  project_id   uuid primary key references public.projects(id) on delete cascade,
  json_content jsonb not null default '{
    "problem": "",
    "actors": [],
    "process_flow": [],
    "functional_requirements": []
  }'::jsonb,
  updated_at   timestamptz default now() not null
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists messages_project_id_idx on public.messages(project_id);
create index if not exists messages_created_at_idx on public.messages(created_at);
create index if not exists projects_user_id_idx on public.projects(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.projects       enable row level security;
alter table public.messages       enable row level security;
alter table public.knowledge_bases enable row level security;

-- Projects: user owns their own projects
create policy "Users can manage their own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Messages: user can access messages belonging to their projects
create policy "Users can manage messages in their projects"
  on public.messages for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = messages.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = messages.project_id
        and p.user_id = auth.uid()
    )
  );

-- Knowledge bases: user can access KBs belonging to their projects
create policy "Users can manage knowledge bases in their projects"
  on public.knowledge_bases for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = knowledge_bases.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = knowledge_bases.project_id
        and p.user_id = auth.uid()
    )
  );
