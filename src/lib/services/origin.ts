 import { supabase } from "@/integrations/supabase/client";
 
 // =============================================
 // Types
 // =============================================
 
 export type SetupSessionStatus = "draft" | "submitted" | "approved" | "rejected";
 
 export type SetupSession = {
   id: string;
   user_id: string;
   status: SetupSessionStatus;
   created_at: string;
   submitted_at: string | null;
   reviewed_at: string | null;
   reviewed_by: string | null;
   rejection_reason: string | null;
 };
 
 export type SetupAnswer = {
   id: string;
   session_id: string;
   question_key: string;
   question_text: string;
   answer_rule: string;
   answer_rationale: string | null;
   answer_exceptions: string | null;
   proposed_type: "fact" | "preference" | "procedure" | "goal" | "context";
   proposed_confidence: number;
   created_at: string;
   updated_at: string;
 };
 
 export type OriginDecision = {
   id: string;
   user_id: string;
   incident_key: string;
   decision: string;
   reasoning: string;
   context_conditions: string | null;
   non_negotiables: string | null;
   confidence: number;
   created_at: string;
   updated_at: string;
 };
 
 export type OriginPrinciple = {
   id: string;
   user_id: string;
   principle_key: string;
   principle_label: string;
   description: string;
   polarity: string | null;
   confidence: number;
   source_incident_ids: string[];
   created_at: string;
   updated_at: string;
 };
 
 // =============================================
 // Fixed Questions (12 Setup Questions)
 // =============================================
 
 export const SETUP_QUESTIONS = [
   {
     key: "purpose_who",
     text: "AI-MIEの主な目的と対象ユーザーは誰ですか？どのような場面で使われることを想定していますか？",
   },
   {
     key: "top_values",
     text: "最も優先すべき価値観・原則を3つ挙げてください。",
   },
   {
     key: "donts",
     text: "絶対にやってはいけないこと、避けるべき行動を具体的に挙げてください。",
   },
   {
     key: "answer_granularity",
     text: "回答の詳細度について：簡潔さと詳細さのどちらを重視しますか？状況による場合はその基準も。",
   },
   {
     key: "uncertainty_policy",
     text: "不確実な情報への対応方針：わからないときはどう振る舞うべきですか？",
   },
   {
     key: "conflict_policy",
     text: "価値観が衝突した場合の優先順位をどう決めますか？",
   },
   {
     key: "conservatism",
     text: "リスク許容度：新しい提案と安全策のどちらを優先しますか？その判断基準は？",
   },
   {
     key: "correction_policy",
     text: "間違いを指摘された場合、どのように対応すべきですか？",
   },
   {
     key: "goal_priority",
     text: "短期目標と長期目標が対立した場合、どちらを優先しますか？",
   },
   {
     key: "trust_sources",
     text: "信頼すべき情報源と、懐疑的になるべき情報源の基準を教えてください。",
   },
   {
     key: "origin_feedback_policy",
     text: "あなた（origin）からのフィードバックをどの程度重視すべきですか？",
   },
   {
     key: "priority_rules",
     text: "複数の要求が同時にある場合の優先順位決定ルールを教えてください。",
   },
 ] as const;
 
 // =============================================
 // Fixed Incidents (10 Cases)
 // =============================================
 
 export const INCIDENT_CASES = [
   {
     key: "case01",
     title: "緊急性 vs 品質",
     description: "納期が迫っているが、品質に問題がある成果物をどうするか",
   },
   {
     key: "case02",
     title: "顧客要望 vs 社内方針",
     description: "顧客が社内ルールに反する要望をしてきた場合",
   },
   {
     key: "case03",
     title: "透明性 vs 機密保持",
     description: "情報共有すべきか、機密を守るべきか判断が分かれる場面",
   },
   {
     key: "case04",
     title: "個人の成長 vs チームの効率",
     description: "経験不足のメンバーに任せるか、熟練者がやるか",
   },
   {
     key: "case05",
     title: "コスト削減 vs サービス品質",
     description: "予算削減要求とサービスレベル維持の両立が困難な場合",
   },
   {
     key: "case06",
     title: "過去の慣例 vs 新しい手法",
     description: "実績ある方法と革新的なアプローチの選択",
   },
   {
     key: "case07",
     title: "多数意見 vs 専門家意見",
     description: "チームの総意と専門家の見解が異なる場合",
   },
   {
     key: "case08",
     title: "自社利益 vs 社会的責任",
     description: "利益追求と社会的影響のバランス",
   },
   {
     key: "case09",
     title: "スピード vs 確実性",
     description: "素早い対応と慎重な検証のトレードオフ",
   },
   {
     key: "case10",
     title: "例外対応 vs ルール遵守",
     description: "特別な事情がある場合にルールを曲げるべきか",
   },
 ] as const;
 
 // =============================================
 // Role Checking
 // =============================================
 
 export async function hasRole(role: "admin" | "origin" | "user"): Promise<boolean> {
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) return false;
 
   const { data, error } = await supabase
     .from("user_roles")
     .select("role")
     .eq("user_id", user.id)
     .eq("role", role)
     .maybeSingle();
 
   if (error) {
     console.error("Error checking role:", error);
     return false;
   }
 
   return !!data;
 }
 
 export async function isOrigin(): Promise<boolean> {
   return hasRole("origin");
 }

