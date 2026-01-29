-- Add status column for memory candidate workflow
-- Existing memories become 'approved'
ALTER TABLE public.memories
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved' CHECK (status IN ('candidate', 'approved', 'rejected'));

-- Add reviewed_at timestamp
ALTER TABLE public.memories
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL;

-- Add rejected_reason
ALTER TABLE public.memories
ADD COLUMN IF NOT EXISTS rejected_reason text NULL;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_memories_status ON public.memories(status);

-- Create index for candidate review
CREATE INDEX IF NOT EXISTS idx_memories_candidate_review ON public.memories(status, user_id, created_at DESC) WHERE status = 'candidate';

-- Update match_memories to only return approved memories
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding extensions.vector,
  match_count integer DEFAULT 10,
  p_user_id uuid DEFAULT auth.uid(),
  p_project_id uuid DEFAULT NULL::uuid,
  min_confidence double precision DEFAULT 0.0
)
RETURNS TABLE(
  id uuid,
  type ai_mie_memory_type,
  title text,
  content text,
  confidence double precision,
  pinned boolean,
  updated_at timestamp with time zone,
  score double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  select
    m.id,
    m.type,
    m.title,
    m.content,
    m.confidence,
    m.pinned,
    m.updated_at,
    1 - (m.embedding <=> query_embedding) as score
  from public.memories m
  where
    m.user_id = p_user_id
    and m.is_active = true
    and m.status = 'approved'
    and m.confidence >= min_confidence
    and (p_project_id is null or m.project_id = p_project_id)
    and m.embedding is not null
  order by
    m.pinned desc,
    m.embedding <=> query_embedding asc
  limit match_count;
$function$;