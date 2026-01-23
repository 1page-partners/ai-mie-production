import { Brain, Pin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Memory = Tables<"memories">;
type MemoryType = "fact" | "preference" | "procedure" | "goal" | "context";

const typeLabels: Record<MemoryType, string> = {
  fact: "事実",
  preference: "嗜好",
  procedure: "手順",
  goal: "目標",
  context: "文脈",
};

interface MemoryListProps {
  memories: Memory[];
  selectedId?: string;
  onSelect: (memory: Memory) => void;
  isLoading: boolean;
  typeFilter: MemoryType | "all";
  onTypeFilterChange: (type: MemoryType | "all") => void;
  pinnedFilter: boolean | null;
  onPinnedFilterChange: (pinned: boolean | null) => void;
  activeFilter: boolean | null;
  onActiveFilterChange: (active: boolean | null) => void;
}

const typeColors: Record<MemoryType, string> = {
  fact: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  preference: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  procedure: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  goal: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  context: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function MemoryList({
  memories,
  selectedId,
  onSelect,
  isLoading,
  typeFilter,
  onTypeFilterChange,
  pinnedFilter,
  onPinnedFilterChange,
  activeFilter,
  onActiveFilterChange,
}: MemoryListProps) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Filters */}
      <div className="border-b border-border p-3 space-y-2">
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={(v) => onTypeFilterChange(v as MemoryType | "all")}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="種別" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全て</SelectItem>
              <SelectItem value="fact">事実</SelectItem>
              <SelectItem value="preference">嗜好</SelectItem>
              <SelectItem value="procedure">手順</SelectItem>
              <SelectItem value="goal">目標</SelectItem>
              <SelectItem value="context">文脈</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={pinnedFilter === null ? "all" : pinnedFilter ? "pinned" : "unpinned"}
            onValueChange={(v) => onPinnedFilterChange(v === "all" ? null : v === "pinned")}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="ピン" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全て</SelectItem>
              <SelectItem value="pinned">ピンあり</SelectItem>
              <SelectItem value="unpinned">ピンなし</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={activeFilter === null ? "all" : activeFilter ? "active" : "inactive"}
            onValueChange={(v) => onActiveFilterChange(v === "all" ? null : v === "active")}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="状態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全て</SelectItem>
              <SelectItem value="active">有効</SelectItem>
              <SelectItem value="inactive">無効</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              該当なし
            </div>
          ) : (
            memories.map((memory) => (
              <div
                key={memory.id}
                className={cn(
                  "group cursor-pointer rounded-md border border-transparent p-3 transition-colors",
                  selectedId === memory.id
                    ? "bg-accent border-primary/30"
                    : "hover:bg-muted"
                )}
                onClick={() => onSelect(memory)}
              >
                <div className="flex items-start gap-2">
                  <Brain className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate text-foreground">
                        {memory.title}
                      </span>
                      {memory.pinned && (
                        <Pin className="h-3 w-3 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {memory.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={cn("text-xs", typeColors[memory.type as MemoryType])}>
                        {typeLabels[memory.type as MemoryType]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(memory.confidence * 100)}%
                      </span>
                      {!memory.is_active && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          無効
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
