import { supabase } from "@/integrations/supabase/client";

export type ProfilePrefs = {
  user_id: string;
  allow_attribution: boolean;
  created_at: string;
  updated_at: string;
};

export const profilePrefsService = {
  /**
   * Get profile prefs for the current user
   */
  async getPrefs(): Promise<ProfilePrefs | null> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;

    const { data, error } = await supabase
      .from("profile_prefs")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) throw error;
    return data as ProfilePrefs | null;
  },

  /**
   * Create or update profile prefs
   */
  async upsertPrefs(allowAttribution: boolean): Promise<ProfilePrefs> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("profile_prefs")
      .upsert(
        {
          user_id: userData.user.id,
          allow_attribution: allowAttribution,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return data as ProfilePrefs;
  },

  /**
   * Update allow_attribution setting
   */
  async setAllowAttribution(allow: boolean): Promise<ProfilePrefs> {
    return this.upsertPrefs(allow);
  },
};
