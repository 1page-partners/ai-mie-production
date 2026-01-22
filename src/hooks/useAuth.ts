import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { profilesService } from "@/lib/services/profiles";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastProfileUpsertUserId = useRef<string | null>(null);

  const upsertProfileFromUser = async (u: User) => {
    // Avoid repeated upserts on token refresh etc.
    if (lastProfileUpsertUserId.current === u.id) return;
    lastProfileUpsertUserId.current = u.id;

    const displayName =
      (u.user_metadata?.full_name as string | undefined) ??
      (u.user_metadata?.name as string | undefined) ??
      null;
    const avatarUrl =
      (u.user_metadata?.avatar_url as string | undefined) ??
      (u.user_metadata?.picture as string | undefined) ??
      null;

    try {
      await profilesService.upsertProfile({
        user_id: u.id,
        display_name: displayName,
        avatar_url: avatarUrl,
      });
    } catch (e) {
      // Don't block auth if profile upsert fails; log for debugging.
      console.warn("profiles upsert failed", e);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) void upsertProfileFromUser(session.user);
        setLoading(false);
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) void upsertProfileFromUser(session.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: window.location.origin,
      }
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/chat",
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user,
  };
}
