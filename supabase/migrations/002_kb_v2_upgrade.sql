-- ============================================================
-- Aluria KB V2 Upgrade — Migration 002
-- Additive only: no columns, tables, or RLS policies are dropped.
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS).
-- ============================================================

-- 1. Add kb_version to knowledge_bases (default 1 = flat MVP KB)
ALTER TABLE public.knowledge_bases
  ADD COLUMN IF NOT EXISTS kb_version integer NOT NULL DEFAULT 1;

-- 2. Add depth_score integer column for V2 scoring
--    Migration 001 added depth_score as float; this adds kb_v2_depth_score as integer.
--    We use a separate column to avoid altering the existing float column.
ALTER TABLE public.knowledge_bases
  ADD COLUMN IF NOT EXISTS depth_score_v2 integer NOT NULL DEFAULT 0;

-- 3. Add completion_score numeric column for V2 scoring
--    Migration 001 added completion_score as float; this is a no-op if it already exists.
ALTER TABLE public.knowledge_bases
  ADD COLUMN IF NOT EXISTS completion_score_v2 numeric(5,2) NOT NULL DEFAULT 0;

-- 4. Add projects.description (nullable) — already added by migration 001 as NOT NULL,
--    so this is a safe no-op.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description text;

-- 5. Index for version-based queries
CREATE INDEX IF NOT EXISTS kb_version_idx
  ON public.knowledge_bases(kb_version);
