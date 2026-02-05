  import { useState, useEffect } from "react";
 import { useNavigate } from "react-router-dom";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Textarea } from "@/components/ui/textarea";
 import { Badge } from "@/components/ui/badge";
 import { Slider } from "@/components/ui/slider";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Save, CheckCircle2, AlertCircle, Brain, Lightbulb } from "lucide-react";
 import { toast } from "sonner";
 import { useIsOrigin, useOriginDecisions, useSaveOriginDecision, useOriginPrinciples } from "@/hooks/useOrigin";
 import { INCIDENT_CASES } from "@/lib/services/origin";
 
 export default function OriginIncidentsPage() {
   const navigate = useNavigate();
   const { data: isOrigin, isLoading: isOriginLoading } = useIsOrigin();
   const { data: decisions = [] } = useOriginDecisions();
   const { data: principles = [] } = useOriginPrinciples();
   const saveDecision = useSaveOriginDecision();
 
    const [selectedCase, setSelectedCase] = useState<string>(INCIDENT_CASES[0].key);
   const [formData, setFormData] = useState({
     decision: "",
     reasoning: "",
     context_conditions: "",
     non_negotiables: "",
     confidence: 0.8,
   });
 
   const currentCase = INCIDENT_CASES.find((c) => c.key === selectedCase)!;
   const existingDecision = decisions.find((d) => d.incident_key === selectedCase);
 
    // Load existing decision when component mounts
    useEffect(() => {
      if (existingDecision) {
        setFormData({
          decision: existingDecision.decision,
          reasoning: existingDecision.reasoning,
          context_conditions: existingDecision.context_conditions ?? "",
          non_negotiables: existingDecision.non_negotiables ?? "",
          confidence: existingDecision.confidence,
        });
      }
    }, [existingDecision]);
 
   const handleCaseChange = (key: string) => {
     const existing = decisions.find((d) => d.incident_key === key);
     setSelectedCase(key);
     if (existing) {
       setFormData({
         decision: existing.decision,
         reasoning: existing.reasoning,
         context_conditions: existing.context_conditions ?? "",
         non_negotiables: existing.non_negotiables ?? "",
         confidence: existing.confidence,
       });
     } else {
       setFormData({
         decision: "",
         reasoning: "",
         context_conditions: "",
         non_negotiables: "",
         confidence: 0.8,
       });
     }
   };
 
   const handleSave = async () => {
     if (!formData.decision.trim() || !formData.reasoning.trim()) {
       toast.error("判断と理由は必須です");
       return;
     }
 
     try {
       await saveDecision.mutateAsync({
         incidentKey: selectedCase,
         decision: formData,
       });
       toast.success("保存しました（判断軸抽出中...）");
     } catch (e) {
       toast.error("保存に失敗しました");
     }
   };
 
   if (isOriginLoading) {
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
 
   const answeredCount = decisions.length;
 
   return (
     <AppLayout>
       <div className="flex h-full">
         {/* Left: Case List */}
         <div className="w-64 shrink-0 border-r p-4">
           <h2 className="mb-4 text-lg font-semibold">判断事例</h2>
           <p className="mb-4 text-sm text-muted-foreground">
             回答済み: {answeredCount} / {INCIDENT_CASES.length}
           </p>
           <div className="space-y-2">
             {INCIDENT_CASES.map((c) => {
               const isAnswered = decisions.some((d) => d.incident_key === c.key);
               return (
                 <button
                   key={c.key}
                   onClick={() => handleCaseChange(c.key)}
                   className={`w-full rounded-lg border p-3 text-left transition-colors ${
                     selectedCase === c.key
                       ? "border-primary bg-primary/5"
                       : "hover:bg-muted"
                   }`}
                 >
                   <div className="flex items-center gap-2">
                     {isAnswered && (
                       <CheckCircle2 className="h-4 w-4 text-green-500" />
                     )}
                     <span className="font-medium">{c.title}</span>
                   </div>
                   <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                     {c.description}
                   </p>
                 </button>
               );
             })}
           </div>
         </div>
 
         {/* Right: Form & Principles */}
         <div className="flex-1 overflow-auto p-6">
           <Tabs defaultValue="form">
             <TabsList className="mb-4">
               <TabsTrigger value="form">判断入力</TabsTrigger>
               <TabsTrigger value="principles">
                 抽出された判断軸
                 {principles.length > 0 && (
                   <Badge variant="secondary" className="ml-2">
                     {principles.length}
                   </Badge>
                 )}
               </TabsTrigger>
             </TabsList>
 
             <TabsContent value="form">
               <Card>
                 <CardHeader>
                   <div className="flex items-center gap-2">
                     <Badge variant="outline">{currentCase.key}</Badge>
                     {existingDecision && (
                       <Badge variant="secondary">回答済み</Badge>
                     )}
                   </div>
                   <CardTitle>{currentCase.title}</CardTitle>
                   <CardDescription>{currentCase.description}</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-sm font-medium">判断（必須）</label>
                     <Textarea
                       value={formData.decision}
                       onChange={(e) =>
                         setFormData({ ...formData, decision: e.target.value })
                       }
                       placeholder="この状況でどう判断しますか？"
                       rows={3}
                     />
                   </div>
 
                   <div className="space-y-2">
                     <label className="text-sm font-medium">理由（必須）</label>
                     <Textarea
                       value={formData.reasoning}
                       onChange={(e) =>
                         setFormData({ ...formData, reasoning: e.target.value })
                       }
                       placeholder="なぜその判断をしますか？"
                       rows={3}
                     />
                   </div>
 
                   <div className="space-y-2">
                     <label className="text-sm font-medium">文脈条件（任意）</label>
                     <Textarea
                       value={formData.context_conditions}
                       onChange={(e) =>
                         setFormData({
                           ...formData,
                           context_conditions: e.target.value,
                         })
                       }
                       placeholder="どのような状況でこの判断が適用されますか？"
                       rows={2}
                     />
                   </div>
 
                   <div className="space-y-2">
                     <label className="text-sm font-medium">譲れない点（任意）</label>
                     <Textarea
                       value={formData.non_negotiables}
                       onChange={(e) =>
                         setFormData({
                           ...formData,
                           non_negotiables: e.target.value,
                         })
                       }
                       placeholder="どんな状況でも変えられない点は？"
                       rows={2}
                     />
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
 
                   <Button
                     onClick={handleSave}
                     disabled={saveDecision.isPending}
                     className="w-full"
                   >
                     <Save className="mr-2 h-4 w-4" />
                     保存
                   </Button>
                 </CardContent>
               </Card>
             </TabsContent>
 
             <TabsContent value="principles">
               {principles.length === 0 ? (
                 <Card>
                   <CardContent className="flex flex-col items-center justify-center py-12">
                     <Brain className="h-12 w-12 text-muted-foreground" />
                     <h3 className="mt-4 font-semibold">まだ判断軸がありません</h3>
                     <p className="text-sm text-muted-foreground">
                       判断事例を入力すると、自動的に判断軸が抽出されます
                     </p>
                   </CardContent>
                 </Card>
               ) : (
                 <div className="space-y-4">
                   {principles.map((p) => (
                     <Card key={p.id}>
                       <CardHeader className="pb-2">
                         <div className="flex items-center gap-2">
                           <Lightbulb className="h-4 w-4 text-yellow-500" />
                           <Badge variant="outline">{p.principle_key}</Badge>
                           <Badge variant="secondary">
                             {Math.round(p.confidence * 100)}%
                           </Badge>
                         </div>
                         <CardTitle className="text-base">
                           {p.principle_label}
                         </CardTitle>
                       </CardHeader>
                       <CardContent>
                         <p className="text-sm">{p.description}</p>
                         {p.source_incident_ids.length > 0 && (
                           <p className="mt-2 text-xs text-muted-foreground">
                             抽出元: {p.source_incident_ids.length}件の判断事例
                           </p>
                         )}
                       </CardContent>
                     </Card>
                   ))}
                 </div>
               )}
             </TabsContent>
           </Tabs>
         </div>
       </div>
     </AppLayout>
   );
 }