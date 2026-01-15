import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TablesInsert } from "@/integrations/supabase/types";

type MemoryType = "fact" | "preference" | "procedure" | "goal" | "context";

interface MemoryCreateFormProps {
  onSubmit: (memory: Omit<TablesInsert<"memories">, "user_id">) => void;
  onCancel: () => void;
}

export function MemoryCreateForm({ onSubmit, onCancel }: MemoryCreateFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryType>("fact");
  const [confidence, setConfidence] = useState(0.7);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    onSubmit({
      title: title.trim(),
      content: content.trim(),
      type,
      confidence,
      is_active: true,
      pinned: false,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter memory title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content *</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter memory content"
          rows={4}
          required
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

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim() || !content.trim()}>
          Create Memory
        </Button>
      </div>
    </form>
  );
}
