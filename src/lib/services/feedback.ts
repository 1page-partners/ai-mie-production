import { supabase } from "@/integrations/supabase/client";

export const feedbackService = {
  async saveFeedback(input: {
    conversationId: string;
    messageId: string;
    userId: string;
    rating: number;
    comment?: string;
  }) {
    const { error } = await supabase.from("feedback").insert({
      conversation_id: input.conversationId,
      message_id: input.messageId,
      user_id: input.userId,
      rating: input.rating,
      comment: input.comment,
    });
    if (error) throw error;
  },
};
