import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Memory = Tables<"memories">;
export type KnowledgeChunk = Tables<"knowledge_chunks"> & { source_name?: string };

export const contextService = {
  /**
   * Search memories using ILIKE (keyword fallback).
   * Vector search is done server-side in openai-chat.
   * Only approved memories are returned for RAG.
   */
  async searchMemories(input: {
    queryText: string;
    limit?: number;
    projectId?: string | null;
  }) {
    const q = input.queryText.trim();
    if (!q) return [] as Memory[];

    // Use multiple search strategies: title OR content match
    // Only approved and active memories are searched
    let query = supabase
      .from("memories")
      .select("*")
      .eq("is_active", true)
      .eq("status", "approved")
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .order("pinned", { ascending: false })
      .order("confidence", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 8);

    if (input.projectId) query = query.eq("project_id", input.projectId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Search knowledge chunks using ILIKE (keyword fallback).
   * Vector search is done server-side in openai-chat.
   */
  async searchKnowledge(input: {
    queryText: string;
    limit?: number;
    projectId?: string | null;
  }) {
    const q = input.queryText.trim();
    if (!q) return [] as KnowledgeChunk[];

    // Inner join ensures RLS + status filter via knowledge_sources
    let query = supabase
      .from("knowledge_chunks")
      .select("*, knowledge_sources!inner(name,status,project_id)")
      .ilike("content", `%${q}%`)
      .eq("knowledge_sources.status", "ready")
      .limit(input.limit ?? 6);

    if (input.projectId) query = query.eq("knowledge_sources.project_id", input.projectId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      ...c,
      source_name: c.knowledge_sources?.name,
    }));
  },

  /**
   * Fallback search when vector search fails or returns empty.
   * Combines memory and knowledge results.
   */
  async fallbackSearch(input: {
    queryText: string;
    memoryLimit?: number;
    knowledgeLimit?: number;
    projectId?: string | null;
  }) {
    const [memories, knowledge] = await Promise.all([
      this.searchMemories({
        queryText: input.queryText,
        limit: input.memoryLimit ?? 8,
        projectId: input.projectId,
      }),
      this.searchKnowledge({
        queryText: input.queryText,
        limit: input.knowledgeLimit ?? 6,
        projectId: input.projectId,
      }),
    ]);
    return { memories, knowledge };
  },
};
