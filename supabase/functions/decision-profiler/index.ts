 import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
   "Access-Control-Allow-Methods": "POST, OPTIONS",
 };
 
 type ExtractedLogic = {
   priority: string;
   sacrificed: string;
   risk_tolerance: string;
   decision_style: string;
   core_principle: string;
   abstracted_context: string;
 };
 
 function embeddingToPgVectorString(embedding: number[]) {
   return `[${embedding.join(",")}]`;
 }
 
 async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), timeoutMs);
   try {
     return await fetch(url, { ...init, signal: controller.signal });
   } finally {
     clearTimeout(timeout);
   }
 }
 
 const EXTRACTION_PROMPT = `あなたは意思決定パターン抽出の専門家です。
 与えられた判断事例から、判断者の思考パターンを抽出してください。
 
 ## 抽出項目
 - priority: 何を最優先したか
 - sacrificed: 何を犠牲にしたか
 - risk_tolerance: リスク許容度（conservative/moderate/aggressive）
 - decision_style: 判断スタイル（analytical/intuitive/consultative/directive）
 - core_principle: 根底にある原則
 - abstracted_context: 抽象化された判断文脈
 
 ## 出力形式
 必ず以下のJSON形式のみで出力してください。説明は不要です。
 
 {
   "priority": "...",
   "sacrificed": "...",
   "risk_tolerance": "...",
   "decision_style": "...",
   "core_principle": "...",
   "abstracted_context": "..."
 }`;
 
 serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
   const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
   const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
   const OPENAI_MODEL_CHAT = Deno.env.get("OPENAI_MODEL_CHAT") ?? "gpt-4.1-mini";
   const OPENAI_MODEL_EMBED = Deno.env.get("OPENAI_MODEL_EMBED") ?? "text-embedding-3-small";
 
   if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
     return new Response(JSON.stringify({ error: "Missing required env vars" }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 
   const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
 
   try {
     const { decisionId } = await req.json();
     if (!decisionId) {
       return new Response(JSON.stringify({ error: "decisionId required" }), {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // 1) Fetch decision
     const { data: decision, error: fetchErr } = await supabase
       .from("origin_decisions")
       .select("*")
       .eq("id", decisionId)
       .single();
 
     if (fetchErr || !decision) {
       return new Response(JSON.stringify({ error: "Decision not found" }), {
         status: 404,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // 2) Extract logic using OpenAI
     const userContent = `## 判断事例
 
 インシデント: ${decision.incident_key}
 
 判断: ${decision.decision}
 
 理由: ${decision.reasoning}
 
 文脈条件: ${decision.context_conditions ?? "N/A"}
 
 譲れない点: ${decision.non_negotiables ?? "N/A"}
 
 上記から判断パターンを抽出してください。`;
 
     const extractRes = await fetchWithTimeout(
       "https://api.openai.com/v1/chat/completions",
       {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${OPENAI_API_KEY}`,
         },
         body: JSON.stringify({
           model: OPENAI_MODEL_CHAT,
           messages: [
             { role: "system", content: EXTRACTION_PROMPT },
             { role: "user", content: userContent },
           ],
           temperature: 0.1,
           max_tokens: 500,
         }),
       },
       30_000
     );
 
     if (!extractRes.ok) {
       const err = await extractRes.text();
       console.error("OpenAI extraction failed:", err);
       return new Response(JSON.stringify({ error: "Extraction failed" }), {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     const extractJson = await extractRes.json();
     const content = extractJson?.choices?.[0]?.message?.content ?? "";
 
     // Parse JSON from response
     let extractedLogic: ExtractedLogic;
     try {
       const match = content.match(/\{[\s\S]*\}/);
       if (!match) throw new Error("No JSON found");
       extractedLogic = JSON.parse(match[0]);
     } catch (e) {
       console.error("Failed to parse extracted logic:", e);
       return new Response(JSON.stringify({ error: "Failed to parse extraction" }), {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // 3) Generate embedding for the abstracted context
     const embedText = `${extractedLogic.core_principle}\n\n${extractedLogic.abstracted_context}`;
     const embedRes = await fetchWithTimeout(
       "https://api.openai.com/v1/embeddings",
       {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${OPENAI_API_KEY}`,
         },
         body: JSON.stringify({ model: OPENAI_MODEL_EMBED, input: embedText }),
       },
       30_000
     );
 
     let embedding: number[] | null = null;
     if (embedRes.ok) {
       const embedJson = await embedRes.json();
       embedding = embedJson?.data?.[0]?.embedding ?? null;
     }
 
     // 4) Upsert decision profile
     const rawAnswer = {
       incident_key: decision.incident_key,
       decision: decision.decision,
       reasoning: decision.reasoning,
       context_conditions: decision.context_conditions,
       non_negotiables: decision.non_negotiables,
     };
 
     const { error: upsertErr } = await supabase
       .from("origin_decision_profiles")
       .upsert(
         {
           decision_id: decisionId,
           raw_answer: rawAnswer,
           extracted_logic: extractedLogic,
           abstracted_context: extractedLogic.abstracted_context,
           embedding: embedding ? embeddingToPgVectorString(embedding) : null,
         },
         { onConflict: "decision_id" }
       );
 
     if (upsertErr) {
       console.error("Failed to upsert profile:", upsertErr);
     }
 
     // 5) Update or create principles
     const principleKeys = ["risk_tolerance", "decision_style"];
     for (const key of principleKeys) {
       const value = (extractedLogic as Record<string, string>)[key];
       if (!value) continue;
 
       // Check if principle exists
       const { data: existing } = await supabase
         .from("origin_principles")
         .select("id, confidence, source_incident_ids")
         .eq("user_id", decision.user_id)
         .eq("principle_key", key)
         .maybeSingle();
 
       if (existing) {
         // Update confidence and add source
         const newSources = [...(existing.source_incident_ids ?? [])];
         if (!newSources.includes(decisionId)) {
           newSources.push(decisionId);
         }
         await supabase
           .from("origin_principles")
           .update({
             description: value,
             confidence: Math.min(0.95, existing.confidence + 0.05),
             source_incident_ids: newSources,
           })
           .eq("id", existing.id);
       } else {
         // Create new principle
         const label =
           key === "risk_tolerance" ? "リスク許容度" : "判断スタイル";
 
         // Generate embedding for principle
         const principleEmbedRes = await fetchWithTimeout(
           "https://api.openai.com/v1/embeddings",
           {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${OPENAI_API_KEY}`,
             },
             body: JSON.stringify({ model: OPENAI_MODEL_EMBED, input: `${label}: ${value}` }),
           },
           30_000
         );
 
         let principleEmbedding: number[] | null = null;
         if (principleEmbedRes.ok) {
           const pJson = await principleEmbedRes.json();
           principleEmbedding = pJson?.data?.[0]?.embedding ?? null;
         }
 
         await supabase.from("origin_principles").insert({
           user_id: decision.user_id,
           principle_key: key,
           principle_label: label,
           description: value,
           polarity: null,
           confidence: 0.7,
           source_incident_ids: [decisionId],
           embedding: principleEmbedding
             ? embeddingToPgVectorString(principleEmbedding)
             : null,
         });
       }
     }
 
     // Also create core_principle as a principle
     if (extractedLogic.core_principle) {
       const { data: existing } = await supabase
         .from("origin_principles")
         .select("id, confidence, source_incident_ids")
         .eq("user_id", decision.user_id)
         .eq("principle_key", "core_principle")
         .maybeSingle();
 
       if (existing) {
         const newSources = [...(existing.source_incident_ids ?? [])];
         if (!newSources.includes(decisionId)) {
           newSources.push(decisionId);
         }
         await supabase
           .from("origin_principles")
           .update({
             description: extractedLogic.core_principle,
             confidence: Math.min(0.95, existing.confidence + 0.05),
             source_incident_ids: newSources,
           })
           .eq("id", existing.id);
       } else {
         const coreEmbedRes = await fetchWithTimeout(
           "https://api.openai.com/v1/embeddings",
           {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${OPENAI_API_KEY}`,
             },
             body: JSON.stringify({
               model: OPENAI_MODEL_EMBED,
               input: `核心原則: ${extractedLogic.core_principle}`,
             }),
           },
           30_000
         );
 
         let coreEmbedding: number[] | null = null;
         if (coreEmbedRes.ok) {
           const cJson = await coreEmbedRes.json();
           coreEmbedding = cJson?.data?.[0]?.embedding ?? null;
         }
 
         await supabase.from("origin_principles").insert({
           user_id: decision.user_id,
           principle_key: "core_principle",
           principle_label: "核心原則",
           description: extractedLogic.core_principle,
           polarity: null,
           confidence: 0.7,
           source_incident_ids: [decisionId],
           embedding: coreEmbedding ? embeddingToPgVectorString(coreEmbedding) : null,
         });
       }
     }
 
     return new Response(
       JSON.stringify({ success: true, extractedLogic }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (e) {
     console.error("Decision profiler error:", e);
     return new Response(
       JSON.stringify({ error: String(e) }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });