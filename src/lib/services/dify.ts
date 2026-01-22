import { supabase } from "@/integrations/supabase/client";

export type DifyChatResult = {
  answerText: string;
  difyConversationId: string | null;
  usedMemoryIds: string[];
  usedChunkIds: string[];
};

export const difyService = {
  async chat(input: {
    userText: string;
    difyConversationId?: string | null;
    contextText: string;
    userId: string;
    conversationId: string;
  }): Promise<DifyChatResult> {
    const { data, error } = await supabase.functions.invoke("dify-chat", {
      body: {
        userText: input.userText,
        difyConversationId: input.difyConversationId ?? null,
        contextText: input.contextText,
        userId: input.userId,
        conversationId: input.conversationId,
      },
    });

    if (error) {
      // supabase-js puts function errors here; surface details to UI
      throw new Error(error.message || "Failed to call dify-chat");
    }
    return data as DifyChatResult;
  },
};
