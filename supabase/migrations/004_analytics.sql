-- Migration 004: Analytics Events Table
-- Tracks anonymous analytics events for product usage insights

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  data jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS required (anonymous events allowed)
-- This table intentionally allows anonymous inserts for analytics tracking

-- Index for querying events by type
CREATE INDEX IF NOT EXISTS analytics_events_event_idx ON public.analytics_events(event);

-- Index for querying events by timestamp
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events(created_at DESC);

-- Index for querying events by user (when user_id is present)
CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx ON public.analytics_events(user_id) WHERE user_id IS NOT NULL;
