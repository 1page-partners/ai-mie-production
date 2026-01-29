-- ============================================
-- PDFアップロード用 Storage バケット作成
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-files',
  'knowledge-files',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for knowledge-files bucket
-- Users can upload their own files
CREATE POLICY "Users can upload knowledge files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'knowledge-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own files
CREATE POLICY "Users can view own knowledge files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'knowledge-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
CREATE POLICY "Users can delete own knowledge files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'knowledge-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Service role can access all files (for Edge Functions)
CREATE POLICY "Service role can access all knowledge files"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'knowledge-files' 
  AND auth.role() = 'service_role'
);

-- ============================================
-- knowledge_refs / memory_refs に重複防止用の unique 制約を追加
-- ============================================

-- memory_refs: 同一 conversation + assistant_message + memory の重複防止
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'memory_refs_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX memory_refs_unique_idx 
    ON public.memory_refs (conversation_id, assistant_message_id, memory_id)
    WHERE assistant_message_id IS NOT NULL;
  END IF;
END $$;

-- knowledge_refs: 同一 conversation + assistant_message + chunk の重複防止
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'knowledge_refs_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX knowledge_refs_unique_idx 
    ON public.knowledge_refs (conversation_id, assistant_message_id, chunk_id)
    WHERE assistant_message_id IS NOT NULL;
  END IF;
END $$;