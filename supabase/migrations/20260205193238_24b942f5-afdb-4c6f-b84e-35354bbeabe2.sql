-- Add episode_at column to memories for temporal context
ALTER TABLE public.memories 
ADD COLUMN IF NOT EXISTS episode_at timestamptz;

-- Add index for efficient temporal queries
CREATE INDEX IF NOT EXISTS idx_memories_episode_at 
ON public.memories (episode_at DESC NULLS LAST) 
WHERE episode_at IS NOT NULL;