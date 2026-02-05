import { supabase } from "@/integrations/supabase/client";

export type SharedInsight = {
  id: string;
  project_id: string | null;
  topic: string;
  summary: string;
  tags: string[];
  source_conversation_id: string | null;
  source_message_ids: string[];
  created_by: string;
  contributors: string[];
  visibility: "org" | "project" | "private";
  status: "draft" | "submitted" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SharedInsightWithProfiles = SharedInsight & {
  creator_name?: string;
  approver_name?: string;
  contributor_names?: string[];
};

export type CreateInsightInput = {
  topic: string;
  summary: string;
  tags?: string[];
  contributors?: string[];
  visibility?: "org" | "project" | "private";
  projectId?: string | null;
};

export type UpdateInsightInput = {
  topic?: string;
  summary?: string;
  tags?: string[];
  contributors?: string[];
  visibility?: "org" | "project" | "private";
};

export const insightsService = {
  /**
   * List shared insights with optional filters
   */
  async listInsights(params?: {
    status?: string;
    createdBy?: string;
    projectId?: string | null;
    search?: string;
    limit?: number;
  }): Promise<SharedInsight[]> {
    let query = supabase
      .from("shared_insights")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(params?.limit ?? 50);

    if (params?.status) {
      query = query.eq("status", params.status);
    }
    if (params?.createdBy) {
      query = query.eq("created_by", params.createdBy);
    }
    if (params?.projectId) {
      query = query.eq("project_id", params.projectId);
    }
    if (params?.search) {
      query = query.or(`topic.ilike.%${params.search}%,summary.ilike.%${params.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as SharedInsight[];
  },

  /**
   * Get a single insight by ID
   */
  async getInsight(id: string): Promise<SharedInsight | null> {
    const { data, error } = await supabase
      .from("shared_insights")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data as SharedInsight;
  },

  /**
   * Create a new insight
   */
  async createInsight(input: CreateInsightInput): Promise<SharedInsight> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("shared_insights")
      .insert({
        topic: input.topic,
        summary: input.summary,
        tags: input.tags ?? [],
        contributors: input.contributors ?? [],
        visibility: input.visibility ?? "org",
        project_id: input.projectId ?? null,
        created_by: userData.user.id,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;
    return data as SharedInsight;
  },

  /**
   * Update an existing insight (draft only)
   */
  async updateInsight(id: string, input: UpdateInsightInput): Promise<SharedInsight> {
    const updates: Record<string, unknown> = {};
    if (input.topic !== undefined) updates.topic = input.topic;
    if (input.summary !== undefined) updates.summary = input.summary;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.contributors !== undefined) updates.contributors = input.contributors;
    if (input.visibility !== undefined) updates.visibility = input.visibility;

    const { data, error } = await supabase
      .from("shared_insights")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as SharedInsight;
  },

  /**
   * Submit an insight for approval
   */
  async submitInsight(id: string): Promise<SharedInsight> {
    // Generate embedding before submitting
    await this.generateEmbedding(id);

    const { data, error } = await supabase
      .from("shared_insights")
      .update({ status: "submitted" })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as SharedInsight;
  },

  /**
   * Approve an insight (admin only)
   */
  async approveInsight(id: string): Promise<SharedInsight> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("shared_insights")
      .update({
        status: "approved",
        approved_by: userData.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as SharedInsight;
  },

  /**
   * Reject an insight (admin only)
   */
  async rejectInsight(id: string, reason?: string): Promise<SharedInsight> {
    const { data, error } = await supabase
      .from("shared_insights")
      .update({
        status: "rejected",
        meta: { rejection_reason: reason ?? "" },
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as SharedInsight;
  },

  /**
   * Delete an insight
   */
  async deleteInsight(id: string): Promise<void> {
    const { error } = await supabase
      .from("shared_insights")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  /**
   * Generate embedding for an insight
   */
  async generateEmbedding(id: string): Promise<void> {
    const insight = await this.getInsight(id);
    if (!insight) throw new Error("Insight not found");

    const text = `${insight.topic}\n\n${insight.summary}`;

    // Call openai-embed edge function
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const SUPABASE_URL = "https://upscuqkxjvhzcriwljjl.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2N1cWt4anZoemNyaXdsampsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTYxMjksImV4cCI6MjA4NDA3MjEyOX0.jCF2wIOnjgq-xu5k-7ycRmZDnolLwDl2pgNg97Dh5bo";

    const res = await fetch(`${SUPABASE_URL}/functions/v1/openai-embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const raw = await res.text();
      throw new Error(`Embedding generation failed: ${raw}`);
    }

    const { embedding } = await res.json();
    if (!Array.isArray(embedding)) throw new Error("Invalid embedding response");

    // Update insight with embedding
    const embeddingStr = `[${embedding.join(",")}]`;
    const { error } = await supabase
      .from("shared_insights")
      .update({ embedding: embeddingStr })
      .eq("id", id);

    if (error) throw error;
  },
};
