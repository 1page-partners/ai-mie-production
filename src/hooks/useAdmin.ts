import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService, type AppRole, type UserWithProfile, type UsageStats, type DailyUsage } from "@/lib/services/admin";
import { useAuth } from "./useAuth";

export function useIsAdmin() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["isAdmin", user?.id],
    queryFn: () => adminService.isAdmin(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useMyRoles() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["myRoles", user?.id],
    queryFn: () => adminService.getMyRoles(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUsers() {
  const { data: isAdmin } = useIsAdmin();
  
  return useQuery<UserWithProfile[]>({
    queryKey: ["users"],
    queryFn: () => adminService.listUsers(),
    enabled: isAdmin === true,
  });
}

export function useGrantRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      adminService.grantRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useRevokeRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      adminService.revokeRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUsageStats(startDate?: Date, endDate?: Date) {
  const { data: isAdmin } = useIsAdmin();
  
  return useQuery<UsageStats | null>({
    queryKey: ["usageStats", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => adminService.getUsageStats(startDate, endDate),
    enabled: isAdmin === true,
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

export function useDailyUsage(days: number = 30) {
  const { data: isAdmin } = useIsAdmin();
  
  return useQuery<DailyUsage[]>({
    queryKey: ["dailyUsage", days],
    queryFn: () => adminService.getDailyUsage(days),
    enabled: isAdmin === true,
    refetchInterval: 60 * 1000,
  });
}
