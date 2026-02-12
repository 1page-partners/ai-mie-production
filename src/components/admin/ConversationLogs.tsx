import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ChevronLeft, Search, User, Bot, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type AdminConversation = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  archived_at: string | null;
  display_name: string | null;
  message_count: number;
};

type AdminMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
  meta: Record<string, unknown>;
};

export function ConversationLogs() {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState("");

  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ["admin-conversations", userFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_conversations", {
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as AdminConversation[];
    },
  });

  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["admin-messages", selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const { data, error } = await supabase.rpc("admin_list_messages", {
        p_conversation_id: selectedConvId,
      });
      if (error) throw error;
      return (data ?? []) as AdminMessage[];
    },
    enabled: !!selectedConvId,
  });

  const filteredConversations = userFilter.trim()
    ? conversations.filter(
        (c) =>
          (c.display_name ?? "").toLowerCase().includes(userFilter.toLowerCase()) ||
          (c.title ?? "").toLowerCase().includes(userFilter.toLowerCase())
      )
    : conversations;

  if (selectedConvId) {
    const conv = conversations.find((c) => c.id === selectedConvId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedConvId(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            戻る
          </Button>
          <span className="text-sm font-medium truncate">
            {conv?.title || "無題"} — {conv?.display_name || "匿名"}
          </span>
          <a
            href={`/chat/${selectedConvId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-3 w-3 mr-1" />
              チャットで開く
            </Button>
          </a>
        </div>

        <ScrollArea className="h-[500px] border rounded-lg p-4">
          <div className="space-y-3 max-w-3xl">
            {loadingMsgs ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">メッセージなし</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary/10 text-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                      {msg.role === "user" ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                      <span>{msg.role === "user" ? "ユーザー" : "AI"}</span>
                      <span className="ml-auto">
                        {format(new Date(msg.created_at), "MM/dd HH:mm:ss")}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ユーザー名 or タイトルで検索…"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {loadingConvs ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredConversations.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">会話なし</p>
      ) : (
        <div className="border rounded-lg divide-y">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => setSelectedConvId(conv.id)}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{conv.title || "無題"}</p>
                <p className="text-xs text-muted-foreground">
                  {conv.display_name || "匿名"} · {format(new Date(conv.created_at), "yyyy/MM/dd HH:mm")}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {conv.message_count}件
              </Badge>
              {conv.archived_at && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  アーカイブ
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
