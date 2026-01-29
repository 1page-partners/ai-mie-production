import { useState, useEffect } from "react";
import { Pin, PinOff, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Memory, MemoryType } from "@/lib/services/memory";
import type { TablesUpdate } from "@/integrations/supabase/types";

interface MemoryDetailProps {
  memory: Memory;
  onUpdate: (updates: TablesUpdate<"memories">) => void;
  onRegenerateEmbedding?: () => void;
  isRegenerating?: boolean;
}

export function MemoryDetail({ memory, onUpdate, onRegenerateEmbedding, isRegenerating }: MemoryDetailProps) {
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [type, setType] = useState<MemoryType>(memory.type as MemoryType);
  const [confidence, setConfidence] = useState(memory.confidence);
  const [isActive, setIsActive] = useState(memory.is_active);
  const [pinned, setPinned] = useState(memory.pinned);
  const [hasChanges, setHasChanges] = useState(false);

  const hasEmbedding = memory.embedding !== null;

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
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">メモリ詳細</h2>
          {hasEmbedding ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Embedding済
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              Embedding未生成
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRegenerateEmbedding && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerateEmbedding}
              disabled={isRegenerating}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
              Embedding再生成
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={togglePinned}
          >
            {pinned ? (
              <>
                <PinOff className="mr-2 h-4 w-4" />
                ピン解除
              </>
            ) : (
              <>
                <Pin className="mr-2 h-4 w-4" />
                ピン
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">タイトル</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">内容</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
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

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <Label>有効</Label>
            <p className="text-sm text-muted-foreground">
              無効のメモリは文脈に使われません
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={toggleActive} />
        </div>

        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          <p>作成: {new Date(memory.created_at).toLocaleString()}</p>
          <p>更新: {new Date(memory.updated_at).toLocaleString()}</p>
          <p className="text-xs mt-2 font-mono">ID: {memory.id}</p>
        </div>
      </div>
    </div>
  );
}
