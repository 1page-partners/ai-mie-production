 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { useAuth } from "./useAuth";
 import {
   hasRole,
   setupService,
   decisionsService,
   principlesService,
   originFeedbackService,
   type SetupSession,
   type SetupAnswer,
   type OriginDecision,
   type OriginPrinciple,
 } from "@/lib/services/origin";
 
 // =============================================
 // Role Hooks
 // =============================================
 
 export function useIsOrigin() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ["isOrigin", user?.id],
     queryFn: () => hasRole("origin"),
     enabled: !!user,
     staleTime: 5 * 60 * 1000,
   });
 }
 
 // =============================================
 // Setup Session Hooks
 // =============================================
 
 export function useCurrentSetupSession() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ["setupSession", user?.id],
     queryFn: () => setupService.getCurrentSession(),
     enabled: !!user,
   });
 }
 
 export function useSetupAnswers(sessionId?: string) {
   return useQuery({
     queryKey: ["setupAnswers", sessionId],
     queryFn: () => setupService.getAnswers(sessionId!),
     enabled: !!sessionId,
   });
 }
 
 export function useCreateSetupSession() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: () => setupService.createSession(),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["setupSession"] });
     },
   });
 }
 
 export function useSaveSetupAnswer() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: ({
       sessionId,
       questionKey,
       answer,
     }: {
       sessionId: string;
       questionKey: string;
       answer: {
         answer_rule: string;
         answer_rationale?: string;
         answer_exceptions?: string;
         proposed_type?: "fact" | "preference" | "procedure" | "goal" | "context";
         proposed_confidence?: number;
       };
     }) => setupService.saveAnswer(sessionId, questionKey, answer),
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ["setupAnswers", variables.sessionId] });
     },
   });
 }
 
 export function useSubmitSetupSession() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: (sessionId: string) => setupService.submitSession(sessionId),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["setupSession"] });
     },
   });
 }
 
 // =============================================
 // Admin Setup Review Hooks
 // =============================================
 
 export function usePendingSetupSessions() {
   return useQuery({
     queryKey: ["pendingSetupSessions"],
     queryFn: () => setupService.listPendingSessions(),
   });
 }
 
 export function useApproveSetupSession() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: (sessionId: string) => setupService.approveSession(sessionId),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["pendingSetupSessions"] });
       queryClient.invalidateQueries({ queryKey: ["memories"] });
     },
   });
 }
 
 export function useRejectSetupSession() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: ({ sessionId, reason }: { sessionId: string; reason: string }) =>
       setupService.rejectSession(sessionId, reason),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["pendingSetupSessions"] });
     },
   });
 }
 
 // =============================================
 // Origin Decisions Hooks
 // =============================================
 
 export function useOriginDecisions() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ["originDecisions", user?.id],
     queryFn: () => decisionsService.list(),
     enabled: !!user,
   });
 }
 
 export function useSaveOriginDecision() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: ({
       incidentKey,
       decision,
     }: {
       incidentKey: string;
       decision: {
         decision: string;
         reasoning: string;
         context_conditions?: string;
         non_negotiables?: string;
         confidence?: number;
       };
     }) => decisionsService.save(incidentKey, decision),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["originDecisions"] });
       queryClient.invalidateQueries({ queryKey: ["originPrinciples"] });
     },
   });
 }
 
 // =============================================
 // Origin Principles Hooks
 // =============================================
 
 export function useOriginPrinciples() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ["originPrinciples", user?.id],
     queryFn: () => principlesService.list(),
     enabled: !!user,
   });
 }
 
 // =============================================
 // Origin Feedback Hooks
 // =============================================
 
 export function useSubmitOriginFeedback() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: (feedback: {
       title: string;
       content: string;
       type: "fact" | "preference" | "procedure" | "goal" | "context";
       confidence?: number;
     }) => originFeedbackService.submit(feedback),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["memories"] });
     },
   });
 }