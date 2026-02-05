import { useState } from "react";
import { Check, X, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useInsights } from "@/hooks/useInsights";
import type { SharedInsight } from "@/lib/services/insights";

export function InsightsApproval() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInsight, setSelectedInsight] = useState<SharedInsight | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { insights, isLoading, approveInsight, rejectInsight, isApproving, isRejecting } =
    useInsights({
      status: "submitted",
      search: searchQuery || undefined,
    });

  const handleApprove = (id: string) => {
    approveInsight(id);
  };

  const openReject = (id: string) => {
    setRejectingId(id);
    setRejectReason("");
    setIsRejectOpen(true);
  };

  const handleReject = () => {
    if (rejectingId) {
      rejectInsight(
        { id: rejectingId, reason: rejectReason },
        {
          onSuccess: () => {
            setIsRejectOpen(false);
            setRejectingId(null);
          },
        }
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{insights.length}件</Badge>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">読込中...</div>
      ) : insights.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          承認待ちの共有知はありません
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <Card key={insight.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{insight.topic}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setSelectedInsight(insight)}
                    >
                      <Eye className="h-3 w-3" />
                      詳細
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1"
                      onClick={() => handleApprove(insight.id)}
                      disabled={isApproving}
                    >
                      <Check className="h-3 w-3" />
                      承認
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => openReject(insight.id)}
                    >
                      <X className="h-3 w-3" />
                      却下
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{insight.summary}</p>
                {insight.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {insight.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  提出日: {new Date(insight.updated_at).toLocaleDateString("ja-JP")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedInsight} onOpenChange={(open) => !open && setSelectedInsight(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedInsight?.topic}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">内容</Label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{selectedInsight?.summary}</p>
            </div>
            {selectedInsight?.tags && selectedInsight.tags.length > 0 && (
              <div>
                <Label className="text-muted-foreground">タグ</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedInsight.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">公開範囲</Label>
              <p className="mt-1 text-sm">
                {selectedInsight?.visibility === "org"
                  ? "組織全体"
                  : selectedInsight?.visibility === "project"
                  ? "プロジェクト"
                  : "非公開"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedInsight(null)}>
              閉じる
            </Button>
            <Button
              onClick={() => {
                if (selectedInsight) {
                  handleApprove(selectedInsight.id);
                  setSelectedInsight(null);
                }
              }}
              disabled={isApproving}
            >
              承認
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>共有知を却下</DialogTitle>
            <DialogDescription>却下理由を入力してください（任意）</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="却下理由..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isRejecting}>
              {isRejecting ? "処理中..." : "却下"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
