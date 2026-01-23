-- Add soft-archive to conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_conversations_user_archived_at_created_at
ON public.conversations (user_id, archived_at, created_at DESC);

-- Optional: backfill existing rows to NULL explicitly (no-op if already NULL)
UPDATE public.conversations SET archived_at = NULL WHERE archived_at IS NULL;