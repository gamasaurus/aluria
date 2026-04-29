-- ============================================================
-- Aluria Project Versions — Migration 003
-- Adds project_versions table for KB snapshot history.
-- Additive only: no existing tables or policies are modified.
-- ============================================================

-- 1. Create project_versions table
CREATE TABLE IF NOT EXISTS public.project_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  version     int NOT NULL,
  kb_snapshot jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Index for efficient project-based queries
CREATE INDEX IF NOT EXISTS project_versions_project_id_idx
  ON public.project_versions(project_id);

-- 3. Enable RLS
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

-- 4. RLS policy: users can only access versions for their own projects
CREATE POLICY "Users can manage versions in their projects"
  ON public.project_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_versions.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_versions.project_id AND p.user_id = auth.uid()
    )
  );
