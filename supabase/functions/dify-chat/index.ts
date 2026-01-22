/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DifyChatRequest = {
  userText: string;
  difyConversationId?: string | null;
  contextText: string;
  // Note: userId/conversationId are accepted for logging/debug but not trusted.
  userId?: string;
  conversationId?: string;
};

type DifyChatResponse = {
  answerText: string;
  difyConversationId: string | null;
  usedMemoryIds: string[];
  usedChunkIds: string[];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractTrailingRefJson(text: string): {
  cleaned: string;
  memoryIds: string[];
  chunkIds: string[];
} {
  // Expect the model to end with: {"memory_ids":[...],"knowledge_chunk_ids":[...]}
  // We try to capture the LAST JSON object in the string.
  const match = text.match(/\{\s*"memory_ids"\s*:\s*\[[\s\S]*?\]\s*,\s*"knowledge_chunk_ids"\s*:\s*\[[\s\S]*?\]\s*\}\s*$/);
  if (!match) {
    return { cleaned: text.trim(), memoryIds: [], chunkIds: [] };
  }

  const jsonStr = match[0];
  const cleaned = text.slice(0, match.index).trim();
  try {
    const parsed = JSON.parse(jsonStr);
    const memoryIds = Array.isArray(parsed?.memory_ids)
      ? parsed.memory_ids.filter((x: unknown) => typeof x === "string")
      : [];
    const chunkIds = Array.isArray(parsed?.knowledge_chunk_ids)
      ? parsed.knowledge_chunk_ids.filter((x: unknown) => typeof x === "string")
      : [];
    return { cleaned, memoryIds, chunkIds };
  } catch {
    return { cleaned: text.trim(), memoryIds: [], chunkIds: [] };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const DIFY_API_BASE_URL = Deno.env.get("DIFY_API_BASE_URL");
    const DIFY_API_KEY = Deno.env.get("DIFY_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase env is not configured" }, 500);
    }
    if (!DIFY_API_BASE_URL || !DIFY_API_KEY) {
      return jsonResponse({ error: "Dify env is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonResponse({ error: "Missing Authorization header" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const body = (await req.json()) as DifyChatRequest;
    if (!body?.userText || typeof body.userText !== "string") {
      return jsonResponse({ error: "userText is required" }, 400);
    }

    const url = `${DIFY_API_BASE_URL.replace(/\/$/, "")}/chat-messages`;
    const payload = {
      inputs: {
        context: body.contextText ?? "",
        // Keeping both keys for flexibility across Dify prompt templates
        contextText: body.contextText ?? "",
      },
      query: body.userText,
      response_mode: "blocking",
      conversation_id: body.difyConversationId ?? undefined,
      user: userData.user.id,
    };

    const makeCall = async () => {
      return await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${DIFY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        25_000,
      );
    };

    // light retry (network/timeout)
    let resp: Response;
    try {
      resp = await makeCall();
    } catch {
      resp = await makeCall();
    }

    const rawText = await resp.text();
    if (!resp.ok) {
      return jsonResponse(
        {
          error: "Dify API error",
          status: resp.status,
          details: rawText?.slice(0, 2000) || null,
        },
        502,
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return jsonResponse({ error: "Invalid response from Dify", details: rawText.slice(0, 2000) }, 502);
    }

    const answer = typeof parsed?.answer === "string" ? parsed.answer : "";
    const difyConversationId =
      typeof parsed?.conversation_id === "string" ? parsed.conversation_id : null;

    const extracted = extractTrailingRefJson(answer);

    const out: DifyChatResponse = {
      answerText: extracted.cleaned,
      difyConversationId,
      usedMemoryIds: extracted.memoryIds,
      usedChunkIds: extracted.chunkIds,
    };

    return jsonResponse(out);
  } catch (e) {
    console.error("dify-chat error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
