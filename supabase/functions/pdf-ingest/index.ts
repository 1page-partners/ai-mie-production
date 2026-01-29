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

// Simple text extraction from PDF (basic approach)
// For production, consider using a proper PDF parsing library
function extractTextFromPdf(pdfBytes: Uint8Array): string {
  // Convert bytes to string and look for text streams
  const decoder = new TextDecoder("latin1");
  const content = decoder.decode(pdfBytes);
  
  const textParts: string[] = [];
  
  // Extract text from PDF streams (simplified approach)
  // Look for BT...ET blocks (Begin Text / End Text)
  const textBlockRegex = /BT[\s\S]*?ET/g;
  const matches = content.match(textBlockRegex) || [];
  
  for (const block of matches) {
    // Extract text from Tj and TJ operators
    const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || [];
    for (const tj of tjMatches) {
      const text = tj.match(/\(([^)]*)\)/)?.[1] || "";
      if (text.trim()) {
        textParts.push(text);
      }
    }
    
    // TJ arrays
    const tjArrayMatches = block.match(/\[([^\]]*)\]\s*TJ/g) || [];
    for (const tja of tjArrayMatches) {
      const innerMatches = tja.match(/\(([^)]*)\)/g) || [];
      for (const inner of innerMatches) {
        const text = inner.slice(1, -1);
        if (text.trim()) {
          textParts.push(text);
        }
      }
    }
  }
  
  // Also try to find readable ASCII strings
  const asciiTextRegex = /[\x20-\x7E]{20,}/g;
  const asciiMatches = content.match(asciiTextRegex) || [];
  for (const ascii of asciiMatches) {
    // Filter out obviously non-text content
    if (!ascii.includes("stream") && !ascii.includes("endobj") && !ascii.includes("xref")) {
      textParts.push(ascii);
    }
  }
  
  const fullText = textParts.join(" ").replace(/\s+/g, " ").trim();
  return fullText || "(PDF text extraction produced no content - PDF may be image-based or encrypted)";
}

// Split text into chunks with overlap
function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunkEnd = end;
    
    // Try to break at sentence or word boundary
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
    
    if (!res.ok) {
      console.error("Embedding API error:", await res.text());
      return null;
    }
    
    const data = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("Embedding generation error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing Supabase config" }, 500);
  }
  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: "Missing OPENAI_API_KEY" }, 500);
  }

  // Use service role for background processing
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
    // Get the knowledge source
    const { data: source, error: sourceError } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      return jsonResponse({ error: "Source not found" }, 404);
    }

    // Update status to processing
    await supabase
      .from("knowledge_sources")
      .update({ status: "processing" })
      .eq("id", sourceId);

    // Download PDF from storage
    const storagePath = source.external_id_or_path;
    if (!storagePath) {
      throw new Error("No storage path found for this source");
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("knowledge-files")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`);
    }

    // Extract text from PDF
    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
    const extractedText = extractTextFromPdf(pdfBytes);

    if (!extractedText || extractedText.length < 10) {
      throw new Error("No text could be extracted from PDF");
    }

    // Chunk the text
    const chunks = chunkText(extractedText);
    console.log(`Extracted ${chunks.length} chunks from PDF`);

    // Delete existing chunks for this source (for re-sync)
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
          meta: { page_estimate: Math.floor(i / 3) + 1 },
        });

      if (insertError) {
        console.error(`Failed to insert chunk ${i}:`, insertError);
        failCount++;
      } else {
        successCount++;
      }

      // Rate limit
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
          ...(source.meta as object),
          chunks_count: successCount,
          chunks_failed: failCount,
          extracted_chars: extractedText.length,
        },
      })
      .eq("id", sourceId);

    return jsonResponse({
      success: true,
      sourceId,
      chunksCreated: successCount,
      chunksFailed: failCount,
    });

  } catch (e) {
    console.error("pdf-ingest error:", e);
    
    // Update source with error
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
