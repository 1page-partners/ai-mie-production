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

 type OriginPrincipleRow = {
   id: string;
   principle_key: string;
   principle_label: string;
   description: string;
   polarity: string | null;
   confidence: number;
   score: number;
 };
 
 type OriginDecisionRow = {
   id: string;
   incident_key: string;
   decision: string;
   reasoning: string;
   context_conditions: string | null;
   non_negotiables: string | null;
   confidence: number;
   score: number;
 };
 
type MemoryCandidate = {
  type: "fact" | "preference" | "procedure" | "goal" | "context";
  title: string;
  content: string;
  confidence: number;
  dedupe_key: string;
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
  return `[${embedding.join(",")}]`;
}

function buildSystemPrompt(input: {
  memories: Array<MemoryRow & { score: number | null }>;
  knowledge: Array<{ id: string; source_name: string; chunk_index: number; content: string; meta: unknown; score: number | null }>;
   principles?: OriginPrincipleRow[];
   decisions?: OriginDecisionRow[];
}) {
   // Separate pinned (constitution) memories from regular memories
   const pinnedMemories = input.memories.filter((m) => m.pinned);
   const regularMemories = input.memories.filter((m) => !m.pinned);
 
   const constitutionLines = pinnedMemories
     .map((m) => `- [${m.type}] ${m.title}: ${m.content}`)
     .join("\n");
 
   const principleLines = (input.principles ?? [])
     .map((p) => `- ${p.principle_label}: ${p.description} (confidence: ${Math.round(p.confidence * 100)}%)`)
     .join("\n");
 
   const decisionLines = (input.decisions ?? [])
     .map(
       (d) =>
         `- [${d.incident_key}] 判断: ${d.decision}\n  理由: ${d.reasoning}${d.non_negotiables ? `\n  譲れない点: ${d.non_negotiables}` : ""}`
     )
     .join("\n");
 
   const memoryLines = regularMemories
    .map(
      (m) =>
         `- (id:${m.id} score:${m.score ?? "null"} confidence:${m.confidence}) [${m.type}] ${m.title}: ${m.content}`,
    )
    .join("\n");

  const knowledgeLines = input.knowledge
    .map(
      (k) =>
         `- (chunk_id:${k.id} score:${k.score ?? "null"} source:${k.source_name}) ${k.content}`,
    )
    .join("\n");

   return `[CONSTITUTION - 常時遵守する基本方針]
 ${constitutionLines || "- (none)"}

 [ORIGIN_PRINCIPLES - 判断軸]
 ${principleLines || "- (none)"}
 
 [ORIGIN_DECISION_EXAMPLES - 参考判断例]
 ${decisionLines || "- (none)"}
 
 [MEMORY - 長期記憶]
${memoryLines || "- (none)"}

 [KNOWLEDGE - 資料/マニュアル]
${knowledgeLines || "- (none)"}

 [RULES]
 - CONSTITUTIONに記載された方針は最優先で遵守する
 - ORIGIN_PRINCIPLESに基づいて判断を行う
 - ORIGIN_DECISION_EXAMPLESを参考に、類似状況では同様の判断傾向を維持する
 - MEMORY/KNOWLEDGEを根拠に回答する
 - 判断に迷う場合は、ORIGIN_PRINCIPLESの判断軸を参照して一貫性のある回答をする
 - 不明な場合は不明と認める
- 回答末尾に参照IDをJSONで必ず付与する：\n  {"memory_ids":[...],"knowledge_chunk_ids":[...]}

[/CONTEXT]`;
}

const MEMORY_EXTRACTION_PROMPT = `あなたはメモリ抽出アシスタントです。ユーザーとアシスタントの会話から、長期的に有用な情報を抽出してください。

## 抽出ルール
- 断定的で長期的に有効な情報のみ抽出
- 「方針/手順/業務ルール/永続的な嗜好/プロジェクト状態/重要な事実」を優先
- 感情/一時的な雑談/推測/短期のToDoは抽出しない
- 曖昧な情報や一過性の情報は抽出しない
- 最大3件まで

## 出力形式（JSON配列のみ、説明不要）
[
  {
    "type": "fact|preference|procedure|goal|context",
    "title": "短いタイトル（20文字以内）",
    "content": "RAGで使える粒度の本文（100文字以内）",
    "confidence": 0.0-1.0,
    "dedupe_key": "タイトルを正規化したキー（小文字、スペース除去）"
  }
]

## type の選び方
- fact: 確定した事実（会社情報、人物情報、数値など）
- preference: 嗜好や好み（コーディングスタイル、ツール選択など）
- procedure: 手順やルール（ワークフロー、承認フローなど）
- goal: 目標や方針（プロジェクト目標、KPIなど）
- context: 文脈情報（現在の状況、進行中の作業など）

抽出対象がない場合は空配列 [] を返してください。`;

