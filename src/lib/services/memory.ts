import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// Base memory type from DB - status/reviewed_at/rejected_reason are now columns
type DbMemory = Tables<"memories">;

// Export with proper status typing
export type Memory = Omit<DbMemory, "status" | "reviewed_at" | "rejected_reason"> & {
  status: "candidate" | "approved" | "rejected";
  reviewed_at: string | null;
  rejected_reason: string | null;
};

export type MemoryStatus = "candidate" | "approved" | "rejected";
export type MemoryType = "fact" | "preference" | "procedure" | "goal" | "context";

async function generateEmbedding(text: string): Promise<number[] | null> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return null;

  try {
    const { data, error } = await supabase.functions.invoke("openai-embed", {
      body: { text },
    });
    if (error) {
      console.error("Embedding generation failed:", error);
      return null;
    }
    return data?.embedding ?? null;
  } catch (e) {
    console.error("Embedding generation exception:", e);
    return null;
  }
}

function embeddingToPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export const memoryService = {
  async list(options?: {
    statusFilter?: MemoryStatus | "all";
    typeFilter?: MemoryType | "all";
    pinnedFilter?: boolean | null;
    activeFilter?: boolean | null;
  }) {
    let query = supabase.from("memories").select("*").order("updated_at", { ascending: false });

    // Status filter (default: approved for backward compatibility)
    if (options?.statusFilter && options.statusFilter !== "all") {
      query = query.eq("status", options.statusFilter);
    }
    if (options?.typeFilter && options.typeFilter !== "all") {
      query = query.eq("type", options.typeFilter);
    }
    if (options?.pinnedFilter !== undefined && options?.pinnedFilter !== null) {
      query = query.eq("pinned", options.pinnedFilter);
    }
    if (options?.activeFilter !== undefined && options?.activeFilter !== null) {
      query = query.eq("is_active", options.activeFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Memory[];
  },

  async getCandidateCount(): Promise<number> {
    const { count, error } = await supabase
      .from("memories")
      .select("*", { count: "exact", head: true })
      .eq("status", "candidate");
    if (error) return 0;
    return count ?? 0;
  },

  async approve(id: string, updates?: { title?: string; content?: string; type?: MemoryType; confidence?: number }): Promise<Memory> {
    const updatePayload: Record<string, unknown> = {
      status: "approved",
      reviewed_at: new Date().toISOString(),
    };
    if (updates?.title !== undefined) updatePayload.title = updates.title;
    if (updates?.content !== undefined) updatePayload.content = updates.content;
    if (updates?.type !== undefined) updatePayload.type = updates.type;
    if (updates?.confidence !== undefined) updatePayload.confidence = updates.confidence;

    const { data, error } = await supabase
      .from("memories")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    // Re-generate embedding if title/content changed
    if (updates?.title !== undefined || updates?.content !== undefined) {
      const text = `${data.title}\n\n${data.content}`;
      const embedding = await generateEmbedding(text);
      if (embedding) {
      await supabase
          .from("memories")
          .update({ embedding: embeddingToPgVector(embedding) as any })
          .eq("id", id);
      }
    }

    const { data: updated } = await supabase.from("memories").select("*").eq("id", id).single();
    return (updated ?? data) as Memory;
  },

  async reject(id: string, reason?: string): Promise<Memory> {
    const { data, error } = await supabase
      .from("memories")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        rejected_reason: reason ?? null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Memory;
  },

  async bulkRejectLowConfidence(threshold: number = 0.55): Promise<number> {
    const { data, error } = await supabase
      .from("memories")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        rejected_reason: `Auto-rejected: confidence < ${threshold}`,
      })
      .eq("status", "candidate")
      .lt("confidence", threshold)
      .select();
    if (error) throw error;
    return data?.length ?? 0;
  },

  async create(memory: Omit<TablesInsert<"memories">, "user_id">): Promise<{ memory: Memory; embeddingSuccess: boolean }> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    // Insert memory first
    const { data, error } = await supabase
      .from("memories")
      .insert({ ...memory, user_id: userId })
      .select()
      .single();
    if (error) throw error;

    // Generate embedding asynchronously
    const text = `${memory.title}\n\n${memory.content}`;
    const embedding = await generateEmbedding(text);
    
    let embeddingSuccess = false;
    if (embedding) {
      const { error: updateError } = await supabase
        .from("memories")
        .update({ embedding: embeddingToPgVector(embedding) as any })
        .eq("id", data.id);
      embeddingSuccess = !updateError;
      if (updateError) {
        console.error("Failed to save embedding:", updateError);
      }
    }

    // Fetch the updated record
    const { data: updated } = await supabase.from("memories").select("*").eq("id", data.id).single();
    return { memory: (updated ?? data) as unknown as Memory, embeddingSuccess };
  },

  async update(id: string, updates: TablesUpdate<"memories">): Promise<{ memory: Memory; embeddingSuccess: boolean }> {
    const { data, error } = await supabase
      .from("memories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    // Re-generate embedding if title or content changed
    let embeddingSuccess = true;
    if (updates.title !== undefined || updates.content !== undefined) {
      const text = `${data.title}\n\n${data.content}`;
      const embedding = await generateEmbedding(text);
      if (embedding) {
        const { error: updateError } = await supabase
          .from("memories")
          .update({ embedding: embeddingToPgVector(embedding) as any })
          .eq("id", id);
        embeddingSuccess = !updateError;
      } else {
        embeddingSuccess = false;
      }
    }

    const { data: updated } = await supabase.from("memories").select("*").eq("id", id).single();
    return { memory: (updated ?? data) as unknown as Memory, embeddingSuccess };
  },

  async regenerateEmbedding(id: string): Promise<boolean> {
    const { data, error } = await supabase.from("memories").select("title, content").eq("id", id).single();
    if (error || !data) return false;

    const text = `${data.title}\n\n${data.content}`;
    const embedding = await generateEmbedding(text);
    if (!embedding) return false;

    const { error: updateError } = await supabase
      .from("memories")
      .update({ embedding: embeddingToPgVector(embedding) as any })
      .eq("id", id);
    return !updateError;
  },

  async getMissingEmbeddingsCount(): Promise<number> {
    const { count, error } = await supabase
      .from("memories")
      .select("*", { count: "exact", head: true })
      .is("embedding", null)
      .eq("is_active", true);
    if (error) return 0;
    return count ?? 0;
  },

  async fillMissingEmbeddings(
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<{ success: number; failed: number }> {
    const { data, error } = await supabase
      .from("memories")
      .select("id, title, content")
      .is("embedding", null)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error || !data) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;
    const total = data.length;

    for (const memory of data) {
      if (signal?.aborted) break;

      const text = `${memory.title}\n\n${memory.content}`;
      const embedding = await generateEmbedding(text);
      if (embedding) {
        const { error: updateError } = await supabase
          .from("memories")
          .update({ embedding: embeddingToPgVector(embedding) as any })
          .eq("id", memory.id);
        if (!updateError) {
          success++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
      onProgress?.(success + failed, total);

      // Rate limit: wait 200ms between requests
      await new Promise((r) => setTimeout(r, 200));
    }

    return { success, failed };
  },
};
