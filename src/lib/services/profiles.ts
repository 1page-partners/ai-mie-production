import { supabase } from "@/integrations/supabase/client";

type ProfileUpsert = {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

export const profilesService = {
  async upsertProfile(input: ProfileUpsert) {
    // NOTE: Supabase types may not include 'profiles' yet; keep this call flexible.
    const { error } = await (supabase as any)
      .from("profiles")
      .upsert(
        {
          user_id: input.user_id,
          display_name: input.display_name ?? null,
          avatar_url: input.avatar_url ?? null,
        },
        { onConflict: "user_id" }
      );

    if (error) throw error;
  },
};
