-- ============================================
-- Shared Insights Feature: Database Schema
-- ============================================

-- 1) profile_prefs: 人名言及 opt-in 設定
CREATE TABLE IF NOT EXISTS public.profile_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_attribution boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_prefs_owner_crud" ON public.profile_prefs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_profile_prefs_updated_at
  BEFORE UPDATE ON public.profile_prefs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2) shared_insights: 共有知テーブル
CREATE TABLE IF NOT EXISTS public.shared_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  topic text NOT NULL,
  summary text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  source_conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  source_message_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contributors uuid[] NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'org' CHECK (visibility IN ('org', 'project', 'private')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  embedding extensions.vector(1536),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_insights ENABLE ROW LEVEL SECURITY;

-- RLS: Select - approved OR own
CREATE POLICY "shared_insights_select" ON public.shared_insights
  FOR SELECT
  USING (status = 'approved' OR created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RLS: Insert - own only
CREATE POLICY "shared_insights_insert" ON public.shared_insights
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- RLS: Update - own or admin
CREATE POLICY "shared_insights_update" ON public.shared_insights
  FOR UPDATE
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RLS: Delete - own or admin
CREATE POLICY "shared_insights_delete" ON public.shared_insights
  FOR DELETE
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shared_insights_tags ON public.shared_insights USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_shared_insights_status_project ON public.shared_insights(status, project_id);
CREATE INDEX IF NOT EXISTS idx_shared_insights_created_by ON public.shared_insights(created_by);
CREATE INDEX IF NOT EXISTS idx_shared_insights_embedding ON public.shared_insights 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Trigger for updated_at
CREATE TRIGGER update_shared_insights_updated_at
  BEFORE UPDATE ON public.shared_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3) shared_insight_refs: 参照ログ
CREATE TABLE IF NOT EXISTS public.shared_insight_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  insight_id uuid NOT NULL REFERENCES public.shared_insights(id) ON DELETE CASCADE,
  assistant_message_id uuid REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  score double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, assistant_message_id, insight_id)
);

ALTER TABLE public.shared_insight_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_insight_refs_owner_crud" ON public.shared_insight_refs
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = shared_insight_refs.conversation_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = shared_insight_refs.conversation_id AND c.user_id = auth.uid()
  ));

-- 4) knowledge_sources に version/change_summary 追加
ALTER TABLE public.knowledge_sources 
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS change_summary text;

-- 5) knowledge_refs に source_id/source_version 追加
ALTER TABLE public.knowledge_refs
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_version int;

-- 6) match_shared_insights 関数
CREATE OR REPLACE FUNCTION public.match_shared_insights(
  query_embedding extensions.vector,
  match_count int DEFAULT 3,
  p_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  topic text,
  summary text,
  tags text[],
  contributors uuid[],
  created_by uuid,
  score double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    si.id,
    si.topic,
    si.summary,
    si.tags,
    si.contributors,
    si.created_by,
    1 - (si.embedding <=> query_embedding) as score
  FROM public.shared_insights si
  WHERE
    si.status = 'approved'
    AND si.embedding IS NOT NULL
    AND (p_project_id IS NULL OR si.project_id = p_project_id OR si.visibility = 'org')
  ORDER BY si.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;