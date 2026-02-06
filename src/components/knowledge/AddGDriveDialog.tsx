import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { knowledgeService } from "@/lib/services/knowledge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddGDriveDialogProps {
  onSuccess: () => void;
  trigger: React.ReactNode;
}

export function AddGDriveDialog({ onSuccess, trigger }: AddGDriveDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [name, setName] = useState("");
  const [fileId, setFileId] = useState("");

  // Check if user already has Drive access token on dialog open
  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const { data: { session } } = await supabase.auth.getSession();
      // Check if provider_token exists and has drive scope
      if (session?.provider_token) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/knowledge`,
          scopes: "https://www.googleapis.com/auth/drive.readonly",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
    } catch (error) {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "Google連携に失敗しました",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !fileId.trim()) {
      toast({ title: "エラー", description: "すべての項目を入力してください", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Get current session to retrieve provider_token
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;

      if (!providerToken) {
        toast({
          title: "エラー",
          description: "Googleアカウントとの連携が必要です。「Googleで連携」ボタンをクリックしてください。",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      await knowledgeService.addGDriveSource({ name, fileId, accessToken: providerToken });
      toast({ title: "追加完了", description: "Google Driveファイルの同期を開始しました" });
      setOpen(false);
      setName("");
      setFileId("");
      onSuccess();
    } catch (error) {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "追加に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Google Driveファイルを追加</DialogTitle>
          <DialogDescription>
            Google Driveのファイルをナレッジソースとして追加します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection status */}
          <div className="p-3 rounded-lg border border-border bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
              {isConnected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary">Google連携済み</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Googleアカウント未連携</span>
                  </>
                )}
              </div>
              {!isConnected && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnectGoogle}
                  disabled={isConnecting}
                >
                  {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Googleで連携
                </Button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gdrive-name">ソース名</Label>
              <Input
                id="gdrive-name"
                placeholder="例: プロジェクト仕様書"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gdrive-fileId">ファイルID または URL</Label>
              <Input
                id="gdrive-fileId"
                placeholder="例: https://drive.google.com/file/d/... または ファイルID"
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Google DriveのファイルURLまたはファイルIDを入力してください
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={isLoading || !isConnected}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                追加
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
