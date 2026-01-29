import { Brain, Pin, CheckCircle, Clock, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Memory, MemoryStatus, MemoryType } from "@/lib/services/memory";

const typeLabels: Record<MemoryType, string> = {
  fact: "事実",
  preference: "嗜好",
  procedure: "手順",
  goal: "目標",
  context: "文脈",
};

const statusLabels: Record<MemoryStatus, string> = {
  approved: "承認済み",
  candidate: "未確認",
  rejected: "却下",
};

interface MemoryListProps {
  memories: Memory[];
  selectedId?: string;
  onSelect: (memory: Memory) => void;
  isLoading: boolean;
  statusFilter: MemoryStatus;
  onStatusFilterChange: (status: MemoryStatus) => void;
  typeFilter: MemoryType | "all";
  onTypeFilterChange: (type: MemoryType | "all") => void;
  pinnedFilter: boolean | null;
  onPinnedFilterChange: (pinned: boolean | null) => void;
  activeFilter: boolean | null;
  onActiveFilterChange: (active: boolean | null) => void;
  candidateCount: number;
}

const typeColors: Record<MemoryType, string> = {
  fact: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  preference: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  procedure: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  goal: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  context: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const statusColors: Record<MemoryStatus, string> = {
  approved: "text-green-600 dark:text-green-400",
  candidate: "text-yellow-600 dark:text-yellow-400",
  rejected: "text-red-600 dark:text-red-400",
};

export function MemoryList({
  memories,
  selectedId,
  onSelect,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  pinnedFilter,
  onPinnedFilterChange,
  activeFilter,
  onActiveFilterChange,
  candidateCount,
}: MemoryListProps) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Status Tabs */}
      <div className="border-b border-border px-3 pt-3">
        <Tabs value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as MemoryStatus)}>
          <TabsList className="w-full">
            <TabsTrigger value="approved" className="flex-1 gap-1">
              <CheckCircle className="h-3 w-3" />
              承認済み
            </TabsTrigger>
            <TabsTrigger value="candidate" className="flex-1 gap-1 relative">
              <Clock className="h-3 w-3" />
              未確認
              {candidateCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs">
                  {candidateCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1 gap-1">
              <XCircle className="h-3 w-3" />
              却下
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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

          {statusFilter === "approved" && (
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
          )}

          {statusFilter === "approved" && (
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
          )}
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
              {statusFilter === "candidate" 
                ? "未確認のメモリはありません" 
                : statusFilter === "rejected"
                ? "却下したメモリはありません"
                : "該当なし"}
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
                  <Brain className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    statusColors[memory.status as MemoryStatus] ?? "text-primary"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate text-foreground">
                        {memory.title}
                      </span>
                      {memory.pinned && statusFilter === "approved" && (
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
                      {!memory.is_active && statusFilter === "approved" && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          無効
                        </Badge>
                      )}
                      {statusFilter === "rejected" && memory.rejected_reason && (
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={memory.rejected_reason}>
                          {memory.rejected_reason}
                        </span>
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
