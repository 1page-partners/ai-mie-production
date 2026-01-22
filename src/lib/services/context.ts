import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Memory = Tables<"memories">;
export type KnowledgeChunk = Tables<"knowledge_chunks"> & { source_name?: string };

export const contextService = {
  async searchMemories(input: {
    queryText: string;
    limit?: number;
    projectId?: string | null;
  }) {
    const q = input.queryText.trim();
    if (!q) return [] as Memory[];

    let query = supabase
      .from("memories")
      .select("*")
      .eq("is_active", true)
      .ilike("content", `%${q}%`)
      .order("pinned", { ascending: false })
      .order("confidence", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 8);

    if (input.projectId) query = query.eq("project_id", input.projectId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async searchKnowledge(input: {
    queryText: string;
    limit?: number;
    projectId?: string | null;
  }) {
    const q = input.queryText.trim();
    if (!q) return [] as KnowledgeChunk[];

    // NOTE: Inner join ensures RLS + status filter via knowledge_sources
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
};
