/// <reference lib="deno.unstable" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunkEnd = end;
    
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastPeriod > start + chunkSize / 2) {
        chunkEnd = lastPeriod + 1;
      } else if (lastSpace > start + chunkSize / 2) {
        chunkEnd = lastSpace;
      }
    }
    
    const chunk = text.slice(start, chunkEnd).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    start = chunkEnd - overlap;
    if (start < 0) start = 0;
    if (chunkEnd >= text.length) break;
  }
  
  return chunks;
}

async function generateEmbedding(text: string, openaiKey: string): Promise<number[] | null> {
  const model = Deno.env.get("OPENAI_MODEL_EMBED") ?? "text-embedding-3-small";
  
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({ model, input: text }),
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// Extract text from Notion blocks
function extractTextFromBlocks(blocks: any[]): string {
  let text = "";
  
  for (const block of blocks) {
    const type = block.type;
    const content = block[type];
    
    if (!content) continue;
    
    // Handle rich_text arrays
    if (content.rich_text) {
      for (const rt of content.rich_text) {
        text += rt.plain_text || "";
      }
      text += "\n";
    }
    
    // Handle title (for pages)
    if (content.title) {
      for (const t of content.title) {
        text += t.plain_text || "";
      }
      text += "\n";
    }
    
    // Handle children recursively
    if (block.children) {
      text += extractTextFromBlocks(block.children);
    }
  }
  
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    return jsonResponse({ error: "Missing configuration" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: { sourceId: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const sourceId = body?.sourceId;
  if (!sourceId) {
    return jsonResponse({ error: "sourceId is required" }, 400);
  }

  try {
    const { data: source, error: sourceError } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      return jsonResponse({ error: "Source not found" }, 404);
    }

    if (source.type !== "notion") {
      return jsonResponse({ error: "Source is not a Notion type" }, 400);
    }

    const meta = source.meta as Record<string, unknown>;
    const accessToken = meta?.access_token as string | undefined;
    const pageId = source.external_id_or_path;

    if (!accessToken) {
      await supabase
        .from("knowledge_sources")
        .update({
          status: "error",
          meta: { ...meta, error: "No access_token found in meta. Please reconnect Notion." },
        })
        .eq("id", sourceId);
      return jsonResponse({ error: "No access token available" }, 400);
    }

    if (!pageId) {
      await supabase
        .from("knowledge_sources")
        .update({
          status: "error",
          meta: { ...meta, error: "No page ID found" },
        })
        .eq("id", sourceId);
      return jsonResponse({ error: "No page ID" }, 400);
    }

    // Update status to processing
    await supabase
      .from("knowledge_sources")
      .update({ status: "processing" })
      .eq("id", sourceId);

    // Fetch page blocks from Notion API
    const blocksUrl = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
    const blocksRes = await fetch(blocksUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    });

    if (!blocksRes.ok) {
      const errText = await blocksRes.text();
      throw new Error(`Notion API error (${blocksRes.status}): ${errText}`);
    }

    const blocksData = await blocksRes.json();
    const blocks = blocksData.results || [];

    // Also fetch page properties for title
    const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    });
    
    let pageTitle = source.name;
    if (pageRes.ok) {
      const pageData = await pageRes.json();
      const titleProp = pageData.properties?.title || pageData.properties?.Name;
      if (titleProp?.title?.[0]?.plain_text) {
        pageTitle = titleProp.title[0].plain_text;
      }
    }

    // Extract text
    const fullText = extractTextFromBlocks(blocks);

    if (!fullText.trim()) {
      throw new Error("No text content found in Notion page");
    }

    // Chunk the text
    const chunks = chunkText(fullText.trim());
    console.log(`Extracted ${chunks.length} chunks from Notion page`);

    // Delete existing chunks
    await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("source_id", sourceId);

    // Insert chunks with embeddings
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk, OPENAI_API_KEY);
      const embeddingStr = embedding ? `[${embedding.join(",")}]` : null;
      
      const { error: insertError } = await supabase
        .from("knowledge_chunks")
        .insert({
          source_id: sourceId,
          chunk_index: i,
          content: chunk,
          embedding: embeddingStr,
          meta: {},
        });

      if (insertError) {
        failCount++;
      } else {
        successCount++;
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    // Update source status
    const finalStatus = failCount === chunks.length ? "error" : "ready";
    await supabase
      .from("knowledge_sources")
      .update({
        status: finalStatus,
        last_synced_at: new Date().toISOString(),
        meta: {
          ...meta,
          title: pageTitle,
          chunks_count: successCount,
          chunks_failed: failCount,
        },
      })
      .eq("id", sourceId);

    return jsonResponse({
      success: true,
      sourceId,
      title: pageTitle,
      chunksCreated: successCount,
      chunksFailed: failCount,
    });

  } catch (e) {
    console.error("notion-sync error:", e);
    
    await supabase
      .from("knowledge_sources")
      .update({
        status: "error",
        meta: { error: String(e) },
      })
      .eq("id", sourceId);

    return jsonResponse({ error: String(e) }, 500);
  }
});
