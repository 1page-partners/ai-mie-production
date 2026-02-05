import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type KnowledgeSource = Tables<"knowledge_sources">;
export type KnowledgeChunk = Tables<"knowledge_chunks">;

export interface NotionSourceInput {
  name: string;
  pageId: string;
  accessToken: string;
}
 
 export interface GDriveSourceInput {
   name: string;
   fileId: string;
   accessToken: string;
 }

export const knowledgeService = {
  async listSources() {
    const { data, error } = await supabase
      .from("knowledge_sources")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async addNotionSource(input: NotionSourceInput): Promise<KnowledgeSource> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    // Extract page ID from URL if needed
    let pageId = input.pageId.trim();
    const urlMatch = pageId.match(/([a-f0-9]{32})/i);
    if (urlMatch) {
      pageId = urlMatch[1];
    }
    // Format with dashes if needed
    if (pageId.length === 32 && !pageId.includes("-")) {
      pageId = `${pageId.slice(0, 8)}-${pageId.slice(8, 12)}-${pageId.slice(12, 16)}-${pageId.slice(16, 20)}-${pageId.slice(20)}`;
    }

    const { data: source, error: insertError } = await supabase
      .from("knowledge_sources")
      .insert({
        user_id: userId,
        name: input.name,
        type: "notion",
        status: "pending",
        external_id_or_path: pageId,
        meta: { access_token: input.accessToken },
      })
      .select()
      .single();
    if (insertError) throw insertError;

    // Trigger notion-sync function
    try {
      await supabase.functions.invoke("notion-sync", {
        body: { sourceId: source.id },
      });
    } catch (e) {
      console.error("notion-sync invocation failed:", e);
    }

    return source;
  },
 
   async addGDriveSource(input: GDriveSourceInput): Promise<KnowledgeSource> {
     const { data: userData } = await supabase.auth.getUser();
     const userId = userData?.user?.id;
     if (!userId) throw new Error("Not authenticated");
 
     // Extract file ID from URL if needed
     let fileId = input.fileId.trim();
     // Match patterns like /file/d/{id}/ or /document/d/{id}/ or /spreadsheets/d/{id}/
     const urlMatch = fileId.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
     if (urlMatch) {
       fileId = urlMatch[1];
     }
 
     const { data: source, error: insertError } = await supabase
       .from("knowledge_sources")
       .insert({
         user_id: userId,
         name: input.name,
         type: "gdrive",
         status: "pending",
         external_id_or_path: fileId,
         meta: { access_token: input.accessToken },
       })
       .select()
       .single();
     if (insertError) throw insertError;
 
     // Trigger gdrive-sync function
     try {
       await supabase.functions.invoke("gdrive-sync", {
         body: { sourceId: source.id },
       });
     } catch (e) {
       console.error("gdrive-sync invocation failed:", e);
     }
 
     return source;
   },

  async getSource(sourceId: string) {
    const { data, error } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async uploadPdf(file: File): Promise<KnowledgeSource> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    // Upload to storage
    const filePath = `${userId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("knowledge-files")
      .upload(filePath, file, { contentType: "application/pdf" });
    if (uploadError) throw uploadError;

    // Create knowledge_source record
    const { data: source, error: insertError } = await supabase
      .from("knowledge_sources")
      .insert({
        user_id: userId,
        name: file.name,
        type: "pdf",
        status: "pending",
        external_id_or_path: filePath,
        meta: { original_name: file.name, size: file.size },
      })
      .select()
      .single();
    if (insertError) throw insertError;

    // Trigger pdf-ingest function
    try {
      await supabase.functions.invoke("pdf-ingest", {
        body: { sourceId: source.id },
      });
    } catch (e) {
      console.error("pdf-ingest invocation failed:", e);
      // Don't throw; the status will show error eventually
    }

    return source;
  },

  async syncSource(sourceId: string): Promise<void> {
    const source = await this.getSource(sourceId);
    if (!source) throw new Error("Source not found");

    let functionName: string;
    switch (source.type) {
      case "pdf":
        functionName = "pdf-ingest";
        break;
      case "gdocs":
        functionName = "gdocs-sync";
        break;
       case "gdrive":
         functionName = "gdrive-sync";
         break;
      case "notion":
        functionName = "notion-sync";
        break;
      default:
        throw new Error(`Unknown source type: ${source.type}`);
    }

    await supabase.functions.invoke(functionName, {
      body: { sourceId },
    });
  },

  async searchChunks(query: string, limit = 10) {
    if (!query.trim()) return [];

    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("*, knowledge_sources!inner(name, status, project_id)")
      .ilike("content", `%${query}%`)
      .eq("knowledge_sources.status", "ready")
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },

  async getMissingEmbeddingsCount(): Promise<number> {
    const { count, error } = await supabase
      .from("knowledge_chunks")
      .select("*", { count: "exact", head: true })
      .is("embedding", null);
    if (error) return 0;
    return count ?? 0;
  },

  async fillMissingEmbeddings(
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<{ success: number; failed: number }> {
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("id, content")
      .is("embedding", null)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error || !data) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;
    const total = data.length;

    for (const chunk of data) {
      if (signal?.aborted) break;

      try {
        const { data: embedData, error: embedError } = await supabase.functions.invoke("openai-embed", {
          body: { text: chunk.content },
        });
        if (embedError || !embedData?.embedding) {
          failed++;
        } else {
          const embeddingStr = `[${embedData.embedding.join(",")}]`;
          const { error: updateError } = await supabase
            .from("knowledge_chunks")
            .update({ embedding: embeddingStr as any })
            .eq("id", chunk.id);
          if (!updateError) {
            success++;
          } else {
            failed++;
          }
        }
      } catch {
        failed++;
      }
      onProgress?.(success + failed, total);

      // Rate limit
      await new Promise((r) => setTimeout(r, 200));
    }

    return { success, failed };
  },

  async getErrorSources(): Promise<KnowledgeSource[]> {
    const { data, error } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("status", "error")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
