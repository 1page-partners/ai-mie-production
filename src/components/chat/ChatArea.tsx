import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"conversation_messages">;

interface ChatAreaProps {
  conversationId?: string | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onSubmitFeedback: (messageId: string, rating: number, comment?: string) => void;
  isSending: boolean;
  hasConversation: boolean;
}

export function ChatArea({
  conversationId,
  messages,
  onSendMessage,
  onSubmitFeedback,
  isSending,
  hasConversation,
}: ChatAreaProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");

  const hiddenStorageKey = useMemo(() => {
    const id = conversationId ?? "none";
    return `ai-mie:hiddenMessageIds:${id}`;
  }, [conversationId]);

  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(hiddenStorageKey);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.filter((x) => typeof x === "string"));
      return new Set();
    } catch {
      return new Set();
    }
  });

  // 会話切替時にlocalStorageから読み直す
  useEffect(() => {
    try {
      const raw = localStorage.getItem(hiddenStorageKey);
      if (!raw) {
        setHiddenMessageIds(new Set());
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHiddenMessageIds(new Set(parsed.filter((x) => typeof x === "string")));
      } else {
        setHiddenMessageIds(new Set());
      }
    } catch {
      setHiddenMessageIds(new Set());
    }
  }, [hiddenStorageKey]);

  const persistHiddenIds = (next: Set<string>) => {
    setHiddenMessageIds(next);
    try {
      localStorage.setItem(hiddenStorageKey, JSON.stringify(Array.from(next)));
    } catch {
      // ignore
    }
  };

  const hideMessage = (messageId: string) => {
    const next = new Set(hiddenMessageIds);
    next.add(messageId);
    persistHiddenIds(next);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isSending) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleFeedback = (messageId: string, rating: number) => {
    if (rating === 1) {
      onSubmitFeedback(messageId, rating);
    } else {
      setFeedbackMessageId(messageId);
    }
  };

  const submitNegativeFeedback = () => {
    if (feedbackMessageId) {
      onSubmitFeedback(feedbackMessageId, -1, feedbackComment);
      setFeedbackMessageId(null);
      setFeedbackComment("");
    }
  };

  if (!hasConversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <MessageCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">会話未選択</p>
          <p className="text-sm">会話を選ぶか、新規作成してください</p>
        </div>
      </div>
    );
  }

  const visibleMessages = messages.filter((m) => !hiddenMessageIds.has(m.id));

  return (
    <div className="flex flex-1 flex-col bg-background">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {visibleMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => hideMessage(message.id)}
                    aria-label="メッセージを非表示"
                    title="UIで非表示（DBは削除しません）"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                
                {message.role === "assistant" && (
                  <div className="mt-2 flex items-center gap-2 border-t border-border/30 pt-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => handleFeedback(message.id, 1)}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    
                    <Dialog open={feedbackMessageId === message.id} onOpenChange={(open) => !open && setFeedbackMessageId(null)}>
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleFeedback(message.id, -1)}
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>問題の内容</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Textarea
                            placeholder="内容を入力…"
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                          />
                          <Button onClick={submitNegativeFeedback}>送信</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0.1s" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isSending}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isSending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
