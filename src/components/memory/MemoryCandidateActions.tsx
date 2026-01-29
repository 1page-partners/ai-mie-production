import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Edit, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Memory, MemoryType } from "@/lib/services/memory";

const typeLabels: Record<MemoryType, string> = {
  fact: "事実",
  preference: "嗜好",
  procedure: "手順",
  goal: "目標",
  context: "文脈",
};

const typeColors: Record<MemoryType, string> = {
  fact: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  preference: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  procedure: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  goal: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  context: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

interface MemoryCandidateActionsProps {
  memory: Memory;
  onApprove: (id: string, updates?: { title?: string; content?: string; type?: MemoryType; confidence?: number }) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
}

export function MemoryCandidateActions({
  memory,
  onApprove,
  onReject,
}: MemoryCandidateActionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [type, setType] = useState<MemoryType>(memory.type as MemoryType);
  const [confidence, setConfidence] = useState(memory.confidence);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      if (isEditing) {
        await onApprove(memory.id, { title, content, type, confidence });
      } else {
        await onApprove(memory.id);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(memory.id, rejectReason || undefined);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <h2 className="text-lg font-semibold">メモリ候補の確認</h2>
          </div>
          <Badge className={cn("text-xs", typeColors[memory.type as MemoryType])}>
            {typeLabels[memory.type as MemoryType]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          自動抽出されたメモリ候補です。承認するとRAGに反映されます。
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label>タイトル</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="メモリのタイトル"
              />
            </div>

            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="メモリの内容"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>種別</Label>
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
              <Label>信頼度: {Math.round(confidence * 100)}%</Label>
              <Slider
                value={[confidence]}
                onValueChange={([v]) => setConfidence(v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-muted-foreground">タイトル</Label>
              <p className="text-foreground font-medium">{memory.title}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">内容</Label>
              <p className="text-foreground whitespace-pre-wrap">{memory.content}</p>
            </div>

            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">信頼度</Label>
                <p className="text-foreground">{Math.round(memory.confidence * 100)}%</p>
              </div>
              <div>
                <Label className="text-muted-foreground">抽出日時</Label>
                <p className="text-foreground text-sm">
                  {new Date(memory.created_at).toLocaleString("ja-JP")}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Reject reason (always visible) */}
        <div className="space-y-2 pt-4 border-t border-border">
          <Label>却下理由（任意）</Label>
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="却下する場合の理由を入力"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
            disabled={isProcessing}
          >
            <Edit className="mr-2 h-4 w-4" />
            {isEditing ? "プレビュー" : "編集"}
          </Button>
          
          <div className="flex-1" />
          
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isProcessing}
            className="text-red-600 hover:text-red-700"
          >
            <XCircle className="mr-2 h-4 w-4" />
            却下
          </Button>
          
          <Button
            onClick={handleApprove}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {isEditing ? "編集して承認" : "承認"}
          </Button>
        </div>
      </div>
    </div>
  );
}
