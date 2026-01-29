import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { memoryService } from "@/lib/services/memory";
import { knowledgeService } from "@/lib/services/knowledge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, LogOut, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const { toast } = useToast();

  // Embedding補完 state
  const [memoryMissingCount, setMemoryMissingCount] = useState<number | null>(null);
  const [knowledgeMissingCount, setKnowledgeMissingCount] = useState<number | null>(null);
  const [isFillingMemory, setIsFillingMemory] = useState(false);
  const [isFillingKnowledge, setIsFillingKnowledge] = useState(false);
  const [memoryProgress, setMemoryProgress] = useState({ done: 0, total: 0 });
  const [knowledgeProgress, setKnowledgeProgress] = useState({ done: 0, total: 0 });
  const [fillResult, setFillResult] = useState<{ memory?: { success: number; failed: number }; knowledge?: { success: number; failed: number } } | null>(null);

  // Error sources
  const [errorSources, setErrorSources] = useState<Awaited<ReturnType<typeof knowledgeService.getErrorSources>>>([]);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMissingCounts();
    loadErrorSources();
  }, []);

  const loadMissingCounts = async () => {
    const [memCount, knowCount] = await Promise.all([
      memoryService.getMissingEmbeddingsCount(),
      knowledgeService.getMissingEmbeddingsCount(),
    ]);
    setMemoryMissingCount(memCount);
    setKnowledgeMissingCount(knowCount);
  };

  const loadErrorSources = async () => {
    try {
      const sources = await knowledgeService.getErrorSources();
      setErrorSources(sources);
    } catch {
      // ignore
    }
  };

  const fillMemoryEmbeddings = async () => {
    setIsFillingMemory(true);
    setFillResult(null);
    setMemoryProgress({ done: 0, total: 0 });
    try {
      const result = await memoryService.fillMissingEmbeddings((done, total) => {
        setMemoryProgress({ done, total });
      });
      setFillResult((prev) => ({ ...prev, memory: result }));
      toast({
        title: "完了",
        description: `Memory: 成功${result.success}件, 失敗${result.failed}件`,
      });
      loadMissingCounts();
    } catch (error) {
      toast({ title: "エラー", description: "処理に失敗", variant: "destructive" });
    } finally {
      setIsFillingMemory(false);
    }
  };

  const fillKnowledgeEmbeddings = async () => {
    setIsFillingKnowledge(true);
    setFillResult(null);
    setKnowledgeProgress({ done: 0, total: 0 });
    try {
      const result = await knowledgeService.fillMissingEmbeddings((done, total) => {
        setKnowledgeProgress({ done, total });
      });
      setFillResult((prev) => ({ ...prev, knowledge: result }));
      toast({
        title: "完了",
        description: `Knowledge: 成功${result.success}件, 失敗${result.failed}件`,
      });
      loadMissingCounts();
    } catch (error) {
      toast({ title: "エラー", description: "処理に失敗", variant: "destructive" });
    } finally {
      setIsFillingKnowledge(false);
    }
  };

  const retrySource = async (sourceId: string) => {
    setRetryingIds((prev) => new Set(prev).add(sourceId));
    try {
      await knowledgeService.syncSource(sourceId);
      toast({ title: "再同期開始", description: "処理を開始しました" });
      // Reload after a short delay
      setTimeout(() => {
        loadErrorSources();
      }, 2000);
    } catch (error) {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "再同期に失敗",
        variant: "destructive",
      });
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <h1 className="text-2xl font-bold text-foreground">設定</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supabase接続</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">状態</span>
              <div className="flex items-center gap-2">
                {isAuthenticated ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">接続中</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">未ログイン</span>
                  </>
                )}
              </div>
            </div>
            {user && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ユーザー</span>
                <span className="text-sm text-foreground">{user.email ?? "(匿名)"}</span>
              </div>
            )}
            {isAuthenticated && (
              <Button variant="outline" onClick={signOut} className="w-full">
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">運用ツール</CardTitle>
            <CardDescription>Embedding補完・失敗リトライ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Memory Embedding */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Memory Embedding補完</p>
                  <p className="text-sm text-muted-foreground">
                    欠損: {memoryMissingCount ?? "..."} 件
                  </p>
                </div>
                <Button
                  onClick={fillMemoryEmbeddings}
                  disabled={isFillingMemory || memoryMissingCount === 0}
                  size="sm"
                >
                  {isFillingMemory ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  補完実行
                </Button>
              </div>
              {isFillingMemory && memoryProgress.total > 0 && (
                <div className="space-y-1">
                  <Progress value={(memoryProgress.done / memoryProgress.total) * 100} />
                  <p className="text-xs text-muted-foreground text-right">
                    {memoryProgress.done} / {memoryProgress.total}
                  </p>
                </div>
              )}
              {fillResult?.memory && (
                <p className="text-sm text-muted-foreground">
                  前回結果: 成功 {fillResult.memory.success} 件, 失敗 {fillResult.memory.failed} 件
                </p>
              )}
            </div>

            {/* Knowledge Embedding */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Knowledge Embedding補完</p>
                  <p className="text-sm text-muted-foreground">
                    欠損: {knowledgeMissingCount ?? "..."} 件
                  </p>
                </div>
                <Button
                  onClick={fillKnowledgeEmbeddings}
                  disabled={isFillingKnowledge || knowledgeMissingCount === 0}
                  size="sm"
                >
                  {isFillingKnowledge ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  補完実行
                </Button>
              </div>
              {isFillingKnowledge && knowledgeProgress.total > 0 && (
                <div className="space-y-1">
                  <Progress value={(knowledgeProgress.done / knowledgeProgress.total) * 100} />
                  <p className="text-xs text-muted-foreground text-right">
                    {knowledgeProgress.done} / {knowledgeProgress.total}
                  </p>
                </div>
              )}
              {fillResult?.knowledge && (
                <p className="text-sm text-muted-foreground">
                  前回結果: 成功 {fillResult.knowledge.success} 件, 失敗 {fillResult.knowledge.failed} 件
                </p>
              )}
            </div>

            {/* Error Sources */}
            {errorSources.length > 0 && (
              <div className="space-y-3">
                <p className="font-medium text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  失敗ソース（{errorSources.length}件）
                </p>
                <div className="space-y-2">
                  {errorSources.map((source) => {
                    const meta = source.meta as Record<string, unknown> | null;
                    const errorMsg = meta?.error as string | undefined;
                    const isRetrying = retryingIds.has(source.id);

                    return (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{source.name}</p>
                          {errorMsg && (
                            <p className="text-xs text-destructive mt-1 line-clamp-1">{errorMsg}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retrySource(source.id)}
                          disabled={isRetrying}
                        >
                          {isRetrying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dify設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">エンドポイント</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">環境変数で設定</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">APIキー</span>
              <Badge variant="outline">Edge Functionで管理</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
