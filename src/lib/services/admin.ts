import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "user";

export type UserRole = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
};

export type UserWithProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: AppRole[];
};

export type UsageStats = {
  total_users: number;
  active_users: number;
  total_conversations: number;
  total_messages: number;
  total_memories: number;
  approved_memories: number;
  candidate_memories: number;
  total_knowledge_sources: number;
  total_knowledge_chunks: number;
};

export type DailyUsage = {
  date: string;
  conversations: number;
  messages: number;
  new_memories: number;
};

export const adminService = {
  /**
   * Check if the current user has admin role
   */
  async isAdmin(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      console.error("Error checking admin role:", error);
      return false;
    }

    return !!data;
  },

  /**
   * Get current user's roles
   */
  async getMyRoles(): Promise<AppRole[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching roles:", error);
      return [];
    }

    return (data || []).map(r => r.role as AppRole);
  },

  /**
   * Get all users with their profiles and roles (admin only)
   */
  async listUsers(): Promise<UserWithProfile[]> {
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) throw profilesError;

    // Get all roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");

    if (rolesError) throw rolesError;

    // Merge profiles with roles
    return (profiles || []).map(p => ({
      user_id: p.user_id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      roles: (roles || [])
        .filter(r => r.user_id === p.user_id)
        .map(r => r.role as AppRole),
    }));
  },

  /**
   * Grant a role to a user (admin only)
   */
  async grantRole(userId: string, role: AppRole): Promise<void> {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role });

    if (error) {
      if (error.code === "23505") {
        // Duplicate key - role already exists
        return;
      }
      throw error;
    }
  },

  /**
   * Revoke a role from a user (admin only)
   */
  async revokeRole(userId: string, role: AppRole): Promise<void> {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);

    if (error) throw error;
  },

  /**
   * Get usage statistics (admin only)
   */
  async getUsageStats(startDate?: Date, endDate?: Date): Promise<UsageStats | null> {
    const { data, error } = await supabase.rpc("get_usage_stats", {
      p_start_date: startDate?.toISOString() ?? undefined,
      p_end_date: endDate?.toISOString() ?? undefined,
    });

    if (error) {
      console.error("Error fetching usage stats:", error);
      return null;
    }

    if (!data || data.length === 0) return null;

    const row = data[0];
    return {
      total_users: Number(row.total_users) || 0,
      active_users: Number(row.active_users) || 0,
      total_conversations: Number(row.total_conversations) || 0,
      total_messages: Number(row.total_messages) || 0,
      total_memories: Number(row.total_memories) || 0,
      approved_memories: Number(row.approved_memories) || 0,
      candidate_memories: Number(row.candidate_memories) || 0,
      total_knowledge_sources: Number(row.total_knowledge_sources) || 0,
      total_knowledge_chunks: Number(row.total_knowledge_chunks) || 0,
    };
  },

  /**
   * Get daily usage for charts (admin only)
   */
  async getDailyUsage(days: number = 30): Promise<DailyUsage[]> {
    const { data, error } = await supabase.rpc("get_daily_usage", {
      p_days: days,
    });

    if (error) {
      console.error("Error fetching daily usage:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      date: row.date,
      conversations: Number(row.conversations) || 0,
      messages: Number(row.messages) || 0,
      new_memories: Number(row.new_memories) || 0,
    }));
  },
};
