import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Conversation = Tables<"conversations">;
export type Message = Tables<"conversation_messages">;

export const conversationsService = {
  async listConversations() {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createConversation(input: { userId: string; title?: string | null; projectId?: string | null }) {
    const payload: TablesInsert<"conversations"> = {
      user_id: input.userId,
      title: input.title ?? "New Conversation",
      project_id: input.projectId ?? null,
    };

    const { data, error } = await supabase
      .from("conversations")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateConversationTitle(id: string, title: string) {
    const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
    if (error) throw error;
  },

  async listMessages(conversationId: string) {
    const { data, error } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async addMessage(input: {
    conversationId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
    meta?: Record<string, unknown>;
  }) {
    const { data, error } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: input.conversationId,
        user_id: input.userId,
        role: input.role,
        content: input.content,
        meta: (input.meta ?? {}) as any,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteConversation(conversationId: string) {
    // FKの都合で、子テーブルから順に削除する
    // （厳密なトランザクションはクライアントからは張れないので、順序で安全側に寄せる）
    const { error: fbErr } = await supabase
      .from("feedback")
      .delete()
      .eq("conversation_id", conversationId);
    if (fbErr) throw fbErr;

    const { error: memRefsErr } = await supabase
      .from("memory_refs")
      .delete()
      .eq("conversation_id", conversationId);
    if (memRefsErr) throw memRefsErr;

    const { error: knowRefsErr } = await supabase
      .from("knowledge_refs")
      .delete()
      .eq("conversation_id", conversationId);
    if (knowRefsErr) throw knowRefsErr;

    const { error: msgErr } = await supabase
      .from("conversation_messages")
      .delete()
      .eq("conversation_id", conversationId);
    if (msgErr) throw msgErr;

    const { error: convErr } = await supabase.from("conversations").delete().eq("id", conversationId);
    if (convErr) throw convErr;
  },
};
