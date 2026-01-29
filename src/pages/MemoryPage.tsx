import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MemoryList } from "@/components/memory/MemoryList";
import { MemoryDetail } from "@/components/memory/MemoryDetail";
import { MemoryCreateForm } from "@/components/memory/MemoryCreateForm";
import { memoryService, type Memory } from "@/lib/services/memory";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type MemoryType = "fact" | "preference" | "procedure" | "goal" | "context";

export default function MemoryPage() {
  const { toast } = useToast();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<MemoryType | "all">("all");
  const [pinnedFilter, setPinnedFilter] = useState<boolean | null>(null);
  const [activeFilter, setActiveFilter] = useState<boolean | null>(true);

  useEffect(() => {
    loadMemories();
  }, [typeFilter, pinnedFilter, activeFilter]);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const data = await memoryService.list({
        typeFilter,
        pinnedFilter,
        activeFilter,
      });
      setMemories(data);
    } catch (error) {
      toast({
        title: "エラー",
        description: "メモリの取得に失敗",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createMemory = async (memory: Omit<TablesInsert<"memories">, "user_id">) => {
    try {
      const { memory: created, embeddingSuccess } = await memoryService.create(memory);
      setMemories(prev => [created, ...prev]);
      setIsCreateOpen(false);
      
      if (embeddingSuccess) {
        toast({
          title: "作成完了",
          description: "メモリを保存しました（Embedding生成済み）",
        });
      } else {
        toast({
          title: "作成完了",
          description: "メモリを保存しました（Embedding生成に失敗。詳細画面から再生成可能）",
          variant: "default",
        });
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "作成に失敗",
        variant: "destructive",
      });
    }
  };

  const updateMemory = async (id: string, updates: TablesUpdate<"memories">) => {
    try {
      const { memory: updated, embeddingSuccess } = await memoryService.update(id, updates);
      setMemories(prev => prev.map(m => (m.id === id ? updated : m)));
      if (selectedMemory?.id === id) {
        setSelectedMemory(updated);
      }
      
      if (updates.title !== undefined || updates.content !== undefined) {
        if (embeddingSuccess) {
          toast({ title: "更新完了", description: "変更を保存しました（Embedding更新済み）" });
        } else {
          toast({ title: "更新完了", description: "変更を保存しました（Embedding更新に失敗）" });
        }
      } else {
        toast({ title: "更新完了", description: "変更を保存しました" });
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "更新に失敗",
        variant: "destructive",
      });
    }
  };

  const regenerateEmbedding = async () => {
    if (!selectedMemory) return;
    setIsRegenerating(true);
    try {
      const success = await memoryService.regenerateEmbedding(selectedMemory.id);
      if (success) {
        toast({ title: "成功", description: "Embeddingを再生成しました" });
        // Reload to get updated embedding status
        loadMemories();
      } else {
        toast({ title: "エラー", description: "Embedding生成に失敗", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "エラー", description: "再生成に失敗", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Left Panel - List */}
        <div className="flex h-full w-96 flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h1 className="text-lg font-semibold text-foreground">メモリ</h1>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  新規
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>メモリ作成</DialogTitle>
                </DialogHeader>
                <MemoryCreateForm onSubmit={createMemory} onCancel={() => setIsCreateOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          <MemoryList
            memories={memories}
            selectedId={selectedMemory?.id}
            onSelect={setSelectedMemory}
            isLoading={isLoading}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            pinnedFilter={pinnedFilter}
            onPinnedFilterChange={setPinnedFilter}
            activeFilter={activeFilter}
            onActiveFilterChange={setActiveFilter}
          />
        </div>

        {/* Right Panel - Detail */}
        <div className="flex-1 bg-background">
          {selectedMemory ? (
            <MemoryDetail
              memory={selectedMemory}
              onUpdate={(updates) => updateMemory(selectedMemory.id, updates)}
              onRegenerateEmbedding={regenerateEmbedding}
              isRegenerating={isRegenerating}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">メモリを選択</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
