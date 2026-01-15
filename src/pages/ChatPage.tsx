import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatArea } from "@/components/chat/ChatArea";
import { ContextPanel } from "@/components/chat/ContextPanel";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Conversation = Tables<"conversations">;
type Message = Tables<"conversation_messages">;
type Memory = Tables<"memories">;
type KnowledgeChunk = Tables<"knowledge_chunks"> & { source_name?: string };

export default function ChatPage() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [referencedMemories, setReferencedMemories] = useState<Memory[]>([]);
  const [referencedChunks, setReferencedChunks] = useState<KnowledgeChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      loadReferences(selectedConversation.id);
    } else {
      setMessages([]);
      setReferencedMemories([]);
      setReferencedChunks([]);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
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
      const { data, error } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const loadReferences = async (conversationId: string) => {
    try {
      // Load memory refs
      const { data: memoryRefs } = await supabase
        .from("memory_refs")
        .select("memory_id")
        .eq("conversation_id", conversationId);

      if (memoryRefs && memoryRefs.length > 0) {
        const memoryIds = memoryRefs.map(r => r.memory_id);
        const { data: memories } = await supabase
          .from("memories")
          .select("*")
          .in("id", memoryIds);
        setReferencedMemories(memories || []);
      } else {
        setReferencedMemories([]);
      }

      // Load knowledge refs
      const { data: knowledgeRefs } = await supabase
        .from("knowledge_refs")
        .select("chunk_id")
        .eq("conversation_id", conversationId);

      if (knowledgeRefs && knowledgeRefs.length > 0) {
        const chunkIds = knowledgeRefs.map(r => r.chunk_id);
        const { data: chunks } = await supabase
          .from("knowledge_chunks")
          .select("*, knowledge_sources(name)")
          .in("id", chunkIds);
        
        const chunksWithSourceName = (chunks || []).map(c => ({
          ...c,
          source_name: (c.knowledge_sources as any)?.name,
        }));
        setReferencedChunks(chunksWithSourceName);
      } else {
        setReferencedChunks([]);
      }
    } catch (error) {
      console.error("Failed to load references:", error);
    }
  };

  const createConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Please sign in to create conversations",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("conversations")
        .insert({ 
          title: "New Conversation",
          user_id: user.id 
        })
        .select()
        .single();

      if (error) throw error;
      setConversations(prev => [data, ...prev]);
      setSelectedConversation(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
    }
  };

  const updateConversationTitle = async (id: string, title: string) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ title })
        .eq("id", id);

      if (error) throw error;
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

  const searchContext = async (query: string) => {
    // Simple keyword search (will be replaced with vector search later)
    const searchTerm = `%${query}%`;
    
    const { data: memories } = await supabase
      .from("memories")
      .select("*")
      .ilike("content", searchTerm)
      .eq("is_active", true)
      .limit(5);

    const { data: chunks } = await supabase
      .from("knowledge_chunks")
      .select("*, knowledge_sources(name)")
      .ilike("content", searchTerm)
      .limit(5);

    return {
      memories: memories || [],
      chunks: (chunks || []).map(c => ({
        ...c,
        source_name: (c.knowledge_sources as any)?.name,
      })),
    };
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to send messages",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      // 1. Save user message
      const { data: userMessage, error: userMsgError } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: selectedConversation.id,
          user_id: user.id,
          role: "user",
          content,
          meta: {},
        })
        .select()
        .single();

      if (userMsgError) throw userMsgError;
      setMessages(prev => [...prev, userMessage]);

      // 2. Search for context
      const context = await searchContext(content);
      setReferencedMemories(context.memories);
      setReferencedChunks(context.chunks);

      // 3. Generate mock assistant response (Dify integration placeholder)
      const contextSummary = [
        ...context.memories.map(m => `Memory: ${m.content}`),
        ...context.chunks.map(c => `Knowledge: ${c.content}`),
      ].join("\n");

      // Mock response - will be replaced with Dify API call
      const assistantContent = `Based on the context provided, here's my response to: "${content}"\n\n` +
        (contextSummary ? `I found relevant information:\n${contextSummary.substring(0, 200)}...` : 
        "I don't have specific context for this query, but I'm here to help!");

      // 4. Save assistant message
      const { data: assistantMessage, error: assistantMsgError } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: selectedConversation.id,
          user_id: user.id,
          role: "assistant",
          content: assistantContent,
          meta: {},
        })
        .select()
        .single();

      if (assistantMsgError) throw assistantMsgError;
      setMessages(prev => [...prev, assistantMessage]);

      // 5. Save memory references
      for (const memory of context.memories) {
        await supabase.from("memory_refs").insert({
          conversation_id: selectedConversation.id,
          memory_id: memory.id,
          assistant_message_id: assistantMessage.id,
          score: 0.8, // Mock score
        });
      }

      // 6. Save knowledge references
      for (const chunk of context.chunks) {
        await supabase.from("knowledge_refs").insert({
          conversation_id: selectedConversation.id,
          chunk_id: chunk.id,
          assistant_message_id: assistantMessage.id,
          score: 0.8, // Mock score
        });
      }

    } catch (error) {
      console.error("Send message error:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const submitFeedback = async (messageId: string, rating: number, comment?: string) => {
    if (!selectedConversation) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to submit feedback",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("feedback").insert({
        conversation_id: selectedConversation.id,
        message_id: messageId,
        user_id: user.id,
        rating,
        comment,
      });

      if (error) throw error;
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback",
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
