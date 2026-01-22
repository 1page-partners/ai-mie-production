import { supabase } from "@/integrations/supabase/client";

export const refsService = {
  async saveMemoryRefs(input: {
    conversationId: string;
    assistantMessageId: string;
    memories: { id: string; score?: number | null }[];
  }) {
    if (!input.memories.length) return;
    const { error } = await supabase.from("memory_refs").insert(
      input.memories.map((m) => ({
        conversation_id: input.conversationId,
        memory_id: m.id,
        assistant_message_id: input.assistantMessageId,
        score: m.score ?? null,
      })),
    );
    if (error) throw error;
  },

  async saveKnowledgeRefs(input: {
    conversationId: string;
    assistantMessageId: string;
    chunks: { id: string; score?: number | null }[];
  }) {
    if (!input.chunks.length) return;
    const { error } = await supabase.from("knowledge_refs").insert(
      input.chunks.map((c) => ({
        conversation_id: input.conversationId,
        chunk_id: c.id,
        assistant_message_id: input.assistantMessageId,
        score: c.score ?? null,
      })),
    );
    if (error) throw error;
  },
};
