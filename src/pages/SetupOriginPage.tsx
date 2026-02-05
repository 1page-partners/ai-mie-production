 import { useState, useEffect } from "react";
 import { useNavigate } from "react-router-dom";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Textarea } from "@/components/ui/textarea";
 import { Progress } from "@/components/ui/progress";
 import { Badge } from "@/components/ui/badge";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Slider } from "@/components/ui/slider";
 import { ChevronLeft, ChevronRight, Save, Send, CheckCircle2, AlertCircle } from "lucide-react";
 import { toast } from "sonner";
 import {
   useIsOrigin,
   useCurrentSetupSession,
   useSetupAnswers,
   useCreateSetupSession,
   useSaveSetupAnswer,
   useSubmitSetupSession,
 } from "@/hooks/useOrigin";
 import { SETUP_QUESTIONS } from "@/lib/services/origin";
 
 export default function SetupOriginPage() {
   const navigate = useNavigate();
   const { data: isOrigin, isLoading: isOriginLoading } = useIsOrigin();
   const { data: session, isLoading: sessionLoading } = useCurrentSetupSession();
   const { data: answers = [] } = useSetupAnswers(session?.id);
   const createSession = useCreateSetupSession();
   const saveAnswer = useSaveSetupAnswer();
   const submitSession = useSubmitSetupSession();
 
   const [currentIndex, setCurrentIndex] = useState(0);
   const [formData, setFormData] = useState<{
     answer_rule: string;
     answer_rationale: string;
     answer_exceptions: string;
     proposed_type: "fact" | "preference" | "procedure" | "goal" | "context";
     proposed_confidence: number;
   }>({
     answer_rule: "",
     answer_rationale: "",
     answer_exceptions: "",
     proposed_type: "procedure",
     proposed_confidence: 0.9,
   });
 
   const currentQuestion = SETUP_QUESTIONS[currentIndex];
   const progress = ((currentIndex + 1) / SETUP_QUESTIONS.length) * 100;
 
   // Load existing answer when question changes
   useEffect(() => {
     const existing = answers.find((a) => a.question_key === currentQuestion?.key);
     if (existing) {
       setFormData({
         answer_rule: existing.answer_rule,
         answer_rationale: existing.answer_rationale ?? "",
         answer_exceptions: existing.answer_exceptions ?? "",
         proposed_type: existing.proposed_type,
         proposed_confidence: existing.proposed_confidence,
       });
     } else {
       setFormData({
         answer_rule: "",
         answer_rationale: "",
         answer_exceptions: "",
         proposed_type: "procedure",
         proposed_confidence: 0.9,
       });
     }
   }, [currentIndex, answers, currentQuestion]);
 
   // Create session if needed
   useEffect(() => {
     if (!sessionLoading && !session && isOrigin) {
       createSession.mutate();
     }
   }, [sessionLoading, session, isOrigin]);
 
   if (isOriginLoading || sessionLoading) {
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
 
   if (session?.status === "submitted") {
     return (
       <AppLayout>
         <div className="flex h-full flex-col items-center justify-center gap-4">
           <CheckCircle2 className="h-12 w-12 text-primary" />
           <h2 className="text-xl font-semibold">セットアップ完了</h2>
           <p className="text-muted-foreground">
             回答は提出済みです。管理者の承認をお待ちください。
           </p>
           <Button onClick={() => navigate("/chat")}>チャットに戻る</Button>
         </div>
       </AppLayout>
     );
   }
 
   if (session?.status === "approved") {
     return (
       <AppLayout>
         <div className="flex h-full flex-col items-center justify-center gap-4">
           <CheckCircle2 className="h-12 w-12 text-green-500" />
           <h2 className="text-xl font-semibold">憲法が確定しました</h2>
           <p className="text-muted-foreground">
             あなたの回答は承認され、AI-MIEの基本方針として登録されました。
           </p>
           <Button onClick={() => navigate("/chat")}>チャットに戻る</Button>
         </div>
       </AppLayout>
     );
   }
 
   const handleSave = async () => {
     if (!session || !formData.answer_rule.trim()) {
       toast.error("回答（必須）を入力してください");
       return;
     }
 
     try {
       await saveAnswer.mutateAsync({
         sessionId: session.id,
         questionKey: currentQuestion.key,
         answer: formData,
       });
       toast.success("保存しました");
     } catch (e) {
       toast.error("保存に失敗しました");
     }
   };
 
   const handleNext = async () => {
     await handleSave();
     if (currentIndex < SETUP_QUESTIONS.length - 1) {
       setCurrentIndex(currentIndex + 1);
     }
   };
 
   const handlePrev = () => {
     if (currentIndex > 0) {
       setCurrentIndex(currentIndex - 1);
     }
   };
 
   const handleSubmit = async () => {
     if (!session) return;
 
     // Check all questions answered
     if (answers.length < SETUP_QUESTIONS.length) {
       toast.error("すべての質問に回答してください");
       return;
     }
 
     try {
       await submitSession.mutateAsync(session.id);
       toast.success("提出しました");
     } catch (e) {
       toast.error("提出に失敗しました");
     }
   };
 
   const answeredCount = answers.length;
 
   return (
     <AppLayout>
       <div className="mx-auto max-w-3xl p-6">
         <div className="mb-6">
           <h1 className="text-2xl font-bold">AI-MIE セットアップ</h1>
           <p className="text-muted-foreground">
             AI-MIEの基本方針（憲法）を定義する12の質問に回答してください
           </p>
         </div>
 
         <div className="mb-6 space-y-2">
           <div className="flex items-center justify-between text-sm">
             <span>
               質問 {currentIndex + 1} / {SETUP_QUESTIONS.length}
             </span>
             <span className="text-muted-foreground">
               回答済み: {answeredCount} / {SETUP_QUESTIONS.length}
             </span>
           </div>
           <Progress value={progress} className="h-2" />
         </div>
 
         <Card>
           <CardHeader>
             <div className="flex items-center gap-2">
               <Badge variant="outline">{currentQuestion.key}</Badge>
             </div>
             <CardTitle className="text-lg">{currentQuestion.text}</CardTitle>
             <CardDescription>
               この回答はAI-MIEの判断基準として常時参照されます
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="space-y-2">
               <label className="text-sm font-medium">回答（必須）</label>
               <Textarea
                 value={formData.answer_rule}
                 onChange={(e) =>
                   setFormData({ ...formData, answer_rule: e.target.value })
                 }
                 placeholder="基本的なルールや方針を記述してください..."
                 rows={4}
               />
             </div>
 
             <div className="space-y-2">
               <label className="text-sm font-medium">理由・背景（任意）</label>
               <Textarea
                 value={formData.answer_rationale}
                 onChange={(e) =>
                   setFormData({ ...formData, answer_rationale: e.target.value })
                 }
                 placeholder="なぜそのような方針にしたのか..."
                 rows={2}
               />
             </div>
 
             <div className="space-y-2">
               <label className="text-sm font-medium">例外（任意）</label>
               <Textarea
                 value={formData.answer_exceptions}
                 onChange={(e) =>
                   setFormData({ ...formData, answer_exceptions: e.target.value })
                 }
                 placeholder="この方針が適用されない例外的な状況..."
                 rows={2}
               />
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-sm font-medium">メモリタイプ</label>
                 <Select
                   value={formData.proposed_type}
                   onValueChange={(v) =>
                     setFormData({
                       ...formData,
                       proposed_type: v as typeof formData.proposed_type,
                     })
                   }
                 >
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="procedure">手順</SelectItem>
                     <SelectItem value="preference">嗜好</SelectItem>
                     <SelectItem value="goal">目標</SelectItem>
                     <SelectItem value="fact">事実</SelectItem>
                     <SelectItem value="context">文脈</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="space-y-2">
                 <label className="text-sm font-medium">
                   確信度: {Math.round(formData.proposed_confidence * 100)}%
                 </label>
                 <Slider
                   value={[formData.proposed_confidence]}
                   onValueChange={([v]) =>
                     setFormData({ ...formData, proposed_confidence: v })
                   }
                   min={0.5}
                   max={1}
                   step={0.05}
                 />
               </div>
             </div>
           </CardContent>
         </Card>
 
         <div className="mt-6 flex items-center justify-between">
           <Button
             variant="outline"
             onClick={handlePrev}
             disabled={currentIndex === 0}
           >
             <ChevronLeft className="mr-2 h-4 w-4" />
             前へ
           </Button>
 
           <div className="flex gap-2">
             <Button variant="secondary" onClick={handleSave} disabled={saveAnswer.isPending}>
               <Save className="mr-2 h-4 w-4" />
               保存
             </Button>
 
             {currentIndex === SETUP_QUESTIONS.length - 1 ? (
               <Button
                 onClick={handleSubmit}
                 disabled={answeredCount < SETUP_QUESTIONS.length || submitSession.isPending}
               >
                 <Send className="mr-2 h-4 w-4" />
                 提出
               </Button>
             ) : (
               <Button onClick={handleNext}>
                 次へ
                 <ChevronRight className="ml-2 h-4 w-4" />
               </Button>
             )}
           </div>
         </div>
       </div>
     </AppLayout>
   );
 }