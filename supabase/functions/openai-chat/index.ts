/// <reference lib="deno.unstable" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

type ChatRequest = {
  conversationId: string;
  userText: string;
  projectId?: string | null;
  clientMessageId?: string | null;
};

type MemoryRow = {
  id: string;
  type: string;
  title: string;
  content: string;
  confidence: number;
  pinned: boolean;
  updated_at: string;
};

type KnowledgeMatchRow = {
  chunk_id: string;
  source_id: string;
  source_name: string;
  content: string;
  meta: unknown;
  score: number;
};

type SSEEvent =
  | { type: "delta"; delta: string }
  | {
      type: "final";
      assistantText: string;
      assistantMessageId: string;
      usedMemories: Array<MemoryRow & { score: number | null }>;
      usedKnowledge: Array<{ id: string; source_name: string; chunk_index: number; content: string; meta: unknown; score: number | null }>;
    }
  | { type: "error"; message: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sseHeaders() {
  return {
    ...corsHeaders,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

function writeSse(controller: ReadableStreamDefaultController, data: SSEEvent) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

function extractTrailingRefJson(text: string): {
  cleaned: string;
  memoryIds: string[];
  chunkIds: string[];
} {
  const trimmed = text.trim();
  // 末尾にある {"memory_ids":[],"knowledge_chunk_ids":[]} を抽出
  const m = trimmed.match(/\{\s*"memory_ids"\s*:\s*\[[^\]]*\]\s*,\s*"knowledge_chunk_ids"\s*:\s*\[[^\]]*\]\s*\}\s*$/);
  if (!m) return { cleaned: trimmed, memoryIds: [], chunkIds: [] };
  try {
    const json = JSON.parse(m[0]);
    const memoryIds = Array.isArray(json.memory_ids)
      ? json.memory_ids.filter((x: unknown) => typeof x === "string")
      : [];
    const chunkIds = Array.isArray(json.knowledge_chunk_ids)
      ? json.knowledge_chunk_ids.filter((x: unknown) => typeof x === "string")
      : [];
    return {
      cleaned: trimmed.slice(0, trimmed.length - m[0].length).trim(),
      memoryIds,
      chunkIds,
    };
  } catch {
    return { cleaned: trimmed, memoryIds: [], chunkIds: [] };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

function embeddingToPgVectorString(embedding: number[]) {
  // PostgRESTがvectorにキャストできる形式: "[0.1,0.2,...]"
  return `[${embedding.join(",")}]`;
}

function buildSystemPrompt(input: {
  memories: Array<MemoryRow & { score: number | null }>;
  knowledge: Array<{ id: string; source_name: string; chunk_index: number; content: string; meta: unknown; score: number | null }>;
}) {
  const memoryLines = input.memories
    .map(
      (m) =>
        `- (id:${m.id} score:${m.score ?? "null"} pinned:${m.pinned} confidence:${m.confidence}) title:${m.title} / content:${m.content}`,
    )
    .join("\n");

  const knowledgeLines = input.knowledge
    .map(
      (k) =>
        `- (chunk_id:${k.id} score:${k.score ?? "null"} source:${k.source_name} meta:${JSON.stringify(k.meta ?? {})}) content:${k.content}`,
    )
    .join("\n");

  return `[
CONTEXT]

## MEMORY（長期記憶：優先）
${memoryLines || "- (none)"}

## KNOWLEDGE（資料/マニュアル）
${knowledgeLines || "- (none)"}

## RULES
- 可能な限り MEMORY/KNOWLEDGE を根拠に回答する
- 不明なら不明と言う
- 回答末尾に参照IDをJSONで必ず付与する：\n  {"memory_ids":[...],"knowledge_chunk_ids":[...]}

[/CONTEXT]`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const OPENAI_MODEL_CHAT = Deno.env.get("OPENAI_MODEL_CHAT") ?? "gpt-4.1-mini";
  const OPENAI_MODEL_EMBED = Deno.env.get("OPENAI_MODEL_EMBED") ?? "text-embedding-3-small";
  const EMBED_DIM = Number(Deno.env.get("EMBED_DIM") ?? "1536");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Missing SUPABASE_URL/SUPABASE_ANON_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!Number.isFinite(EMBED_DIM) || EMBED_DIM <= 0) {
    return new Response(JSON.stringify({ error: "Invalid EMBED_DIM" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing Authorization token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userRes.user.id;

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const conversationId = (body?.conversationId ?? "").trim();
  const userText = (body?.userText ?? "").trim();
  const projectId = body?.projectId ?? null;
  if (!conversationId || !userText) {
    return new Response(JSON.stringify({ error: "conversationId and userText are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    start: async (controller) => {
      try {
        // 1) user message を保存
        const { data: userMsg, error: userMsgErr } = await supabase
          .from("conversation_messages")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "user",
            content: userText,
            meta: {},
          })
          .select()
          .single();
        if (userMsgErr) throw userMsgErr;

        // 2) embedding生成
        const embedRes = await fetchWithTimeout(
          "https://api.openai.com/v1/embeddings",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({ model: OPENAI_MODEL_EMBED, input: userText }),
          },
          60_000,
        );
        const embedRaw = await embedRes.text();
        if (!embedRes.ok) throw new Error(`OpenAI embeddings failed (${embedRes.status}): ${embedRaw}`);
        const embedJson = JSON.parse(embedRaw);
        const embedding = embedJson?.data?.[0]?.embedding as number[] | undefined;
        if (!Array.isArray(embedding)) throw new Error("Invalid embeddings response");
        if (embedding.length !== EMBED_DIM) {
          throw new Error(`Embedding dimension mismatch: expected ${EMBED_DIM}, got ${embedding.length}`);
        }
        const embeddingStr = embeddingToPgVectorString(embedding);

        // 3) Supabaseからコンテキスト取得（毎ターン必ず）
        // まずRPC（vector検索）を試し、失敗したらLIKEフォールバック
        let memoryMatches: Array<MemoryRow & { score: number | null }> = [];
        let knowledgeMatches: Array<{ id: string; source_name: string; chunk_index: number; content: string; meta: unknown; score: number | null }> = [];

        const memRpc = await supabase.rpc("match_memories", {
          query_embedding: embeddingStr,
          match_count: 8,
          p_user_id: userId,
          p_project_id: projectId,
          min_confidence: 0.0,
        });

        if (!memRpc.error && Array.isArray(memRpc.data)) {
          memoryMatches = memRpc.data.map((r: any) => ({
            id: String(r.id),
            type: String(r.type),
            title: String(r.title ?? ""),
            content: String(r.content ?? ""),
            confidence: Number(r.confidence ?? 0),
            pinned: Boolean(r.pinned),
            updated_at: String(r.updated_at ?? ""),
            score: typeof r.score === "number" ? r.score : null,
          }));
        } else {
          // LIKE fallback
          let q = supabase
            .from("memories")
            .select("id,type,title,content,confidence,pinned,updated_at")
            .eq("is_active", true)
            .ilike("content", `%${userText}%`)
            .order("pinned", { ascending: false })
            .order("confidence", { ascending: false })
            .order("updated_at", { ascending: false })
            .limit(8);
          if (projectId) q = q.eq("project_id", projectId);
          const { data, error } = await q;
          if (error) throw error;
          memoryMatches = (data ?? []).map((r: any) => ({ ...r, score: null }));
        }

        const knowRpc = await supabase.rpc("match_knowledge", {
          query_embedding: embeddingStr,
          match_count: 6,
          p_user_id: userId,
          p_project_id: projectId,
        });

        if (!knowRpc.error && Array.isArray(knowRpc.data)) {
          const ids = knowRpc.data.map((r: KnowledgeMatchRow) => r.chunk_id);
          // chunk_index/meta等はknowledge_chunksから取る
          const { data: chunks, error: chunksErr } = await supabase
            .from("knowledge_chunks")
            .select("id,chunk_index,content,meta, knowledge_sources!inner(name,status,project_id)")
            .in("id", ids)
            .eq("knowledge_sources.status", "ready");
          if (chunksErr) throw chunksErr;

          const scoreMap = new Map<string, number>();
          for (const r of knowRpc.data as any[]) {
            scoreMap.set(String(r.chunk_id), typeof r.score === "number" ? r.score : 0);
          }
          knowledgeMatches = (chunks ?? []).map((c: any) => ({
            id: String(c.id),
            source_name: String(c.knowledge_sources?.name ?? "Unknown Source"),
            chunk_index: Number(c.chunk_index ?? 0),
            content: String(c.content ?? ""),
            meta: c.meta ?? {},
            score: scoreMap.has(String(c.id)) ? scoreMap.get(String(c.id))! : null,
          }));
        } else {
          // LIKE fallback
          let q = supabase
            .from("knowledge_chunks")
            .select("id,chunk_index,content,meta, knowledge_sources!inner(name,status,project_id)")
            .ilike("content", `%${userText}%`)
            .eq("knowledge_sources.status", "ready")
            .limit(6);
          if (projectId) q = q.eq("knowledge_sources.project_id", projectId);
          const { data, error } = await q;
          if (error) throw error;
          knowledgeMatches = (data ?? []).map((c: any) => ({
            id: String(c.id),
            source_name: String(c.knowledge_sources?.name ?? "Unknown Source"),
            chunk_index: Number(c.chunk_index ?? 0),
            content: String(c.content ?? ""),
            meta: c.meta ?? {},
            score: null,
          }));
        }

        // 4) history（直近N件）
        const { data: historyRows, error: histErr } = await supabase
          .from("conversation_messages")
          .select("role,content,created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (histErr) throw histErr;
        const history = (historyRows ?? [])
          .slice()
          .reverse()
          .map((m: any) => ({ role: m.role, content: m.content }));

        // 5) OpenAIに送るmessages構築
        const system = buildSystemPrompt({ memories: memoryMatches, knowledge: knowledgeMatches });

        const openaiReq = {
          model: OPENAI_MODEL_CHAT,
          stream: true,
          messages: [
            { role: "system", content: system },
            ...history,
            { role: "user", content: userText },
          ],
        };

        const openaiRes = await fetchWithTimeout(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify(openaiReq),
          },
          120_000,
        );

        if (!openaiRes.ok || !openaiRes.body) {
          const raw = await openaiRes.text();
          throw new Error(`OpenAI chat failed (${openaiRes.status}): ${raw}`);
        }

        // OpenAI SSEを読み取りつつ、クライアントへdeltaを転送
        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const data = line.slice("data:".length).trim();
            if (!data) continue;
            if (data === "[DONE]") continue;

            let parsed: any;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) {
              fullText += delta;
              writeSse(controller, { type: "delta", delta });
            }
          }
        }

        const extracted = extractTrailingRefJson(fullText);
        const fallbackMemoryIds = memoryMatches.map((m) => m.id);
        const fallbackChunkIds = knowledgeMatches.map((k) => k.id);

        const usedMemoryIds = extracted.memoryIds.length ? extracted.memoryIds : fallbackMemoryIds;
        const usedChunkIds = extracted.chunkIds.length ? extracted.chunkIds : fallbackChunkIds;

        // 6) assistant message 保存
        const { data: assistantMsg, error: assistantErr } = await supabase
          .from("conversation_messages")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "assistant",
            content: extracted.cleaned,
            meta: {
              model: OPENAI_MODEL_CHAT,
              memory_ids: usedMemoryIds,
              knowledge_chunk_ids: usedChunkIds,
            },
          })
          .select()
          .single();
        if (assistantErr) throw assistantErr;

        // 7) 参照ログ保存
        if (usedMemoryIds.length) {
          const rows = usedMemoryIds.map((id) => ({
            conversation_id: conversationId,
            assistant_message_id: assistantMsg.id,
            memory_id: id,
            score: null,
          }));
          const { error } = await supabase.from("memory_refs").insert(rows);
          if (error) throw error;
        }
        if (usedChunkIds.length) {
          const rows = usedChunkIds.map((id) => ({
            conversation_id: conversationId,
            assistant_message_id: assistantMsg.id,
            chunk_id: id,
            score: null,
          }));
          const { error } = await supabase.from("knowledge_refs").insert(rows);
          if (error) throw error;
        }

        const usedMemories = memoryMatches
          .filter((m) => usedMemoryIds.includes(m.id))
          .map((m) => ({ ...m, score: m.score ?? null }));
        const usedKnowledge = knowledgeMatches
          .filter((k) => usedChunkIds.includes(k.id))
          .map((k) => ({ ...k, score: k.score ?? null }));

        writeSse(controller, {
          type: "final",
          assistantText: extracted.cleaned,
          assistantMessageId: assistantMsg.id,
          usedMemories,
          usedKnowledge,
        });
      } catch (e) {
        try {
          writeSse(controller, { type: "error", message: String(e) });
        } catch {
          // ignore
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
});
