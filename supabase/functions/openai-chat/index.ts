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
  episode_at?: string | null;
};

type EpisodicMemoryRow = {
  id: string;
  title: string;
  content: string;
  episode_at: string;
  days_ago: number;
  confidence: number;
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

type SharedInsightRow = {
  id: string;
  topic: string;
  summary: string;
  tags: string[];
  contributors: string[];
  created_by: string;
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
      usedKnowledge: Array<{ id: string; source_id: string; source_name: string; source_version: number; chunk_index: number; content: string; meta: unknown; score: number | null }>;
      usedSharedInsights?: SharedInsightRow[];
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
  sharedInsightIds: string[];
} {
  const trimmed = text.trim();
  // Extended pattern to include shared_insight_ids
  const m = trimmed.match(/\{\s*"memory_ids"\s*:\s*\[[^\]]*\]\s*,\s*"knowledge_chunk_ids"\s*:\s*\[[^\]]*\](?:\s*,\s*"shared_insight_ids"\s*:\s*\[[^\]]*\])?\s*\}\s*$/);
  if (!m) return { cleaned: trimmed, memoryIds: [], chunkIds: [], sharedInsightIds: [] };
  try {
    const json = JSON.parse(m[0]);
    const memoryIds = Array.isArray(json.memory_ids)
      ? json.memory_ids.filter((x: unknown) => typeof x === "string")
      : [];
    const chunkIds = Array.isArray(json.knowledge_chunk_ids)
      ? json.knowledge_chunk_ids.filter((x: unknown) => typeof x === "string")
      : [];
    const sharedInsightIds = Array.isArray(json.shared_insight_ids)
      ? json.shared_insight_ids.filter((x: unknown) => typeof x === "string")
      : [];
    return {
      cleaned: trimmed.slice(0, trimmed.length - m[0].length).trim(),
      memoryIds,
      chunkIds,
      sharedInsightIds,
    };
  } catch {
    return { cleaned: trimmed, memoryIds: [], chunkIds: [], sharedInsightIds: [] };
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
  knowledge: Array<{ id: string; source_id: string; source_name: string; source_version: number; chunk_index: number; content: string; meta: unknown; score: number | null }>;
  principles?: OriginPrincipleRow[];
  decisions?: OriginDecisionRow[];
  sharedInsights?: Array<SharedInsightRow & { displayNames: string[] }>;
  knowledgeUpdates?: Array<{ sourceName: string; oldVersion: number; newVersion: number }>;
  episodicMemories?: EpisodicMemoryRow[];
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
        `- (chunk_id:${k.id} score:${k.score ?? "null"} source:${k.source_name} v${k.source_version}) ${k.content}`,
    )
    .join("\n");

  // Shared Insights section
  const sharedInsightLines = (input.sharedInsights ?? [])
    .map((si) => {
      const contributorStr = si.displayNames.length > 0
        ? `(${si.displayNames.join(", ")})`
        : "(社内メンバー)";
      return `- (id:${si.id} score:${si.score?.toFixed(2) ?? "null"}) [${si.topic}] ${contributorStr}: ${si.summary}`;
    })
    .join("\n");

  // Episodic memories section (temporal context)
  const episodicLines = (input.episodicMemories ?? [])
    .map((em) => {
      const daysAgoText = em.days_ago === 0 ? "今日" :
        em.days_ago === 1 ? "昨日" :
        em.days_ago <= 7 ? `${em.days_ago}日前` :
        em.days_ago <= 14 ? "先週" :
        em.days_ago <= 30 ? `${Math.floor(em.days_ago / 7)}週間前` :
        `${Math.floor(em.days_ago / 30)}ヶ月前`;
      return `- (id:${em.id} ${daysAgoText}) ${em.title}: ${em.content}`;
    })
    .join("\n");

  // Knowledge update notice
  let updateNotice = "";
  if (input.knowledgeUpdates && input.knowledgeUpdates.length > 0) {
    const updates = input.knowledgeUpdates.map(
      (u) => `「${u.sourceName}」が v${u.oldVersion}→v${u.newVersion} に更新`
    ).join("、");
    updateNotice = `\n⚠️ 補足：参照資料の更新あり（${updates}）。本回答は最新版前提です。\n`;
  }

  return `${updateNotice}[CONSTITUTION - 常時遵守する基本方針]
${constitutionLines || "- (none)"}

[ORIGIN_PRINCIPLES - 判断軸]
${principleLines || "- (none)"}

[ORIGIN_DECISION_EXAMPLES - 参考判断例]
${decisionLines || "- (none)"}

[SHARED_INSIGHTS - 社内共有知]
${sharedInsightLines || "- (none)"}

[EPISODIC_MEMORY - 過去の会話・出来事]
${episodicLines || "- (none)"}

[MEMORY - 長期記憶]
${memoryLines || "- (none)"}

[KNOWLEDGE - 資料/マニュアル]
${knowledgeLines || "- (none)"}

[RULES]
- CONSTITUTIONに記載された方針は最優先で遵守する
- ORIGIN_PRINCIPLESに基づいて判断を行う
- ORIGIN_DECISION_EXAMPLESを参考に、類似状況では同様の判断傾向を維持する
- SHARED_INSIGHTSは社内で共有された知見。「以前、{名前/社内メンバー}が似た観点で整理しており、必要なら確認すると良い」のような提案表現で言及可能。断定せず、直接引用しない。
- EPISODIC_MEMORYは過去の会話や出来事の記録。「先週話したように」「前回〜の件で確認した通り」のように時間軸を意識して自然に言及する。一貫した人物として過去のやり取りを覚えている姿勢を示す。
- MEMORY/KNOWLEDGEを根拠に回答する
- 判断に迷う場合は、ORIGIN_PRINCIPLESの判断軸を参照して一貫性のある回答をする
- 不明な場合は不明と認める
- 回答末尾に参照IDをJSONで必ず付与する：
  {"memory_ids":[...],"knowledge_chunk_ids":[...],"shared_insight_ids":[...]}

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
        let knowledgeMatches: Array<{ id: string; source_id: string; source_name: string; source_version: number; chunk_index: number; content: string; meta: unknown; score: number | null }> = [];
        let sharedInsightMatches: Array<SharedInsightRow & { displayNames: string[] }> = [];

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

        // Knowledge search with source version
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
            .select("id,chunk_index,content,meta,source_id, knowledge_sources!inner(id,name,status,project_id,version)")
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
              source_id: String(sources?.id ?? chunk.source_id ?? ""),
              source_name: String(sources?.name ?? "Unknown Source"),
              source_version: Number(sources?.version ?? 1),
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
            .select("id,chunk_index,content,meta,source_id, knowledge_sources!inner(id,name,status,project_id,version)")
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
              source_id: String(sources?.id ?? chunk.source_id ?? ""),
              source_name: String(sources?.name ?? "Unknown Source"),
              source_version: Number(sources?.version ?? 1),
              chunk_index: Number(chunk.chunk_index ?? 0),
              content: String(chunk.content ?? ""),
              meta: chunk.meta ?? {},
              score: null,
            };
          });
        }

        // 4) Shared Insights search (NEW)
        const insightsRpc = await supabase.rpc("match_shared_insights", {
          query_embedding: embeddingStr,
          match_count: 3,
          p_project_id: projectId,
        });

        if (!insightsRpc.error && Array.isArray(insightsRpc.data)) {
          // Filter by score threshold (0.78)
          const rawInsights = (insightsRpc.data as Array<Record<string, unknown>>)
            .filter((r) => typeof r.score === "number" && r.score >= 0.78);

          if (rawInsights.length > 0) {
            // Get contributor display names with attribution permission
            const allContributorIds = new Set<string>();
            for (const insight of rawInsights) {
              const contributors = insight.contributors as string[] ?? [];
              const createdBy = insight.created_by as string;
              contributors.forEach((c) => allContributorIds.add(c));
              if (createdBy) allContributorIds.add(createdBy);
            }

            // Fetch profile_prefs for attribution permission
            const { data: prefs } = await supabase
              .from("profile_prefs")
              .select("user_id, allow_attribution")
              .in("user_id", Array.from(allContributorIds));
            const allowedUsers = new Set(
              (prefs ?? []).filter((p: any) => p.allow_attribution).map((p: any) => p.user_id)
            );

            // Fetch display names for allowed users
            const { data: profiles } = await supabase
              .from("profiles")
              .select("user_id, display_name")
              .in("user_id", Array.from(allowedUsers));
            const nameMap = new Map<string, string>();
            for (const p of profiles ?? []) {
              if (p.display_name) nameMap.set(p.user_id, p.display_name);
            }

            sharedInsightMatches = rawInsights.map((r) => {
              const contributors = r.contributors as string[] ?? [];
              const displayNames = contributors
                .filter((c) => allowedUsers.has(c) && nameMap.has(c))
                .map((c) => nameMap.get(c)!);
              return {
                id: String(r.id),
                topic: String(r.topic),
                summary: String(r.summary),
                tags: (r.tags as string[]) ?? [],
                contributors: contributors,
                created_by: String(r.created_by),
                score: Number(r.score),
                displayNames,
              };
            });
          }
        }

        // 5) Origin Principles & Decisions
        let originPrinciples: OriginPrincipleRow[] = [];
        let originDecisions: OriginDecisionRow[] = [];

        const principlesRpc = await supabase.rpc("match_origin_principles", {
          query_embedding: embeddingStr,
          match_count: 5,
          p_user_id: null,
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

        const decisionsRpc = await supabase.rpc("match_origin_decisions", {
          query_embedding: embeddingStr,
          match_count: 3,
          p_user_id: null,
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

        // 6) Pinned memories (constitution) unconditionally
        const { data: pinnedMemories } = await supabase
          .from("memories")
          .select("id,type,title,content,confidence,pinned,updated_at")
          .eq("is_active", true)
          .eq("status", "approved")
          .eq("pinned", true)
          .limit(20);

        if (pinnedMemories && pinnedMemories.length > 0) {
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

        // 6.5) Episodic memories (recent temporal context)
        let episodicMemories: EpisodicMemoryRow[] = [];
        const episodicRpc = await supabase.rpc("get_recent_episodic_memories", {
          p_user_id: userId,
          p_project_id: projectId,
          p_days_back: 365,
          p_limit: 5,
        });

        if (!episodicRpc.error && Array.isArray(episodicRpc.data)) {
          episodicMemories = (episodicRpc.data as unknown[]).map((r) => {
            const row = r as Record<string, unknown>;
            return {
              id: String(row.id),
              title: String(row.title),
              content: String(row.content),
              episode_at: String(row.episode_at),
              days_ago: Number(row.days_ago ?? 0),
              confidence: Number(row.confidence ?? 0),
            };
          });
        }

        // 7) Knowledge version diff detection
        let knowledgeUpdates: Array<{ sourceName: string; oldVersion: number; newVersion: number }> = [];
        if (knowledgeMatches.length > 0) {
          const sourceIds = [...new Set(knowledgeMatches.map((k) => k.source_id))];
          
          // Get past knowledge_refs for this conversation with source versions
          const { data: pastRefs } = await supabase
            .from("knowledge_refs")
            .select("source_id, source_version")
            .eq("conversation_id", conversationId)
            .in("source_id", sourceIds)
            .not("source_version", "is", null)
            .order("created_at", { ascending: false })
            .limit(50);

          if (pastRefs && pastRefs.length > 0) {
            const oldVersionMap = new Map<string, number>();
            for (const ref of pastRefs) {
              if (ref.source_id && ref.source_version && !oldVersionMap.has(ref.source_id)) {
                oldVersionMap.set(ref.source_id, ref.source_version);
              }
            }

            for (const k of knowledgeMatches) {
              const oldVer = oldVersionMap.get(k.source_id);
              if (oldVer !== undefined && oldVer < k.source_version) {
                knowledgeUpdates.push({
                  sourceName: k.source_name,
                  oldVersion: oldVer,
                  newVersion: k.source_version,
                });
              }
            }
          }
        }

        // 8) history（直近N件）
        const { data: historyRows, error: histErr } = await supabase
          .from("conversation_messages")
          .select("role,content,created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (histErr) throw histErr;
        // Remove the last entry if it's the user message we just inserted (to avoid duplication)
        const rawHistory = (historyRows ?? [])
          .slice()
          .reverse()
          .map((m: unknown) => {
            const msg = m as Record<string, unknown>;
            return { role: msg.role as string, content: msg.content as string };
          });
        // The just-inserted user message is included in history; drop it so step 10 doesn't duplicate it
        const history = rawHistory.length > 0 && rawHistory[rawHistory.length - 1].role === "user"
          ? rawHistory.slice(0, -1)
          : rawHistory;

        // 9) Build context with shared insights and episodic memories
        const contextData = buildSystemPrompt({
          memories: memoryMatches,
          knowledge: knowledgeMatches,
          principles: originPrinciples,
          decisions: originDecisions,
          sharedInsights: sharedInsightMatches,
          knowledgeUpdates,
          episodicMemories,
        });

        // 10) OpenAI call
        let openaiRes: Response;

        if (OPENAI_PROMPT_ID) {
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

        // 11) SSE streaming
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
        const fallbackInsightIds = sharedInsightMatches.map((si) => si.id);

        const usedMemoryIds = extracted.memoryIds.length ? extracted.memoryIds : fallbackMemoryIds;
        const usedChunkIds = extracted.chunkIds.length ? extracted.chunkIds : fallbackChunkIds;
        const usedInsightIds = extracted.sharedInsightIds.length ? extracted.sharedInsightIds : fallbackInsightIds;

        // 12) Save assistant message
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
              shared_insight_ids: usedInsightIds,
            },
          })
          .select()
          .single();
        if (assistantErr) throw assistantErr;

        // 13) Save reference logs
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

        // Save knowledge_refs with source_id and source_version
        if (usedChunkIds.length) {
          const chunkToSource = new Map<string, { source_id: string; source_version: number }>();
          for (const k of knowledgeMatches) {
            chunkToSource.set(k.id, { source_id: k.source_id, source_version: k.source_version });
          }

          const rows = usedChunkIds.map((id) => ({
            conversation_id: conversationId,
            assistant_message_id: assistantMsg.id,
            chunk_id: id,
            score: null,
            source_id: chunkToSource.get(id)?.source_id ?? null,
            source_version: chunkToSource.get(id)?.source_version ?? null,
          }));
          for (const row of rows) {
            try {
              await supabase.from("knowledge_refs").insert(row);
            } catch {
              // ignore duplicate
            }
          }
        }

        // Save shared_insight_refs (NEW)
        if (usedInsightIds.length) {
          const rows = usedInsightIds.map((id) => ({
            conversation_id: conversationId,
            assistant_message_id: assistantMsg.id,
            insight_id: id,
            score: sharedInsightMatches.find((si) => si.id === id)?.score ?? null,
          }));
          for (const row of rows) {
            try {
              await supabase.from("shared_insight_refs").insert(row);
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
        const usedSharedInsights = sharedInsightMatches
          .filter((si) => usedInsightIds.includes(si.id));

        writeSse(controller, {
          type: "final",
          assistantText: extracted.cleaned,
          assistantMessageId: assistantMsg.id,
          usedMemories,
          usedKnowledge,
          usedSharedInsights,
        });

        // 14) Memory extraction (async, best-effort)
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
