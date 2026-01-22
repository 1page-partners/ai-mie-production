-- Move vector extension to dedicated schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- Ensure functions have a safe and complete search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
SET search_path = public, extensions
AS $$
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
    and m.confidence >= min_confidence
    and (p_project_id is null or m.project_id = p_project_id)
    and m.embedding is not null
  order by
    m.pinned desc,
    m.embedding <=> query_embedding asc
  limit match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding extensions.vector,
  match_count integer DEFAULT 10,
  p_user_id uuid DEFAULT auth.uid(),
  p_project_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  chunk_id uuid,
  source_id uuid,
  source_name text,
  content text,
  meta jsonb,
  score double precision
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  select
    kc.id as chunk_id,
    ks.id as source_id,
    ks.name as source_name,
    kc.content,
    kc.meta,
    1 - (kc.embedding <=> query_embedding) as score
  from public.knowledge_chunks kc
  join public.knowledge_sources ks on ks.id = kc.source_id
  where
    ks.user_id = p_user_id
    and (p_project_id is null or ks.project_id = p_project_id)
    and kc.embedding is not null
    and ks.status = 'ready'
  order by
    kc.embedding <=> query_embedding asc
  limit match_count;
$$;