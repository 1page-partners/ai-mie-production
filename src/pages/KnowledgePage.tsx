import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { knowledgeService, type KnowledgeSource, type KnowledgeChunk } from "@/lib/services/knowledge";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Upload, Search, FileText, Loader2, RefreshCw, AlertCircle } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  pending: "待機",
  processing: "処理中",
  ready: "準備完了",
  error: "エラー",
};

const sourceTypeLabels: Record<string, string> = {
  pdf: "PDF",
  gdocs: "Google Docs",
  notion: "Notion",
};

export default function KnowledgePage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSources();
  }, []);

  // Polling for processing sources
  useEffect(() => {
    const processingIds = sources.filter((s) => s.status === "processing" || s.status === "pending").map((s) => s.id);
    if (processingIds.length === 0) return;

    const interval = setInterval(() => {
      loadSources();
    }, 5000);

    return () => clearInterval(interval);
  }, [sources]);

  const loadSources = async () => {
    setIsLoading(true);
    try {
      const data = await knowledgeService.listSources();
      setSources(data);
    } catch (error) {
      toast({ title: "エラー", description: "ソースの取得に失敗", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "エラー", description: "PDFファイルのみアップロード可能です", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      await knowledgeService.uploadPdf(file);
      toast({ title: "アップロード完了", description: "処理を開始しました" });
      loadSources();
    } catch (error) {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "アップロードに失敗",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSync = async (sourceId: string) => {
    setSyncingIds((prev) => new Set(prev).add(sourceId));
    try {
      await knowledgeService.syncSource(sourceId);
      toast({ title: "同期開始", description: "処理を開始しました" });
      loadSources();
    } catch (error) {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "同期に失敗",
        variant: "destructive",
      });
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  const searchKnowledge = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const data = await knowledgeService.searchChunks(searchQuery);
      setSearchResults(data);
    } catch (error) {
      toast({ title: "エラー", description: "検索に失敗", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const getSourceMeta = (source: KnowledgeSource) => {
    const meta = source.meta as Record<string, unknown> | null;
    if (!meta) return null;

    const chunks = meta.chunks_count as number | undefined;
    const error = meta.error as string | undefined;

    return { chunks, error };
  };

  return (
    <AppLayout>
      <div className="flex h-full">
        <div className="flex-1 flex flex-col p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">ナレッジ</h1>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                PDFアップロード
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ソース（{sources.length}）</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && sources.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : sources.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">ソースなし</p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => {
                    const meta = getSourceMeta(source);
                    const isSyncing = syncingIds.has(source.id) || source.status === "processing";

                    return (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">{source.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{sourceTypeLabels[source.type] ?? source.type}</span>
                              {meta?.chunks && <span>・{meta.chunks}チャンク</span>}
                              {source.last_synced_at && (
                                <span>・{new Date(source.last_synced_at).toLocaleString()}</span>
                              )}
                            </div>
                            {source.status === "error" && meta?.error && (
                              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {meta.error.slice(0, 100)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[source.status] ?? "bg-gray-100"}>
                            {statusLabels[source.status] ?? source.status}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSync(source.id)}
                            disabled={isSyncing}
                            title="再同期"
                          >
                            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">検索</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="検索…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchKnowledge()}
                />
                <Button onClick={searchKnowledge} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <ScrollArea className="h-64">
                {searchResults.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">結果なし</p>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((chunk) => (
                      <div key={chunk.id} className="p-3 rounded-lg border border-border">
                        <p className="text-sm text-foreground line-clamp-3">{chunk.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">チャンク #{chunk.chunk_index}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
