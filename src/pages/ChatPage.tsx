import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatArea } from "@/components/chat/ChatArea";
import { ContextPanel } from "@/components/chat/ContextPanel";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/services/auth";
import { conversationsService, type Conversation, type Message } from "@/lib/services/conversations";
import { contextService, type Memory, type KnowledgeChunk } from "@/lib/services/context";
import { buildContextText } from "@/lib/services/contextText";
import { difyService } from "@/lib/services/dify";
import { refsService } from "@/lib/services/refs";
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

    const user = await ensureUser();

    setIsSending(true);
    try {
      // 1) user message を保存
      const userMessage = await conversationsService.addMessage({
        conversationId: selectedConversation.id,
        userId: user.id,
        role: "user",
        content,
      });
      setMessages(prev => [...prev, userMessage]);

      // 2) context検索（LIKE）
      const [memories, chunks] = await Promise.all([
        contextService.searchMemories({ queryText: content, limit: 8, projectId: selectedConversation.project_id }),
        contextService.searchKnowledge({ queryText: content, limit: 6, projectId: selectedConversation.project_id }),
      ]);

      // 3) contextText生成
      const contextText = buildContextText({ memories, chunks });

      // 4) Dify呼び出し（継続IDは直近assistantメッセージmetaから拾う）
      const lastAssistant = [...messages, userMessage].slice().reverse().find((m) => m.role === "assistant");
      const lastDifyConversationId = (lastAssistant?.meta as any)?.difyConversationId as string | undefined;

      const dify = await difyService.chat({
        userText: content,
        difyConversationId: lastDifyConversationId ?? null,
        contextText,
        userId: user.id,
        conversationId: selectedConversation.id,
      });

      // Difyが参照IDを返せない場合は「注入した上位N件」をログにする
      const usedMemoryIds = dify.usedMemoryIds.length ? dify.usedMemoryIds : memories.map((m) => m.id);
      const usedChunkIds = dify.usedChunkIds.length ? dify.usedChunkIds : chunks.map((c) => c.id);

      // 5) assistant message を保存（metaにdifyConversationId/参照IDs）
      const assistantMessage = await conversationsService.addMessage({
        conversationId: selectedConversation.id,
        userId: user.id,
        role: "assistant",
        content: dify.answerText,
        meta: {
          difyConversationId: dify.difyConversationId,
          memory_ids: usedMemoryIds,
          knowledge_chunk_ids: usedChunkIds,
        },
      });
      setMessages(prev => [...prev, assistantMessage]);

      // 6) refs保存
      const usedMemories = memories
        .filter((m) => usedMemoryIds.includes(m.id))
        .map((m) => ({ id: m.id, score: null }));
      const usedChunks = chunks
        .filter((c) => usedChunkIds.includes(c.id))
        .map((c) => ({ id: c.id, score: null }));

      await Promise.all([
        refsService.saveMemoryRefs({
          conversationId: selectedConversation.id,
          assistantMessageId: assistantMessage.id,
          memories: usedMemories,
        }),
        refsService.saveKnowledgeRefs({
          conversationId: selectedConversation.id,
          assistantMessageId: assistantMessage.id,
          chunks: usedChunks,
        }),
      ]);

      // 7) UI右ペイン（今回のターンのみ）
      setReferencedMemories(memories.filter((m) => usedMemoryIds.includes(m.id)));
      setReferencedChunks(chunks.filter((c) => usedChunkIds.includes(c.id)));

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
