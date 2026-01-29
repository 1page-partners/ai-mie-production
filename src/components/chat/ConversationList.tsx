import { useState } from "react";
import { Archive, ArchiveRestore, Check, Pencil, Plus, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Conversation = Tables<"conversations">;

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  onCreate: () => void;
  onUpdateTitle: (id: string, title: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  isLoading: boolean;
  showArchived: boolean;
  onToggleArchived: (show: boolean) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onUpdateTitle,
  onArchive,
  onUnarchive,
  isLoading,
  showArchived,
  onToggleArchived,
}: ConversationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startEditing = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
  };

  const saveTitle = () => {
    if (editingId && editTitle.trim()) {
      onUpdateTitle(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle("");
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h2 className="text-sm font-semibold text-foreground">会話</h2>
        <Button size="icon" variant="ghost" onClick={onCreate} className="h-8 w-8" disabled={showArchived}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b border-border px-3 py-2">
        <Tabs value={showArchived ? "archived" : "active"} onValueChange={(v) => onToggleArchived(v === "archived")}>
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="active" className="text-xs">通常</TabsTrigger>
            <TabsTrigger value="archived" className="text-xs">アーカイブ</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {showArchived ? "アーカイブなし" : "会話なし"}
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors",
                  selectedId === conv.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
                onClick={() => onSelect(conv)}
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                
                {editingId === conv.id ? (
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-6 text-xs"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTitle();
                        if (e.key === "Escape") cancelEditing();
                      }}
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveTitle();
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEditing();
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">
                      {conv.title || "無題"}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          startEditing(conv);
                        }}>
                          <Pencil className="mr-2 h-3 w-3" />
                          名前変更
                        </DropdownMenuItem>
                        {showArchived ? (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            onUnarchive(conv.id);
                          }}>
                            <ArchiveRestore className="mr-2 h-3 w-3" />
                            復元
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            onArchive(conv.id);
                          }}>
                            <Archive className="mr-2 h-3 w-3" />
                            アーカイブ
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
