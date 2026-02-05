 import { useState } from "react";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Loader2 } from "lucide-react";
 import { knowledgeService } from "@/lib/services/knowledge";
 import { useToast } from "@/hooks/use-toast";
 
 interface AddNotionDialogProps {
   onSuccess: () => void;
   trigger: React.ReactNode;
 }
 
 export function AddNotionDialog({ onSuccess, trigger }: AddNotionDialogProps) {
   const { toast } = useToast();
   const [open, setOpen] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   const [name, setName] = useState("");
   const [pageId, setPageId] = useState("");
   const [accessToken, setAccessToken] = useState("");
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!name.trim() || !pageId.trim() || !accessToken.trim()) {
       toast({ title: "エラー", description: "すべての項目を入力してください", variant: "destructive" });
       return;
     }
 
     setIsLoading(true);
     try {
       await knowledgeService.addNotionSource({ name, pageId, accessToken });
       toast({ title: "追加完了", description: "Notionページの同期を開始しました" });
       setOpen(false);
       setName("");
       setPageId("");
       setAccessToken("");
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
     <Dialog open={open} onOpenChange={setOpen}>
       <DialogTrigger asChild>{trigger}</DialogTrigger>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle>Notionページを追加</DialogTitle>
         </DialogHeader>
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="name">ソース名</Label>
             <Input
               id="name"
               placeholder="例: プロジェクト仕様書"
               value={name}
               onChange={(e) => setName(e.target.value)}
             />
           </div>
           <div className="space-y-2">
             <Label htmlFor="pageId">ページID または URL</Label>
             <Input
               id="pageId"
               placeholder="例: https://notion.so/... または 32桁のID"
               value={pageId}
               onChange={(e) => setPageId(e.target.value)}
             />
             <p className="text-xs text-muted-foreground">
               NotionページのURLまたはページIDを入力してください
             </p>
           </div>
           <div className="space-y-2">
             <Label htmlFor="accessToken">Integration Token</Label>
             <Input
               id="accessToken"
               type="password"
               placeholder="secret_..."
               value={accessToken}
               onChange={(e) => setAccessToken(e.target.value)}
             />
             <p className="text-xs text-muted-foreground">
               <a
                 href="https://www.notion.so/my-integrations"
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-primary underline"
               >
                 Notion Integrations
               </a>
               で作成したInternal Integration Tokenを入力してください。
               ページへのアクセス権限を付与することを忘れずに。
             </p>
           </div>
           <div className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={() => setOpen(false)}>
               キャンセル
             </Button>
             <Button type="submit" disabled={isLoading}>
               {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               追加
             </Button>
           </div>
         </form>
       </DialogContent>
     </Dialog>
   );
 }