async function generateEmbedding(
  text: string,
  apiKey: string,
  model: string
): Promise<number[] | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: text }),
      },
      30_000
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

async function extractMemoryCandidates(
  userText: string,
  assistantText: string,
  apiKey: string,
  model: string
): Promise<MemoryCandidate[]> {
  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: MEMORY_EXTRACTION_PROMPT },
            {
              role: "user",
              content: `## 会話内容

ユーザー: ${userText}

アシスタント: ${assistantText}

上記から長期的に有用なメモリを抽出してください。`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      },
      30_000
    );

    if (!res.ok) {
      console.error("Memory extraction API failed:", res.status);
      return [];
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";
    
    // Extract JSON array from response
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const candidates = JSON.parse(match[0]) as MemoryCandidate[];
    
    // Validate and filter
    return candidates
      .filter(
        (c) =>
          c.type &&
          ["fact", "preference", "procedure", "goal", "context"].includes(c.type) &&
          c.title &&
          c.content &&
          typeof c.confidence === "number"
      )
      .slice(0, 3);
  } catch (e) {
    console.error("Memory extraction failed:", e);
    return [];
  }
}

async function checkDuplicateMemory(
  sb: any,
  userId: string,
  candidate: MemoryCandidate
): Promise<boolean> {
  // Check by dedupe_key (normalized title)
  const { data: existing } = await sb
    .from("memories")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "rejected")
    .or(`title.ilike.%${candidate.title}%,content.ilike.%${candidate.content.slice(0, 50)}%`)
    .limit(1);

  return (existing?.length ?? 0) > 0;
}

