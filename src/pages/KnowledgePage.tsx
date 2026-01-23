import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Search, FileText, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type KnowledgeSource = Tables<"knowledge_sources">;
type KnowledgeChunk = Tables<"knowledge_chunks">;

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

const statusLabels: Record<keyof typeof statusColors, string> = {
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
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("knowledge_sources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      toast({ title: "エラー", description: "ソースの取得に失敗", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const searchKnowledge = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("knowledge_chunks")
        .select("*")
        .ilike("content", `%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      toast({ title: "エラー", description: "検索に失敗", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full">
        <div className="flex-1 flex flex-col p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">ナレッジ</h1>
            <Button disabled>
              <Upload className="mr-2 h-4 w-4" />
              PDFアップロード（準備中）
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ソース（{sources.length}）</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : sources.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">ソースなし</p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">{source.name}</p>
                           <p className="text-xs text-muted-foreground">{sourceTypeLabels[source.type] ?? source.type}</p>
                        </div>
                      </div>
                       <Badge className={statusColors[source.status as keyof typeof statusColors]}>
                         {statusLabels[source.status as keyof typeof statusColors]}
                       </Badge>
                    </div>
                  ))}
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
                <Input placeholder="検索…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchKnowledge()} />
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
