import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatArea } from "@/components/chat/ChatArea";
import { ContextPanel } from "@/components/chat/ContextPanel";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/services/auth";
import { conversationsService, type Conversation, type Message } from "@/lib/services/conversations";
import type { Memory, KnowledgeChunk } from "@/lib/services/context";
import { feedbackService } from "@/lib/services/feedback";
import { supabase } from "@/integrations/supabase/client";

export default function ChatPage() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [referencedMemories, setReferencedMemories] = useState<Memory[]>([]);
  const [referencedChunks, setReferencedChunks] = useState<KnowledgeChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // NOTE: 認証UIをバイパスしている間だけ、RLSに通すため匿名サインインを自動実行する。
  // 失敗する場合は Supabase Auth 設定で Anonymous sign-ins を有効化してください。
  const ensureUser = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes?.user) return userRes.user;

    // まずは既存サービス（通常のログイン）も試す
    const existing = await authService.getUser();
    if (existing) return existing;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.user) throw new Error("Anonymous sign-in failed");
    return data.user;
  };

  // Load conversations
  useEffect(() => {
    (async () => {
      try {
        // 未ログインでもDB(RLS)アクセスできるようにする
        await ensureUser();
      } catch (e) {
        console.warn("ensureUser failed", e);
      } finally {
        loadConversations();
      }
    })();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      // 右ペインは「今回のターン」の参照のみ表示するため、切替時はクリア
      setReferencedMemories([]);
      setReferencedChunks([]);
    } else {
      setMessages([]);
      setReferencedMemories([]);
      setReferencedChunks([]);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const data = await conversationsService.listConversations();
      setConversations(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const data = await conversationsService.listMessages(conversationId);
      setMessages(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const createConversation = async () => {
    try {
      const user = await ensureUser();

      const data = await conversationsService.createConversation({
        userId: user.id,
        title: "New Conversation",
      });
      setConversations(prev => [data, ...prev]);
      setSelectedConversation(data);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create conversation",
        variant: "destructive",
      });
    }
  };

  const updateConversationTitle = async (id: string, title: string) => {
    try {
      await conversationsService.updateConversationTitle(id, title);
      setConversations(prev =>
        prev.map(c => (c.id === id ? { ...c, title } : c))
      );
      if (selectedConversation?.id === id) {
        setSelectedConversation(prev => prev ? { ...prev, title } : null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update conversation title",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async (content: string) => {
    if (!selectedConversation) {
      toast({
        title: "Error",
        description: "Please select or create a conversation first",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const user = await ensureUser();

      // 楽観的にユーザー発話を表示
      const optimisticUserMsg = {
        id: `local-user-${Date.now()}`,
        conversation_id: selectedConversation.id,
        user_id: user.id,
        role: "user" as const,
        content,
        created_at: new Date().toISOString(),
        meta: {},
      };
      setMessages((prev) => [...prev, optimisticUserMsg as any]);

      // ストリーミング用のassistantメッセージ枠
      const streamAssistantId = `local-assistant-${Date.now()}`;
      setMessages((prev) =>
        [...prev, {
          id: streamAssistantId,
          conversation_id: selectedConversation.id,
          user_id: user.id,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
          meta: { streaming: true },
        } as any],
      );

      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const functionUrl = "https://upscuqkxjvhzcriwljjl.supabase.co/functions/v1/openai-chat";
      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2N1cWt4anZoemNyaXdsampsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTYxMjksImV4cCI6MjA4NDA3MjEyOX0.jCF2wIOnjgq-xu5k-7ycRmZDnolLwDl2pgNg97Dh5bo",
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          userText: content,
          projectId: selectedConversation.project_id ?? null,
          clientMessageId: null,
        }),
      });

      if (!res.ok || !res.body) {
        const raw = await res.text();
        throw new Error(raw || `Edge Function failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamingText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const dataStr = line.slice("data:".length).trim();
          if (!dataStr) continue;
          const evt = JSON.parse(dataStr);

          if (evt.type === "delta" && typeof evt.delta === "string") {
            streamingText += evt.delta;
            setMessages((prev) =>
              prev.map((m) => (m.id === streamAssistantId ? ({ ...m, content: streamingText } as any) : m)),
            );
          }

          if (evt.type === "final") {
            setReferencedMemories((evt.usedMemories ?? []) as Memory[]);
            setReferencedChunks((evt.usedKnowledge ?? []) as KnowledgeChunk[]);

            // ストリーム枠を最終確定に置換
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamAssistantId
                  ? ({
                      ...m,
                      id: evt.assistantMessageId,
                      content: evt.assistantText,
                      meta: { ...(m.meta as any), streaming: false },
                    } as any)
                  : m,
              ),
            );

            // DBに保存済みなので、正しい順序/IDで取り直す
            const refreshed = await conversationsService.listMessages(selectedConversation.id);
            setMessages(refreshed);
          }

          if (evt.type === "error") {
            throw new Error(evt.message || "Edge Function error");
          }
        }
      }

    } catch (error) {
      console.error("Send message error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const submitFeedback = async (messageId: string, rating: number, comment?: string) => {
    if (!selectedConversation) return;

    const user = await ensureUser();

    try {
      await feedbackService.saveFeedback({
        conversationId: selectedConversation.id,
        messageId,
        userId: user.id,
        rating,
        comment,
      });
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit feedback",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id}
          onSelect={setSelectedConversation}
          onCreate={createConversation}
          onUpdateTitle={updateConversationTitle}
          isLoading={isLoading}
        />
        <ChatArea
          conversationId={selectedConversation?.id}
          messages={messages}
          onSendMessage={sendMessage}
          onSubmitFeedback={submitFeedback}
          isSending={isSending}
          hasConversation={!!selectedConversation}
        />
        <ContextPanel
          memories={referencedMemories}
          chunks={referencedChunks}
        />
      </div>
    </AppLayout>
  );
}
