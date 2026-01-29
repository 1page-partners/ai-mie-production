import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Memory = Tables<"memories">;

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

type MemoryType = "fact" | "preference" | "procedure" | "goal" | "context";

export const memoryService = {
  async list(options?: {
    typeFilter?: MemoryType | "all";
    pinnedFilter?: boolean | null;
    activeFilter?: boolean | null;
  }) {
    let query = supabase.from("memories").select("*").order("updated_at", { ascending: false });

    if (options?.typeFilter && options.typeFilter !== "all") {
      query = query.eq("type", options.typeFilter as MemoryType);
    }
    if (options?.pinnedFilter !== undefined && options?.pinnedFilter !== null) {
      query = query.eq("pinned", options.pinnedFilter);
    }
    if (options?.activeFilter !== undefined && options?.activeFilter !== null) {
      query = query.eq("is_active", options.activeFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
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
    return { memory: updated ?? data, embeddingSuccess };
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
    return { memory: updated ?? data, embeddingSuccess };
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
