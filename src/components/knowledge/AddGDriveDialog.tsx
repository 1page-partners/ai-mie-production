 import { useState } from "react";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Loader2 } from "lucide-react";
 import { knowledgeService } from "@/lib/services/knowledge";
 import { useToast } from "@/hooks/use-toast";
 
 interface AddGDriveDialogProps {
   onSuccess: () => void;
   trigger: React.ReactNode;
 }
 
 export function AddGDriveDialog({ onSuccess, trigger }: AddGDriveDialogProps) {
   const { toast } = useToast();
   const [open, setOpen] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   const [name, setName] = useState("");
   const [fileId, setFileId] = useState("");
   const [accessToken, setAccessToken] = useState("");
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!name.trim() || !fileId.trim() || !accessToken.trim()) {
       toast({ title: "エラー", description: "すべての項目を入力してください", variant: "destructive" });
       return;
     }
 
     setIsLoading(true);
     try {
       await knowledgeService.addGDriveSource({ name, fileId, accessToken });
       toast({ title: "追加完了", description: "Google Driveファイルの同期を開始しました" });
       setOpen(false);
       setName("");
       setFileId("");
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
           <DialogTitle>Google Driveファイルを追加</DialogTitle>
         </DialogHeader>
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
           <div className="space-y-2">
             <Label htmlFor="gdrive-accessToken">アクセストークン</Label>
             <Input
               id="gdrive-accessToken"
               type="password"
               placeholder="OAuth 2.0 アクセストークン"
               value={accessToken}
               onChange={(e) => setAccessToken(e.target.value)}
             />
             <p className="text-xs text-muted-foreground">
               Google OAuth 2.0で取得したアクセストークンを入力してください。
               対象ファイルへの読み取り権限が必要です。
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