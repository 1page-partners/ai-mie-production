import { Brain, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Memory = Tables<"memories">;
type KnowledgeChunk = Tables<"knowledge_chunks"> & { source_name?: string };

interface ContextPanelProps {
  memories: Memory[];
  chunks: KnowledgeChunk[];
}

export function ContextPanel({ memories, chunks }: ContextPanelProps) {
  const [memoriesExpanded, setMemoriesExpanded] = useState(true);
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(true);

  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-muted/30">
      <div className="border-b border-border p-3">
        <h2 className="text-sm font-semibold text-foreground">Context</h2>
        <p className="text-xs text-muted-foreground">Referenced in this conversation</p>
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
              <span>Memories</span>
              <Badge variant="secondary" className="ml-auto">
                {memories.length}
              </Badge>
            </button>

            {memoriesExpanded && (
              <div className="mt-2 space-y-2">
                {memories.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">No memories referenced</p>
                ) : (
                  memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="ml-6 rounded-md border border-border bg-card p-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {memory.type}
                        </Badge>
                        {memory.pinned && (
                          <Badge className="text-xs bg-primary/20 text-primary">
                            Pinned
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-medium text-foreground">{memory.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {memory.content}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Confidence: {Math.round(memory.confidence * 100)}%
                        </span>
                      </div>
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
              <span>Knowledge</span>
              <Badge variant="secondary" className="ml-auto">
                {chunks.length}
              </Badge>
            </button>

            {knowledgeExpanded && (
              <div className="mt-2 space-y-2">
                {chunks.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">No knowledge referenced</p>
                ) : (
                  chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="ml-6 rounded-md border border-border bg-card p-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {chunk.source_name || "Unknown Source"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {chunk.content}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        Chunk #{chunk.chunk_index}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