export async function canAccessOriginPages(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "origin"]);

  if (error) {
    console.error("Error checking origin access:", error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}
 
 // =============================================
 // Setup Session Service
 // =============================================
 
 export const setupService = {
   async getCurrentSession(): Promise<SetupSession | null> {
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) return null;
 
     const { data, error } = await supabase
       .from("setup_sessions")
       .select("*")
       .eq("user_id", user.id)
       .order("created_at", { ascending: false })
       .limit(1)
       .maybeSingle();
 
     if (error) throw error;
     return data as SetupSession | null;
   },
 
   async createSession(): Promise<SetupSession> {
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) throw new Error("Not authenticated");
 
     const { data, error } = await supabase
       .from("setup_sessions")
       .insert({ user_id: user.id, status: "draft" })
       .select()
       .single();
 
     if (error) throw error;
     return data as SetupSession;
   },
 
   async getAnswers(sessionId: string): Promise<SetupAnswer[]> {
     const { data, error } = await supabase
       .from("setup_answers")
       .select("*")
       .eq("session_id", sessionId)
       .order("created_at", { ascending: true });
 
     if (error) throw error;
     return (data ?? []) as SetupAnswer[];
   },
 
   async saveAnswer(
     sessionId: string,
     questionKey: string,
     answer: {
       answer_rule: string;
       answer_rationale?: string;
       answer_exceptions?: string;
       proposed_type?: "fact" | "preference" | "procedure" | "goal" | "context";
       proposed_confidence?: number;
     }
   ): Promise<SetupAnswer> {
     const question = SETUP_QUESTIONS.find((q) => q.key === questionKey);
     if (!question) throw new Error("Invalid question key");
 
     const { data, error } = await supabase
       .from("setup_answers")
       .upsert(
         {
           session_id: sessionId,
           question_key: questionKey,
           question_text: question.text,
           answer_rule: answer.answer_rule,
           answer_rationale: answer.answer_rationale ?? null,
           answer_exceptions: answer.answer_exceptions ?? null,
           proposed_type: answer.proposed_type ?? "procedure",
           proposed_confidence: answer.proposed_confidence ?? 0.9,
         },
         { onConflict: "session_id,question_key" }
       )
       .select()
       .single();
 
     if (error) throw error;
     return data as SetupAnswer;
   },
 
   async submitSession(sessionId: string): Promise<SetupSession> {
     const { data, error } = await supabase
       .from("setup_sessions")
       .update({
         status: "submitted",
         submitted_at: new Date().toISOString(),
       })
       .eq("id", sessionId)
       .select()
       .single();
 
     if (error) throw error;
     return data as SetupSession;
   },
 
   // Admin functions
   async listPendingSessions(): Promise<(SetupSession & { answers: SetupAnswer[] })[]> {
     const { data, error } = await supabase
       .from("setup_sessions")
       .select("*")
       .eq("status", "submitted")
       .order("submitted_at", { ascending: true });
 
     if (error) throw error;
 
     const sessions = (data ?? []) as SetupSession[];
     const result: (SetupSession & { answers: SetupAnswer[] })[] = [];
 
     for (const session of sessions) {
       const answers = await this.getAnswers(session.id);
       result.push({ ...session, answers });
     }
 
     return result;
   },
 
   async approveSession(sessionId: string): Promise<void> {
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) throw new Error("Not authenticated");
 
     // Get answers
     const answers = await this.getAnswers(sessionId);
 
     // Create approved, pinned memories from answers
     for (const answer of answers) {
       const { error: memError } = await supabase.from("memories").insert({
         user_id: user.id,
         type: answer.proposed_type,
         title: `[憲法] ${answer.question_key}`,
         content: `Q: ${answer.question_text}\n\nA: ${answer.answer_rule}${answer.answer_rationale ? `\n\n理由: ${answer.answer_rationale}` : ""}${answer.answer_exceptions ? `\n\n例外: ${answer.answer_exceptions}` : ""}`,
         confidence: answer.proposed_confidence,
         status: "approved",
         pinned: true,
         is_active: true,
         reviewed_at: new Date().toISOString(),
       });
       if (memError) console.error("Failed to create constitution memory:", memError);
     }
 
     // Update session status
     const { error } = await supabase
       .from("setup_sessions")
       .update({
         status: "approved",
         reviewed_at: new Date().toISOString(),
         reviewed_by: user.id,
       })
       .eq("id", sessionId);
 
     if (error) throw error;
   },
 
   async rejectSession(sessionId: string, reason: string): Promise<void> {
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) throw new Error("Not authenticated");
 
     const { error } = await supabase
       .from("setup_sessions")
       .update({
         status: "rejected",
         reviewed_at: new Date().toISOString(),
         reviewed_by: user.id,
         rejection_reason: reason,
       })
       .eq("id", sessionId);
 
     if (error) throw error;
   },
 };
 
 // =============================================
 // Origin Decisions Service
 // =============================================
 
 export const decisionsService = {
   async list(): Promise<OriginDecision[]> {
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) return [];
 
     const { data, error } = await supabase
       .from("origin_decisions")
       .select("*")
       .eq("user_id", user.id)
       .order("incident_key", { ascending: true });
 
     if (error) throw error;
     return (data ?? []) as OriginDecision[];
   },
 
   async save(
     incidentKey: string,
     decision: {
       decision: string;
       reasoning: string;
       context_conditions?: string;
       non_negotiables?: string;
       confidence?: number;
     }
   ): Promise<OriginDecision> {
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) throw new Error("Not authenticated");
 
     const { data, error } = await supabase
       .from("origin_decisions")
       .upsert(
         {
           user_id: user.id,
           incident_key: incidentKey,
           decision: decision.decision,
           reasoning: decision.reasoning,
           context_conditions: decision.context_conditions ?? null,
           non_negotiables: decision.non_negotiables ?? null,
           confidence: decision.confidence ?? 0.8,
         },
         { onConflict: "user_id,incident_key" }
       )
       .select()
       .single();
 
     if (error) throw error;
 
     // Trigger profiler (fire and forget)
     void triggerDecisionProfiler(data.id);
 
     return data as OriginDecision;
   },
 };
 
 // =============================================
 // Origin Principles Service
 // =============================================
 
 export const principlesService = {
   async list(): Promise<OriginPrinciple[]> {
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) return [];
 
     const { data, error } = await supabase
       .from("origin_principles")
       .select("*")
       .eq("user_id", user.id)
       .order("confidence", { ascending: false });
 
     if (error) throw error;
     return (data ?? []) as OriginPrinciple[];
   },
 };
 
 // =============================================
 // Origin Feedback Service (for ongoing feedback)
 // =============================================
 
 export const originFeedbackService = {
   async submit(feedback: {
     title: string;
     content: string;
     type: "fact" | "preference" | "procedure" | "goal" | "context";
     confidence?: number;
   }): Promise<void> {
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) throw new Error("Not authenticated");
 
     const { error } = await supabase.from("memories").insert({
       user_id: user.id,
       type: feedback.type,
       title: feedback.title,
       content: feedback.content,
       confidence: feedback.confidence ?? 0.85,
       status: "candidate",
       pinned: false,
       is_active: true,
     });
 
     if (error) throw error;
   },
 };
 
 // =============================================
 // Decision Profiler Trigger
 // =============================================
 
 async function triggerDecisionProfiler(decisionId: string): Promise<void> {
   try {
     const { data: session } = await supabase.auth.getSession();
     const token = session.session?.access_token;
     if (!token) return;
 
     await supabase.functions.invoke("decision-profiler", {
       body: { decisionId },
     });
   } catch (e) {
     console.error("Decision profiler trigger failed:", e);
   }
 }