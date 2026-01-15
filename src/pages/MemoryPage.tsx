import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MemoryList } from "@/components/memory/MemoryList";
import { MemoryDetail } from "@/components/memory/MemoryDetail";
import { MemoryCreateForm } from "@/components/memory/MemoryCreateForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Memory = Tables<"memories">;
type MemoryType = "fact" | "preference" | "procedure" | "goal" | "context";

export default function MemoryPage() {
  const { toast } = useToast();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
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
      let query = supabase.from("memories").select("*").order("updated_at", { ascending: false });

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }
      if (pinnedFilter !== null) {
        query = query.eq("pinned", pinnedFilter);
      }
      if (activeFilter !== null) {
        query = query.eq("is_active", activeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMemories(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load memories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createMemory = async (memory: Omit<TablesInsert<"memories">, "user_id">) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to create memories",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("memories")
        .insert({ ...memory, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setMemories(prev => [data, ...prev]);
      setIsCreateOpen(false);
      toast({
        title: "Memory created",
        description: "Your memory has been saved",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create memory",
        variant: "destructive",
      });
    }
  };

  const updateMemory = async (id: string, updates: TablesUpdate<"memories">) => {
    try {
      const { data, error } = await supabase
        .from("memories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      setMemories(prev => prev.map(m => (m.id === id ? data : m)));
      if (selectedMemory?.id === id) {
        setSelectedMemory(data);
      }
      toast({
        title: "Memory updated",
        description: "Your changes have been saved",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update memory",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Left Panel - List */}
        <div className="flex h-full w-96 flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h1 className="text-lg font-semibold text-foreground">Memories</h1>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Memory
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Memory</DialogTitle>
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
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Select a memory to view details</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
