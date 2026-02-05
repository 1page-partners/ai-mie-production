import { Brain, BookOpen, Lightbulb, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Tables } from "@/integrations/supabase/types";

type Memory = Tables<"memories">;
type KnowledgeChunk = Tables<"knowledge_chunks"> & { source_name?: string };

export type SharedInsightRef = {
  id: string;
  topic: string;
  summary: string;
  tags: string[];
  displayNames: string[];
  score: number | null;
};

const memoryTypeLabels: Record<string, string> = {
  fact: "事実",
  preference: "嗜好",
  procedure: "手順",
  goal: "目標",
  context: "文脈",
};

interface ContextPanelProps {
  memories: Memory[];
  chunks: KnowledgeChunk[];
  sharedInsights?: SharedInsightRef[];
}

export function ContextPanel({ memories, chunks, sharedInsights = [] }: ContextPanelProps) {
  const isMobile = useIsMobile();
  const [memoriesExpanded, setMemoriesExpanded] = useState(true);
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(true);
  const [insightsExpanded, setInsightsExpanded] = useState(true);

  const totalRefs = memories.length + chunks.length + sharedInsights.length;

  const panelContent = (
    <>
      <div className="border-b border-border p-3">
        <h2 className="text-sm font-semibold text-foreground">文脈</h2>
        <p className="text-xs text-muted-foreground">この会話で参照</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Memories Section */}
          <div>
            <button
              className="flex w-full items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
              onClick={() => setMemoriesExpanded(!memoriesExpanded)}
            >
              {memoriesExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Brain className="h-4 w-4 text-primary" />
              <span>メモリ</span>
              <Badge variant="secondary" className="ml-auto">
                {memories.length}
              </Badge>
            </button>

            {memoriesExpanded && (
              <div className="mt-2 space-y-2">
                {memories.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">参照メモリなし</p>
                ) : (
                  memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="ml-6 rounded-md border border-border bg-card p-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {memoryTypeLabels[memory.type] ?? memory.type}
                        </Badge>
                        {memory.pinned && (
                          <Badge className="text-xs bg-primary/20 text-primary">
                            ピン
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-medium text-foreground">{memory.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {memory.content}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          確度: {Math.round(memory.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Shared Insights Section */}
          <div>
            <button
              className="flex w-full items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
              onClick={() => setInsightsExpanded(!insightsExpanded)}
            >
              {insightsExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>共有知</span>
              <Badge variant="secondary" className="ml-auto">
                {sharedInsights.length}
              </Badge>
            </button>

            {insightsExpanded && (
              <div className="mt-2 space-y-2">
                {sharedInsights.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">参照共有知なし</p>
                ) : (
                  sharedInsights.map((insight) => (
                    <div
                      key={insight.id}
                      className="ml-6 rounded-md border border-border bg-card p-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {insight.topic}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {insight.summary}
                      </p>
                      {insight.displayNames.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          貢献者: {insight.displayNames.join(", ")}
                        </p>
                      )}
                      {insight.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {insight.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Knowledge Section */}
          <div>
            <button
              className="flex w-full items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
              onClick={() => setKnowledgeExpanded(!knowledgeExpanded)}
            >
              {knowledgeExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <BookOpen className="h-4 w-4 text-info" />
              <span>ナレッジ</span>
              <Badge variant="secondary" className="ml-auto">
                {chunks.length}
              </Badge>
            </button>

            {knowledgeExpanded && (
              <div className="mt-2 space-y-2">
                {chunks.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">参照ナレッジなし</p>
                ) : (
                  chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="ml-6 rounded-md border border-border bg-card p-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {chunk.source_name || "不明"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {chunk.content}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        チャンク #{chunk.chunk_index}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </>
  );

  // Mobile: Show as a sheet/drawer
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="fixed bottom-20 right-3 z-50 gap-2 shadow-lg"
          >
            <Brain className="h-4 w-4" />
            <span>文脈</span>
            {totalRefs > 0 && (
              <Badge variant="secondary" className="ml-1">
                {totalRefs}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 p-0">
          <div className="flex h-full flex-col">
            {panelContent}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop layout
  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-muted/30">
      {panelContent}
    </div>
  );
}
