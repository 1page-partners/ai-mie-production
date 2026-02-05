import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TablesInsert } from "@/integrations/supabase/types";

type MemoryType = "fact" | "preference" | "procedure" | "goal" | "context" | "episodic";

interface MemoryCreateFormProps {
  onSubmit: (memory: Omit<TablesInsert<"memories">, "user_id">) => void;
  onCancel: () => void;
}

export function MemoryCreateForm({ onSubmit, onCancel }: MemoryCreateFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryType>("fact");
  const [confidence, setConfidence] = useState(0.7);
  const [episodeAt, setEpisodeAt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    onSubmit({
      title: title.trim(),
      content: content.trim(),
      type: type as any,
      confidence,
      is_active: true,
      pinned: false,
      episode_at: episodeAt ? new Date(episodeAt).toISOString() : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">タイトル *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトルを入力"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">内容 *</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="内容を入力"
          rows={4}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">種別</Label>
          <Select value={type} onValueChange={(v) => setType(v as MemoryType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fact">事実</SelectItem>
              <SelectItem value="preference">嗜好</SelectItem>
              <SelectItem value="procedure">手順</SelectItem>
              <SelectItem value="goal">目標</SelectItem>
              <SelectItem value="context">文脈</SelectItem>
              <SelectItem value="episodic">エピソード</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>確度: {Math.round(confidence * 100)}%</Label>
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

      {type === "episodic" && (
        <div className="space-y-2">
          <Label htmlFor="episodeAt">出来事の日時</Label>
          <Input
            id="episodeAt"
            type="datetime-local"
            value={episodeAt}
            onChange={(e) => setEpisodeAt(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            この会話・出来事がいつ発生したかを記録します
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="submit" disabled={!title.trim() || !content.trim()}>
          作成
        </Button>
      </div>
    </form>
  );
}