async function saveMemoryCandidates(
  sb: any,
  userId: string,
  candidates: MemoryCandidate[],
  sourceMessageId: string,
  apiKey: string,
  embedModel: string
): Promise<void> {
  for (const candidate of candidates) {
    try {
      // Check for duplicates
      const isDuplicate = await checkDuplicateMemory(sb, userId, candidate);
      if (isDuplicate) {
        console.log("Skipping duplicate memory:", candidate.title);
        continue;
      }

      // Generate embedding
      const text = `${candidate.title}\n\n${candidate.content}`;
      const embedding = await generateEmbedding(text, apiKey, embedModel);

      // Insert as candidate using raw SQL to avoid type issues
      const insertPayload = {
        user_id: userId,
        type: candidate.type,
        title: candidate.title,
        content: candidate.content,
        confidence: candidate.confidence,
        status: "candidate",
        source_message_id: sourceMessageId,
        embedding: embedding ? embeddingToPgVectorString(embedding) : null,
        is_active: true,
        pinned: false,
      };

      const { error } = await sb.from("memories").insert(insertPayload);

      if (error) {
        console.error("Failed to save memory candidate:", error);
      }
    } catch (e) {
      console.error("Error saving memory candidate:", e);
    }
  }
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
  const OPENAI_PROMPT_ID = Deno.env.get("OPENAI_PROMPT_ID") ?? null;

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

        // 3) Supabaseからコンテキスト取得（approved memories only）
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
          memoryMatches = memRpc.data.map((r: unknown) => {
            const row = r as Record<string, unknown>;
            return {
              id: String(row.id),
              type: String(row.type),
              title: String(row.title ?? ""),
              content: String(row.content ?? ""),
              confidence: Number(row.confidence ?? 0),
              pinned: Boolean(row.pinned),
              updated_at: String(row.updated_at ?? ""),
              score: typeof row.score === "number" ? row.score : null,
            };
          });
        } else {
          // LIKE fallback - only approved
          let q = supabase
            .from("memories")
            .select("id,type,title,content,confidence,pinned,updated_at")
            .eq("is_active", true)
            .eq("status", "approved")
            .ilike("content", `%${userText}%`)
            .order("pinned", { ascending: false })
            .order("confidence", { ascending: false })
            .order("updated_at", { ascending: false })
            .limit(8);
          if (projectId) q = q.eq("project_id", projectId);
          const { data, error } = await q;
          if (error) throw error;
          memoryMatches = (data ?? []).map((r: unknown) => {
            const row = r as Record<string, unknown>;
            return { ...row, score: null } as MemoryRow & { score: number | null };
          });
        }

        const knowRpc = await supabase.rpc("match_knowledge", {
          query_embedding: embeddingStr,
          match_count: 6,
          p_user_id: userId,
          p_project_id: projectId,
        });

        if (!knowRpc.error && Array.isArray(knowRpc.data)) {
          const ids = knowRpc.data.map((r: KnowledgeMatchRow) => r.chunk_id);
          const { data: chunks, error: chunksErr } = await supabase
            .from("knowledge_chunks")
            .select("id,chunk_index,content,meta, knowledge_sources!inner(name,status,project_id)")
            .in("id", ids)
            .eq("knowledge_sources.status", "ready");
          if (chunksErr) throw chunksErr;

          const scoreMap = new Map<string, number>();
          for (const r of knowRpc.data as unknown[]) {
            const row = r as Record<string, unknown>;
            scoreMap.set(String(row.chunk_id), typeof row.score === "number" ? row.score : 0);
          }
          knowledgeMatches = (chunks ?? []).map((c: unknown) => {
            const chunk = c as Record<string, unknown>;
            const sources = chunk.knowledge_sources as Record<string, unknown> | undefined;
            return {
              id: String(chunk.id),
              source_name: String(sources?.name ?? "Unknown Source"),
              chunk_index: Number(chunk.chunk_index ?? 0),
              content: String(chunk.content ?? ""),
              meta: chunk.meta ?? {},
              score: scoreMap.has(String(chunk.id)) ? scoreMap.get(String(chunk.id))! : null,
            };
          });
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
          knowledgeMatches = (data ?? []).map((c: unknown) => {
            const chunk = c as Record<string, unknown>;
            const sources = chunk.knowledge_sources as Record<string, unknown> | undefined;
            return {
              id: String(chunk.id),
              source_name: String(sources?.name ?? "Unknown Source"),
              chunk_index: Number(chunk.chunk_index ?? 0),
              content: String(chunk.content ?? ""),
              meta: chunk.meta ?? {},
              score: null,
            };
          });
        }

        // 4) Origin Principles & Decisions (for origin-style reasoning)
        let originPrinciples: OriginPrincipleRow[] = [];
        let originDecisions: OriginDecisionRow[] = [];

        // Fetch origin principles (similarity search)
        const principlesRpc = await supabase.rpc("match_origin_principles", {
          query_embedding: embeddingStr,
          match_count: 5,
          p_user_id: null, // Get any user's principles for now
        });

        if (!principlesRpc.error && Array.isArray(principlesRpc.data)) {
          originPrinciples = principlesRpc.data
            .filter((p: Record<string, unknown>) => typeof p.score === "number" && p.score > 0.5)
            .map((p: Record<string, unknown>) => ({
              id: String(p.id),
              principle_key: String(p.principle_key),
              principle_label: String(p.principle_label),
              description: String(p.description),
              polarity: p.polarity ? String(p.polarity) : null,
              confidence: Number(p.confidence ?? 0),
              score: Number(p.score),
            }));
        }

        // Fetch origin decisions (similarity search)
        const decisionsRpc = await supabase.rpc("match_origin_decisions", {
          query_embedding: embeddingStr,
          match_count: 3,
          p_user_id: null, // Get any user's decisions for now
        });

        if (!decisionsRpc.error && Array.isArray(decisionsRpc.data)) {
          originDecisions = decisionsRpc.data
            .filter((d: Record<string, unknown>) => typeof d.score === "number" && d.score > 0.5)
            .map((d: Record<string, unknown>) => ({
              id: String(d.id),
              incident_key: String(d.incident_key),
              decision: String(d.decision),
              reasoning: String(d.reasoning),
              context_conditions: d.context_conditions ? String(d.context_conditions) : null,
              non_negotiables: d.non_negotiables ? String(d.non_negotiables) : null,
              confidence: Number(d.confidence ?? 0),
              score: Number(d.score),
            }));
        }

        // Also fetch pinned memories (constitution) unconditionally
        const { data: pinnedMemories } = await supabase
          .from("memories")
          .select("id,type,title,content,confidence,pinned,updated_at")
          .eq("is_active", true)
          .eq("status", "approved")
          .eq("pinned", true)
          .limit(20);

        if (pinnedMemories && pinnedMemories.length > 0) {
          // Add pinned memories that aren't already in memoryMatches
          const existingIds = new Set(memoryMatches.map((m) => m.id));
          for (const pm of pinnedMemories) {
            if (!existingIds.has(pm.id)) {
              memoryMatches.unshift({
                id: pm.id,
                type: pm.type,
                title: pm.title,
                content: pm.content,
                confidence: pm.confidence,
                pinned: pm.pinned,
                updated_at: pm.updated_at,
                score: null,
              });
            }
          }
        }

        // 5) history（直近N件）
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
          .map((m: unknown) => {
            const msg = m as Record<string, unknown>;
            return { role: msg.role as string, content: msg.content as string };
          });

        // 6) OpenAIに送るmessages構築
        // Build context for injection into prompt
        const contextData = buildSystemPrompt({
           memories: memoryMatches,
           knowledge: knowledgeMatches,
           principles: originPrinciples,
           decisions: originDecisions,
         });

        // Use Responses API with stored prompt if OPENAI_PROMPT_ID is set
        let openaiRes: Response;

        if (OPENAI_PROMPT_ID) {
          // Use Responses API with stored prompt
          const responsesReq = {
            model: OPENAI_MODEL_CHAT,
            stream: true,
            input: [
              {
                role: "user",
                content: `${contextData}\n\n---\n\n会話履歴:\n${history.map((h) => `${h.role}: ${h.content}`).join("\n")}\n\n---\n\nユーザーの質問: ${userText}`,
              },
            ],
            prompt: {
              id: OPENAI_PROMPT_ID,
            },
          };

          openaiRes = await fetchWithTimeout(
            "https://api.openai.com/v1/responses",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
              },
              body: JSON.stringify(responsesReq),
            },
            120_000,
          );
        } else {
          // Fallback to Chat Completions API
          const openaiReq = {
            model: OPENAI_MODEL_CHAT,
            stream: true,
            messages: [
              { role: "system", content: contextData },
              ...history,
              { role: "user", content: userText },
            ],
          };

          openaiRes = await fetchWithTimeout(
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
        }

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

            let parsed: unknown;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            const parsedObj = parsed as Record<string, unknown>;
            const choices = parsedObj?.choices as Array<Record<string, unknown>> | undefined;
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
            const content = delta?.content as string | undefined;
            // Responses API uses different structure
            const textDelta = (parsedObj as any)?.delta as string | undefined;
            const outputContent = textDelta ?? content;
            if (typeof outputContent === "string" && outputContent.length) {
              fullText += outputContent;
              writeSse(controller, { type: "delta", delta: outputContent });
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

        // 7) 参照ログ保存（重複は無視）
        if (usedMemoryIds.length) {
          const rows = usedMemoryIds.map((id) => ({
            conversation_id: conversationId,
            assistant_message_id: assistantMsg.id,
            memory_id: id,
            score: null,
          }));
          for (const row of rows) {
            try {
              await supabase.from("memory_refs").insert(row);
            } catch {
              // ignore duplicate
            }
          }
        }
        if (usedChunkIds.length) {
          const rows = usedChunkIds.map((id) => ({
            conversation_id: conversationId,
            assistant_message_id: assistantMsg.id,
            chunk_id: id,
            score: null,
          }));
          for (const row of rows) {
            try {
              await supabase.from("knowledge_refs").insert(row);
            } catch {
              // ignore duplicate
            }
          }
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

        // 8) Memory extraction (async, best-effort)
        // Don't await - let it run in background so client gets response faster
        (async () => {
          try {
            const candidates = await extractMemoryCandidates(
              userText,
              extracted.cleaned,
              OPENAI_API_KEY,
              OPENAI_MODEL_CHAT
            );
            if (candidates.length > 0) {
              await saveMemoryCandidates(
                supabase,
                userId,
                candidates,
                assistantMsg.id,
                OPENAI_API_KEY,
                OPENAI_MODEL_EMBED
              );
              console.log(`Extracted ${candidates.length} memory candidates`);
            }
          } catch (e) {
            console.error("Memory extraction background task failed:", e);
          }
        })();

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
