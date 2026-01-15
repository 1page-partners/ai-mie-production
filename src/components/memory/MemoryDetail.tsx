import { useState, useEffect } from "react";
import { Pin, PinOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

type Memory = Tables<"memories">;
type MemoryType = "fact" | "preference" | "procedure" | "goal" | "context";

interface MemoryDetailProps {
  memory: Memory;
  onUpdate: (updates: TablesUpdate<"memories">) => void;
}

export function MemoryDetail({ memory, onUpdate }: MemoryDetailProps) {
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [type, setType] = useState<MemoryType>(memory.type as MemoryType);
  const [confidence, setConfidence] = useState(memory.confidence);
  const [isActive, setIsActive] = useState(memory.is_active);
  const [pinned, setPinned] = useState(memory.pinned);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setTitle(memory.title);
    setContent(memory.content);
    setType(memory.type as MemoryType);
    setConfidence(memory.confidence);
    setIsActive(memory.is_active);
    setPinned(memory.pinned);
    setHasChanges(false);
  }, [memory]);

  useEffect(() => {
    const changed =
      title !== memory.title ||
      content !== memory.content ||
      type !== memory.type ||
      confidence !== memory.confidence ||
      isActive !== memory.is_active ||
      pinned !== memory.pinned;
    setHasChanges(changed);
  }, [title, content, type, confidence, isActive, pinned, memory]);

  const handleSave = () => {
    onUpdate({
      title,
      content,
      type,
      confidence,
      is_active: isActive,
      pinned,
    });
  };

  const togglePinned = () => {
    const newPinned = !pinned;
    setPinned(newPinned);
    onUpdate({ pinned: newPinned });
  };

  const toggleActive = () => {
    const newActive = !isActive;
    setIsActive(newActive);
    onUpdate({ is_active: newActive });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-semibold text-foreground">Memory Details</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={togglePinned}
          >
            {pinned ? (
              <>
                <PinOff className="mr-2 h-4 w-4" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="mr-2 h-4 w-4" />
                Pin
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as MemoryType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fact">Fact</SelectItem>
                <SelectItem value="preference">Preference</SelectItem>
                <SelectItem value="procedure">Procedure</SelectItem>
                <SelectItem value="goal">Goal</SelectItem>
                <SelectItem value="context">Context</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Confidence: {Math.round(confidence * 100)}%</Label>
            <Slider
              value={[confidence]}
              onValueChange={([v]) => setConfidence(v)}
              min={0}
              max={1}
              step={0.05}
              className="mt-2"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <Label>Active Status</Label>
            <p className="text-sm text-muted-foreground">
              Inactive memories won't be used for context
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={toggleActive} />
        </div>

        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          <p>Created: {new Date(memory.created_at).toLocaleString()}</p>
          <p>Updated: {new Date(memory.updated_at).toLocaleString()}</p>
          <p className="text-xs mt-2 font-mono">ID: {memory.id}</p>
        </div>
      </div>
    </div>
  );
}
