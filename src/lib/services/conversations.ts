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
};
