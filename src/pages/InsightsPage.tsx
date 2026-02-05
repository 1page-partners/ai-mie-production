import { useState } from "react";
import { Plus, Search, Send, Trash2, Edit, Check, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInsights, useInsightDetail } from "@/hooks/useInsights";
import { useAuth } from "@/hooks/useAuth";
import type { SharedInsight, CreateInsightInput, UpdateInsightInput } from "@/lib/services/insights";

const statusLabels: Record<string, string> = {
  draft: "下書き",
  submitted: "提出中",
  approved: "承認済",
  rejected: "却下",
};

const statusColors: Record<string, string> = {
  draft: "secondary",
  submitted: "default",
  approved: "default",
  rejected: "destructive",
};

export default function InsightsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("approved");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form state
  const [formTopic, setFormTopic] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formVisibility, setFormVisibility] = useState<"org" | "project" | "private">("org");

  const getStatusFilter = () => {
    if (activeTab === "approved") return "approved";
    if (activeTab === "drafts") return "draft";
    if (activeTab === "submitted") return "submitted";
    return undefined;
  };

  const getCreatedByFilter = () => {
    if (activeTab === "drafts" || activeTab === "submitted") return user?.id;
    return undefined;
  };

  const {
    insights,
    isLoading,
    createInsight,
    updateInsight,
    submitInsight,
    deleteInsight,
    isCreating,
    isSubmitting,
  } = useInsights({
    status: getStatusFilter(),
    createdBy: getCreatedByFilter(),
    search: searchQuery || undefined,
  });

  const { insight: selectedInsight } = useInsightDetail(selectedId);

  const handleCreate = () => {
    const tags = formTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    createInsight(
      {
        topic: formTopic,
        summary: formSummary,
        tags,
        visibility: formVisibility,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleUpdate = (id: string) => {
    const tags = formTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    updateInsight(
      {
        id,
        input: {
          topic: formTopic,
          summary: formSummary,
          tags,
          visibility: formVisibility,
        },
      },
      {
        onSuccess: () => {
          setEditingId(null);
          resetForm();
        },
      }
    );
  };

  const handleSubmit = (id: string) => {
    submitInsight(id);
  };

  const handleDelete = (id: string) => {
    if (confirm("この共有知を削除しますか？")) {
      deleteInsight(id);
    }
  };

  const startEdit = (insight: SharedInsight) => {
    setFormTopic(insight.topic);
    setFormSummary(insight.summary);
    setFormTags(insight.tags.join(", "));
    setFormVisibility(insight.visibility as "org" | "project" | "private");
    setEditingId(insight.id);
  };

  const resetForm = () => {
    setFormTopic("");
    setFormSummary("");
    setFormTags("");
    setFormVisibility("org");
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex h-full flex-col p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">共有知（Shared Insights）</h1>
            <p className="text-sm text-muted-foreground">社内で共有された知見・ナレッジ</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            新規作成
          </Button>
        </div>

        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="approved">承認済み</TabsTrigger>
            <TabsTrigger value="drafts">下書き</TabsTrigger>
            <TabsTrigger value="submitted">提出中</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">読込中...</p>
              </div>
            ) : insights.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">該当なし</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {insights.map((insight) => (
                  <Card key={insight.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base line-clamp-2">
                          {insight.topic}
                        </CardTitle>
                        <Badge variant={statusColors[insight.status] as any}>
                          {statusLabels[insight.status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col">
                      <p className="mb-3 flex-1 text-sm text-muted-foreground line-clamp-3">
                        {insight.summary}
                      </p>
                      {insight.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {insight.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {insight.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{insight.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {insight.status === "draft" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => startEdit(insight)}
                            >
                              <Edit className="h-3 w-3" />
                              編集
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => handleSubmit(insight.id)}
                              disabled={isSubmitting}
                            >
                              <Send className="h-3 w-3" />
                              提出
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto text-destructive"
                              onClick={() => handleDelete(insight.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {insight.status === "submitted" && (
                          <span className="text-xs text-muted-foreground">承認待ち</span>
                        )}
                        {insight.status === "approved" && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(insight.updated_at).toLocaleDateString("ja-JP")}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>共有知を作成</DialogTitle>
              <DialogDescription>
                社内で共有したい知見を入力してください
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">トピック</Label>
                <Input
                  id="topic"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  placeholder="例: 顧客対応時の注意点"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">内容</Label>
                <Textarea
                  id="summary"
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="共有したい知見の内容を記載"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">タグ（カンマ区切り）</Label>
                <Input
                  id="tags"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="例: 顧客対応, マニュアル"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">公開範囲</Label>
                <Select value={formVisibility} onValueChange={(v) => setFormVisibility(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org">組織全体</SelectItem>
                    <SelectItem value="project">プロジェクト</SelectItem>
                    <SelectItem value="private">非公開</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreate} disabled={!formTopic || !formSummary || isCreating}>
                {isCreating ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>共有知を編集</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-topic">トピック</Label>
                <Input
                  id="edit-topic"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-summary">内容</Label>
                <Textarea
                  id="edit-summary"
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tags">タグ（カンマ区切り）</Label>
                <Input
                  id="edit-tags"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-visibility">公開範囲</Label>
                <Select value={formVisibility} onValueChange={(v) => setFormVisibility(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org">組織全体</SelectItem>
                    <SelectItem value="project">プロジェクト</SelectItem>
                    <SelectItem value="private">非公開</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingId(null)}>
                キャンセル
              </Button>
              <Button
                onClick={() => editingId && handleUpdate(editingId)}
                disabled={!formTopic || !formSummary}
              >
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
