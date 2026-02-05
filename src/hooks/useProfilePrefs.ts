import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profilePrefsService, type ProfilePrefs } from "@/lib/services/profilePrefs";
import { useToast } from "@/hooks/use-toast";

export function useProfilePrefs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: prefs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["profile-prefs"],
    queryFn: () => profilePrefsService.getPrefs(),
  });

  const setAttributionMutation = useMutation({
    mutationFn: (allow: boolean) => profilePrefsService.setAllowAttribution(allow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-prefs"] });
      toast({ title: "設定更新", description: "人名公開設定を更新しました" });
    },
    onError: (err: Error) => {
      toast({ title: "エラー", description: err.message, variant: "destructive" });
    },
  });

  return {
    prefs,
    isLoading,
    error,
    refetch,
    allowAttribution: prefs?.allow_attribution ?? false,
    setAllowAttribution: setAttributionMutation.mutate,
    isUpdating: setAttributionMutation.isPending,
  };
}
