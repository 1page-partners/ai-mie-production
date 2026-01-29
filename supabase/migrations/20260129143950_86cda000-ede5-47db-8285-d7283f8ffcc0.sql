-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. RLS policies for user_roles
-- Users can see their own roles
CREATE POLICY "users_can_view_own_roles"
  ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all roles
CREATE POLICY "admins_can_view_all_roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert roles
CREATE POLICY "admins_can_insert_roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update roles
CREATE POLICY "admins_can_update_roles"
  ON public.user_roles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can delete roles
CREATE POLICY "admins_can_delete_roles"
  ON public.user_roles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Create usage_logs table for dashboard
CREATE TABLE public.usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL, -- 'chat', 'memory_create', 'memory_approve', 'knowledge_sync', etc.
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own logs
CREATE POLICY "users_can_insert_own_logs"
  ON public.usage_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all logs
CREATE POLICY "admins_can_view_all_logs"
  ON public.usage_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Create view for usage stats (admin only via RLS)
CREATE OR REPLACE FUNCTION public.get_usage_stats(
  p_start_date timestamptz DEFAULT now() - interval '30 days',
  p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE (
  total_users bigint,
  active_users bigint,
  total_conversations bigint,
  total_messages bigint,
  total_memories bigint,
  approved_memories bigint,
  candidate_memories bigint,
  total_knowledge_sources bigint,
  total_knowledge_chunks bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(DISTINCT user_id) FROM profiles) as total_users,
    (SELECT count(DISTINCT user_id) FROM conversations WHERE created_at >= p_start_date AND created_at <= p_end_date) as active_users,
    (SELECT count(*) FROM conversations WHERE created_at >= p_start_date AND created_at <= p_end_date) as total_conversations,
    (SELECT count(*) FROM conversation_messages WHERE created_at >= p_start_date AND created_at <= p_end_date) as total_messages,
    (SELECT count(*) FROM memories) as total_memories,
    (SELECT count(*) FROM memories WHERE status = 'approved') as approved_memories,
    (SELECT count(*) FROM memories WHERE status = 'candidate') as candidate_memories,
    (SELECT count(*) FROM knowledge_sources) as total_knowledge_sources,
    (SELECT count(*) FROM knowledge_chunks) as total_knowledge_chunks
$$;

-- 8. Function to get daily usage for charts
CREATE OR REPLACE FUNCTION public.get_daily_usage(
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  date date,
  conversations bigint,
  messages bigint,
  new_memories bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dates AS (
    SELECT generate_series(
      current_date - (p_days - 1),
      current_date,
      '1 day'::interval
    )::date as date
  )
  SELECT
    d.date,
    COALESCE((SELECT count(*) FROM conversations WHERE created_at::date = d.date), 0) as conversations,
    COALESCE((SELECT count(*) FROM conversation_messages WHERE created_at::date = d.date), 0) as messages,
    COALESCE((SELECT count(*) FROM memories WHERE created_at::date = d.date), 0) as new_memories
  FROM dates d
  ORDER BY d.date
$$;

-- 9. Index for performance
CREATE INDEX idx_usage_logs_created_at ON public.usage_logs(created_at);
CREATE INDEX idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);