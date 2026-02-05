 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Textarea } from "@/components/ui/textarea";
 import { Badge } from "@/components/ui/badge";
 import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
 import { Check, X, AlertCircle, FileText, Clock } from "lucide-react";
 import { toast } from "sonner";
 import { useIsAdmin } from "@/hooks/useAdmin";
 import { usePendingSetupSessions, useApproveSetupSession, useRejectSetupSession } from "@/hooks/useOrigin";
 
 export default function SetupReviewPage() {
   const navigate = useNavigate();
   const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
   const { data: sessions = [], isLoading: sessionsLoading } = usePendingSetupSessions();
   const approveSession = useApproveSetupSession();
   const rejectSession = useRejectSetupSession();
 
   const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
   const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
   const [rejectReason, setRejectReason] = useState("");
 
   if (isAdminLoading || sessionsLoading) {
     return (
       <AppLayout>
         <div className="flex h-full items-center justify-center">
           <div className="text-muted-foreground">読み込み中...</div>
         </div>
       </AppLayout>
     );
   }
 
   if (!isAdmin) {
     return (
       <AppLayout>
         <div className="flex h-full flex-col items-center justify-center gap-4">
           <AlertCircle className="h-12 w-12 text-destructive" />
           <h2 className="text-xl font-semibold">アクセス権限がありません</h2>
           <p className="text-muted-foreground">
             このページは管理者のみアクセスできます。
           </p>
           <Button onClick={() => navigate("/chat")}>チャットに戻る</Button>
         </div>
       </AppLayout>
     );
   }
 
   const handleApprove = async (sessionId: string) => {
     try {
       await approveSession.mutateAsync(sessionId);
       toast.success("セッションを承認しました");
     } catch (e) {
       toast.error("承認に失敗しました");
     }
   };
 
   const handleRejectClick = (sessionId: string) => {
     setSelectedSessionId(sessionId);
     setRejectReason("");
     setRejectDialogOpen(true);
   };
 
   const handleRejectConfirm = async () => {
     if (!selectedSessionId) return;
 
     try {
       await rejectSession.mutateAsync({
         sessionId: selectedSessionId,
         reason: rejectReason,
       });
       toast.success("セッションを却下しました");
       setRejectDialogOpen(false);
     } catch (e) {
       toast.error("却下に失敗しました");
     }
   };
 
   return (
     <AppLayout>
       <div className="mx-auto max-w-4xl p-6">
         <div className="mb-6">
           <h1 className="text-2xl font-bold">セットアップ審査</h1>
           <p className="text-muted-foreground">
             Originユーザーから提出されたセットアップ回答を審査します
           </p>
         </div>
 
         {sessions.length === 0 ? (
           <Card>
             <CardContent className="flex flex-col items-center justify-center py-12">
               <Clock className="h-12 w-12 text-muted-foreground" />
               <h3 className="mt-4 font-semibold">審査待ちのセッションはありません</h3>
               <p className="text-sm text-muted-foreground">
                 Originユーザーがセットアップを完了すると、ここに表示されます
               </p>
             </CardContent>
           </Card>
         ) : (
           <div className="space-y-6">
             {sessions.map((session) => (
               <Card key={session.id}>
                 <CardHeader>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <FileText className="h-5 w-5 text-primary" />
                       <CardTitle>セットアップ回答</CardTitle>
                       <Badge variant="secondary">
                         {session.answers.length}件の回答
                       </Badge>
                     </div>
                     <div className="flex gap-2">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleRejectClick(session.id)}
                       >
                         <X className="mr-2 h-4 w-4" />
                         却下
                       </Button>
                       <Button
                         size="sm"
                         onClick={() => handleApprove(session.id)}
                         disabled={approveSession.isPending}
                       >
                         <Check className="mr-2 h-4 w-4" />
                         承認
                       </Button>
                     </div>
                   </div>
                   <CardDescription>
                     提出日時:{" "}
                     {session.submitted_at
                       ? new Date(session.submitted_at).toLocaleString("ja-JP")
                       : "不明"}
                   </CardDescription>
                 </CardHeader>
                 <CardContent>
                   <Accordion type="multiple" className="w-full">
                     {session.answers.map((answer, index) => (
                       <AccordionItem key={answer.id} value={answer.id}>
                         <AccordionTrigger className="text-left">
                           <div className="flex items-center gap-2">
                             <Badge variant="outline" className="shrink-0">
                               {answer.question_key}
                             </Badge>
                             <span className="truncate">{answer.question_text}</span>
                           </div>
                         </AccordionTrigger>
                         <AccordionContent className="space-y-3">
                           <div>
                             <h4 className="text-sm font-medium text-muted-foreground">
                               回答
                             </h4>
                             <p className="mt-1 whitespace-pre-wrap">
                               {answer.answer_rule}
                             </p>
                           </div>
                           {answer.answer_rationale && (
                             <div>
                               <h4 className="text-sm font-medium text-muted-foreground">
                                 理由
                               </h4>
                               <p className="mt-1 whitespace-pre-wrap">
                                 {answer.answer_rationale}
                               </p>
                             </div>
                           )}
                           {answer.answer_exceptions && (
                             <div>
                               <h4 className="text-sm font-medium text-muted-foreground">
                                 例外
                               </h4>
                               <p className="mt-1 whitespace-pre-wrap">
                                 {answer.answer_exceptions}
                               </p>
                             </div>
                           )}
                           <div className="flex gap-4 text-sm text-muted-foreground">
                             <span>タイプ: {answer.proposed_type}</span>
                             <span>
                               確信度: {Math.round(answer.proposed_confidence * 100)}%
                             </span>
                           </div>
                         </AccordionContent>
                       </AccordionItem>
                     ))}
                   </Accordion>
                 </CardContent>
               </Card>
             ))}
           </div>
         )}
 
         <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>セッションを却下</DialogTitle>
               <DialogDescription>
                 却下の理由を入力してください。Originユーザーに通知されます。
               </DialogDescription>
             </DialogHeader>
             <Textarea
               value={rejectReason}
               onChange={(e) => setRejectReason(e.target.value)}
               placeholder="却下理由..."
               rows={4}
             />
             <DialogFooter>
               <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                 キャンセル
               </Button>
               <Button
                 variant="destructive"
                 onClick={handleRejectConfirm}
                 disabled={rejectSession.isPending}
               >
                 却下
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
       </div>
     </AppLayout>
   );
 }