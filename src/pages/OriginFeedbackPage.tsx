 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Textarea } from "@/components/ui/textarea";
 import { Input } from "@/components/ui/input";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Slider } from "@/components/ui/slider";
 import { Send, AlertCircle, MessageSquarePlus } from "lucide-react";
 import { toast } from "sonner";
 import { useIsOrigin, useSubmitOriginFeedback } from "@/hooks/useOrigin";
 
 export default function OriginFeedbackPage() {
   const navigate = useNavigate();
   const { data: isOrigin, isLoading } = useIsOrigin();
   const submitFeedback = useSubmitOriginFeedback();
 
   const [formData, setFormData] = useState({
     title: "",
     content: "",
     type: "preference" as "fact" | "preference" | "procedure" | "goal" | "context",
     confidence: 0.85,
   });
 
   if (isLoading) {
     return (
       <AppLayout>
         <div className="flex h-full items-center justify-center">
           <div className="text-muted-foreground">読み込み中...</div>
         </div>
       </AppLayout>
     );
   }
 
   if (!isOrigin) {
     return (
       <AppLayout>
         <div className="flex h-full flex-col items-center justify-center gap-4">
           <AlertCircle className="h-12 w-12 text-destructive" />
           <h2 className="text-xl font-semibold">アクセス権限がありません</h2>
           <p className="text-muted-foreground">
             このページはOriginロールを持つユーザーのみアクセスできます。
           </p>
           <Button onClick={() => navigate("/chat")}>チャットに戻る</Button>
         </div>
       </AppLayout>
     );
   }
 
   const handleSubmit = async () => {
     if (!formData.title.trim() || !formData.content.trim()) {
       toast.error("タイトルと内容は必須です");
       return;
     }
 
     try {
       await submitFeedback.mutateAsync(formData);
       toast.success("フィードバックを送信しました（管理者の承認待ち）");
       setFormData({
         title: "",
         content: "",
         type: "preference",
         confidence: 0.85,
       });
     } catch (e) {
       toast.error("送信に失敗しました");
     }
   };
 
   return (
     <AppLayout>
       <div className="mx-auto max-w-2xl p-6">
         <div className="mb-6">
           <h1 className="text-2xl font-bold">Origin フィードバック</h1>
           <p className="text-muted-foreground">
             AI-MIEの判断基準を継続的に改善するためのフィードバックを送信できます
           </p>
         </div>
 
         <Card>
           <CardHeader>
             <div className="flex items-center gap-2">
               <MessageSquarePlus className="h-5 w-5 text-primary" />
               <CardTitle>新しいフィードバック</CardTitle>
             </div>
             <CardDescription>
               送信されたフィードバックは管理者の承認後、AI-MIEのメモリに追加されます
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="space-y-2">
               <label className="text-sm font-medium">タイトル</label>
               <Input
                 value={formData.title}
                 onChange={(e) =>
                   setFormData({ ...formData, title: e.target.value })
                 }
                 placeholder="フィードバックの要約..."
               />
             </div>
 
             <div className="space-y-2">
               <label className="text-sm font-medium">内容</label>
               <Textarea
                 value={formData.content}
                 onChange={(e) =>
                   setFormData({ ...formData, content: e.target.value })
                 }
                 placeholder="詳細なフィードバック内容..."
                 rows={6}
               />
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-sm font-medium">タイプ</label>
                 <Select
                   value={formData.type}
                   onValueChange={(v) =>
                     setFormData({ ...formData, type: v as typeof formData.type })
                   }
                 >
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="preference">嗜好</SelectItem>
                     <SelectItem value="procedure">手順</SelectItem>
                     <SelectItem value="goal">目標</SelectItem>
                     <SelectItem value="fact">事実</SelectItem>
                     <SelectItem value="context">文脈</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="space-y-2">
                 <label className="text-sm font-medium">
                   確信度: {Math.round(formData.confidence * 100)}%
                 </label>
                 <Slider
                   value={[formData.confidence]}
                   onValueChange={([v]) =>
                     setFormData({ ...formData, confidence: v })
                   }
                   min={0.5}
                   max={1}
                   step={0.05}
                 />
               </div>
             </div>
 
             <Button
               onClick={handleSubmit}
               disabled={submitFeedback.isPending}
               className="w-full"
             >
               <Send className="mr-2 h-4 w-4" />
               送信
             </Button>
           </CardContent>
         </Card>
       </div>
     </AppLayout>
   );
 }