import { supabase } from "@/integrations/supabase/client";

export const authService = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/chat" },
    });
    if (error) throw error;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
