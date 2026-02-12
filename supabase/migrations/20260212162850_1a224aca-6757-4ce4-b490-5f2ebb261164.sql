
-- Admin function to list all conversations with user display names
CREATE OR REPLACE FUNCTION public.admin_list_conversations(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  title text,
  created_at timestamptz,
  archived_at timestamptz,
  display_name text,
  message_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id,
    c.user_id,
    c.title,
    c.created_at,
    c.archived_at,
    p.display_name,
    (SELECT count(*) FROM conversation_messages cm WHERE cm.conversation_id = c.id) as message_count
  FROM conversations c
  LEFT JOIN profiles p ON p.user_id = c.user_id
  WHERE
    has_role(auth.uid(), 'admin'::app_role)
    AND (p_user_id IS NULL OR c.user_id = p_user_id)
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Admin function to read messages of any conversation
CREATE OR REPLACE FUNCTION public.admin_list_messages(
  p_conversation_id uuid
)
RETURNS TABLE(
  id uuid,
  conversation_id uuid,
  user_id uuid,
  role text,
  content text,
  created_at timestamptz,
  meta jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    cm.id,
    cm.conversation_id,
    cm.user_id,
    cm.role,
    cm.content,
    cm.created_at,
    cm.meta
  FROM conversation_messages cm
  WHERE
    has_role(auth.uid(), 'admin'::app_role)
    AND cm.conversation_id = p_conversation_id
  ORDER BY cm.created_at ASC;
$$;
