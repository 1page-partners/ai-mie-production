-- =============================================
-- AI-MIE Origin Integration: Phase 1 - Schema
-- =============================================

-- 1. Add 'origin' role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'origin';

-- 2. Setup Sessions (Constitution creation by origin)
CREATE TABLE public.setup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text
);

ALTER TABLE public.setup_sessions ENABLE ROW LEVEL SECURITY;

-- Origin can manage their own sessions
CREATE POLICY "origin_manage_own_sessions" ON public.setup_sessions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can view and update all sessions
CREATE POLICY "admin_manage_all_sessions" ON public.setup_sessions
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. Setup Answers (12 fixed questions)
CREATE TABLE public.setup_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.setup_sessions(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  question_text text NOT NULL,
  answer_rule text NOT NULL,
  answer_rationale text,
  answer_exceptions text,
  proposed_type ai_mie_memory_type NOT NULL DEFAULT 'procedure',
  proposed_confidence double precision NOT NULL DEFAULT 0.9,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_key)
);

ALTER TABLE public.setup_answers ENABLE ROW LEVEL SECURITY;

-- Origin can manage answers for their sessions
CREATE POLICY "origin_manage_own_answers" ON public.setup_answers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM setup_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM setup_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- Admin can view all answers
CREATE POLICY "admin_view_all_answers" ON public.setup_answers
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- 4. Origin Decisions (10 incident cases)
CREATE TABLE public.origin_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  incident_key text NOT NULL,
  decision text NOT NULL,
  reasoning text NOT NULL,
  context_conditions text,
  non_negotiables text,
  confidence double precision NOT NULL DEFAULT 0.8,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, incident_key)
);

ALTER TABLE public.origin_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "origin_manage_own_decisions" ON public.origin_decisions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin_view_all_decisions" ON public.origin_decisions
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- 5. Origin Decision Profiles (AI-extracted logic)
CREATE TABLE public.origin_decision_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES public.origin_decisions(id) ON DELETE CASCADE,
  raw_answer jsonb NOT NULL,
  extracted_logic jsonb,
  abstracted_context text,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.origin_decision_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "origin_view_own_profiles" ON public.origin_decision_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM origin_decisions d WHERE d.id = decision_id AND d.user_id = auth.uid())
  );

CREATE POLICY "admin_manage_all_profiles" ON public.origin_decision_profiles
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 6. Origin Principles (Abstracted decision axes)
CREATE TABLE public.origin_principles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  principle_key text NOT NULL,
  principle_label text NOT NULL,
  description text NOT NULL,
  polarity text,
  confidence double precision NOT NULL DEFAULT 0.7,
  source_incident_ids uuid[] DEFAULT '{}',
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, principle_key)
);

ALTER TABLE public.origin_principles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "origin_view_own_principles" ON public.origin_principles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admin_manage_all_principles" ON public.origin_principles
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 7. RPC: Match origin principles by embedding similarity
CREATE OR REPLACE FUNCTION public.match_origin_principles(
  query_embedding vector,
  match_count integer DEFAULT 5,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  principle_key text,
  principle_label text,
  description text,
  polarity text,
  confidence double precision,
  score double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    op.id,
    op.principle_key,
    op.principle_label,
    op.description,
    op.polarity,
    op.confidence,
    1 - (op.embedding <=> query_embedding) as score
  FROM public.origin_principles op
  WHERE
    (p_user_id IS NULL OR op.user_id = p_user_id)
    AND op.embedding IS NOT NULL
  ORDER BY op.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- 8. RPC: Match origin decisions by embedding similarity
CREATE OR REPLACE FUNCTION public.match_origin_decisions(
  query_embedding vector,
  match_count integer DEFAULT 3,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  incident_key text,
  decision text,
  reasoning text,
  context_conditions text,
  non_negotiables text,
  confidence double precision,
  score double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    od.id,
    od.incident_key,
    od.decision,
    od.reasoning,
    od.context_conditions,
    od.non_negotiables,
    od.confidence,
    1 - (odp.embedding <=> query_embedding) as score
  FROM public.origin_decisions od
  JOIN public.origin_decision_profiles odp ON odp.decision_id = od.id
  WHERE
    (p_user_id IS NULL OR od.user_id = p_user_id)
    AND odp.embedding IS NOT NULL
  ORDER BY odp.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- 9. Triggers for updated_at
CREATE TRIGGER set_setup_answers_updated_at
  BEFORE UPDATE ON public.setup_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_origin_decisions_updated_at
  BEFORE UPDATE ON public.origin_decisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_origin_principles_updated_at
  BEFORE UPDATE ON public.origin_principles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();