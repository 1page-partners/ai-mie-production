import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { insightsService, type SharedInsight, type CreateInsightInput, type UpdateInsightInput } from "@/lib/services/insights";
import { useToast } from "@/hooks/use-toast";

export function useInsights(params?: {
  status?: string;
  createdBy?: string;
  projectId?: string | null;
  search?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["insights", params?.status, params?.createdBy, params?.projectId, params?.search];

  const {
    data: insights = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => insightsService.listInsights(params),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateInsightInput) => insightsService.createInsight(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      toast({ title: "作成完了", description: "共有知を作成しました" });
    },
    onError: (err: Error) => {
      toast({ title: "エラー", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInsightInput }) =>
      insightsService.updateInsight(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      toast({ title: "更新完了", description: "共有知を更新しました" });
    },
    onError: (err: Error) => {
      toast({ title: "エラー", description: err.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => insightsService.submitInsight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      toast({ title: "提出完了", description: "承認申請を送信しました" });
    },
    onError: (err: Error) => {
      toast({ title: "エラー", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => insightsService.approveInsight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      toast({ title: "承認完了", description: "共有知を承認しました" });
    },
    onError: (err: Error) => {
      toast({ title: "エラー", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      insightsService.rejectInsight(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      toast({ title: "却下完了", description: "共有知を却下しました" });
    },
    onError: (err: Error) => {
      toast({ title: "エラー", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => insightsService.deleteInsight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      toast({ title: "削除完了", description: "共有知を削除しました" });
    },
    onError: (err: Error) => {
      toast({ title: "エラー", description: err.message, variant: "destructive" });
    },
  });

  return {
    insights,
    isLoading,
    error,
    refetch,
    createInsight: createMutation.mutate,
    updateInsight: updateMutation.mutate,
    submitInsight: submitMutation.mutate,
    approveInsight: approveMutation.mutate,
    rejectInsight: rejectMutation.mutate,
    deleteInsight: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isSubmitting: submitMutation.isPending,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useInsightDetail(id: string | null) {
  const queryClient = useQueryClient();

  const {
    data: insight,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["insight", id],
    queryFn: () => (id ? insightsService.getInsight(id) : null),
    enabled: !!id,
  });

  return {
    insight,
    isLoading,
    error,
    refetch,
  };
}
