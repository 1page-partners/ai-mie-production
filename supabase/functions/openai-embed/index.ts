/// <reference lib="deno.unstable" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

type EmbedRequest = { text: string };
type EmbedResponse = { embedding: number[] };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const OPENAI_MODEL_EMBED = Deno.env.get("OPENAI_MODEL_EMBED") ?? "text-embedding-3-small";
  const EMBED_DIM = Number(Deno.env.get("EMBED_DIM") ?? "1536");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "Missing SUPABASE_URL/SUPABASE_ANON_KEY" }, 500);
  }
  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: "Missing OPENAI_API_KEY" }, 500);
  }
  if (!Number.isFinite(EMBED_DIM) || EMBED_DIM <= 0) {
    return jsonResponse({ error: "Invalid EMBED_DIM" }, 500);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) return jsonResponse({ error: "Missing Authorization token" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) return jsonResponse({ error: "Unauthorized" }, 401);

  let body: EmbedRequest;
  try {
    body = (await req.json()) as EmbedRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const text = (body?.text ?? "").trim();
  if (!text) return jsonResponse({ error: "text is required" }, 400);

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL_EMBED,
          input: text,
        }),
      },
      60_000,
    );

    const raw = await res.text();
    if (!res.ok) {
      return jsonResponse({ error: `OpenAI embeddings failed (${res.status})`, details: raw }, 502);
    }
    const json = JSON.parse(raw);
    const embedding = json?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      return jsonResponse({ error: "Invalid embeddings response" }, 502);
    }
    if (embedding.length !== EMBED_DIM) {
      return jsonResponse(
        {
          error: "Embedding dimension mismatch",
          expected: EMBED_DIM,
          got: embedding.length,
          model: OPENAI_MODEL_EMBED,
        },
        500,
      );
    }

    return jsonResponse({ embedding } satisfies EmbedResponse);
  } catch (e) {
    return jsonResponse({ error: "Embedding generation failed", details: String(e) }, 500);
  }
});
