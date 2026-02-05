-- Create function to get recent episodic memories with temporal context
CREATE OR REPLACE FUNCTION public.get_recent_episodic_memories(
  p_user_id uuid DEFAULT auth.uid(),
  p_project_id uuid DEFAULT NULL,
  p_days_back int DEFAULT 30,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  episode_at timestamptz,
  days_ago int,
  confidence double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    m.id,
    m.title,
    m.content,
    m.episode_at,
    EXTRACT(DAY FROM (now() - m.episode_at))::int as days_ago,
    m.confidence
  FROM public.memories m
  WHERE
    m.user_id = p_user_id
    AND m.is_active = true
    AND m.status = 'approved'
    AND m.episode_at IS NOT NULL
    AND m.episode_at >= now() - (p_days_back || ' days')::interval
    AND (p_project_id IS NULL OR m.project_id = p_project_id)
  ORDER BY m.episode_at DESC
  LIMIT p_limit;
$$;