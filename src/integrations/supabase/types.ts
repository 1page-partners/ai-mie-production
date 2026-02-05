export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          meta: Json
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          meta?: Json
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          meta?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          project_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string | null
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          meta: Json
          source_id: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          meta?: Json
          source_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          meta?: Json
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_refs: {
        Row: {
          assistant_message_id: string | null
          chunk_id: string
          conversation_id: string
          created_at: string
          id: string
          score: number | null
          source_id: string | null
          source_version: number | null
        }
        Insert: {
          assistant_message_id?: string | null
          chunk_id: string
          conversation_id: string
          created_at?: string
          id?: string
          score?: number | null
          source_id?: string | null
          source_version?: number | null
        }
        Update: {
          assistant_message_id?: string | null
          chunk_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          score?: number | null
          source_id?: string | null
          source_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_refs_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_refs_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_refs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_refs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          change_summary: string | null
          created_at: string
          external_id_or_path: string | null
          id: string
          last_synced_at: string | null
          meta: Json
          name: string
          project_id: string | null
          status: Database["public"]["Enums"]["ai_mie_knowledge_status"]
          type: Database["public"]["Enums"]["ai_mie_knowledge_source_type"]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          external_id_or_path?: string | null
          id?: string
          last_synced_at?: string | null
          meta?: Json
          name: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["ai_mie_knowledge_status"]
          type: Database["public"]["Enums"]["ai_mie_knowledge_source_type"]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          external_id_or_path?: string | null
          id?: string
          last_synced_at?: string | null
          meta?: Json
          name?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["ai_mie_knowledge_status"]
          type?: Database["public"]["Enums"]["ai_mie_knowledge_source_type"]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          confidence: number
          content: string
          created_at: string
          embedding: string | null
          episode_at: string | null
          id: string
          is_active: boolean
          pinned: boolean
          project_id: string | null
          rejected_reason: string | null
          reviewed_at: string | null
          source_message_id: string | null
          status: string
          title: string
          type: Database["public"]["Enums"]["ai_mie_memory_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          content: string
          created_at?: string
          embedding?: string | null
          episode_at?: string | null
          id?: string
          is_active?: boolean
          pinned?: boolean
          project_id?: string | null
          rejected_reason?: string | null
          reviewed_at?: string | null
          source_message_id?: string | null
          status?: string
          title: string
          type?: Database["public"]["Enums"]["ai_mie_memory_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          embedding?: string | null
          episode_at?: string | null
          id?: string
          is_active?: boolean
          pinned?: boolean
          project_id?: string | null
          rejected_reason?: string | null
          reviewed_at?: string | null
          source_message_id?: string | null
          status?: string
          title?: string
          type?: Database["public"]["Enums"]["ai_mie_memory_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_refs: {
        Row: {
          assistant_message_id: string | null
          conversation_id: string
          created_at: string
          id: string
          memory_id: string
          score: number | null
        }
        Insert: {
          assistant_message_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          memory_id: string
          score?: number | null
        }
        Update: {
          assistant_message_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          memory_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "memory_refs_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_refs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_refs_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      origin_decision_profiles: {
        Row: {
          abstracted_context: string | null
          created_at: string
          decision_id: string
          embedding: string | null
          extracted_logic: Json | null
          id: string
          raw_answer: Json
        }
        Insert: {
          abstracted_context?: string | null
          created_at?: string
          decision_id: string
          embedding?: string | null
          extracted_logic?: Json | null
          id?: string
          raw_answer: Json
        }
        Update: {
          abstracted_context?: string | null
          created_at?: string
          decision_id?: string
          embedding?: string | null
          extracted_logic?: Json | null
          id?: string
          raw_answer?: Json
        }
        Relationships: [
          {
            foreignKeyName: "origin_decision_profiles_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: true
            referencedRelation: "origin_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      origin_decisions: {
        Row: {
          confidence: number
          context_conditions: string | null
          created_at: string
          decision: string
          id: string
          incident_key: string
          non_negotiables: string | null
          reasoning: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          context_conditions?: string | null
          created_at?: string
          decision: string
          id?: string
          incident_key: string
          non_negotiables?: string | null
          reasoning: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          context_conditions?: string | null
          created_at?: string
          decision?: string
          id?: string
          incident_key?: string
          non_negotiables?: string | null
          reasoning?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      origin_principles: {
        Row: {
          confidence: number
          created_at: string
          description: string
          embedding: string | null
          id: string
          polarity: string | null
          principle_key: string
          principle_label: string
          source_incident_ids: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          description: string
          embedding?: string | null
          id?: string
          polarity?: string | null
          principle_key: string
          principle_label: string
          source_incident_ids?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          description?: string
          embedding?: string | null
          id?: string
          polarity?: string | null
          principle_key?: string
          principle_label?: string
          source_incident_ids?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_prefs: {
        Row: {
          allow_attribution: boolean
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_attribution?: boolean
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_attribution?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      setup_answers: {
        Row: {
          answer_exceptions: string | null
          answer_rationale: string | null
          answer_rule: string
          created_at: string
          id: string
          proposed_confidence: number
          proposed_type: Database["public"]["Enums"]["ai_mie_memory_type"]
          question_key: string
          question_text: string
          session_id: string
          updated_at: string
        }
        Insert: {
          answer_exceptions?: string | null
          answer_rationale?: string | null
          answer_rule: string
          created_at?: string
          id?: string
          proposed_confidence?: number
          proposed_type?: Database["public"]["Enums"]["ai_mie_memory_type"]
          question_key: string
          question_text: string
          session_id: string
          updated_at?: string
        }
        Update: {
          answer_exceptions?: string | null
          answer_rationale?: string | null
          answer_rule?: string
          created_at?: string
          id?: string
          proposed_confidence?: number
          proposed_type?: Database["public"]["Enums"]["ai_mie_memory_type"]
          question_key?: string
          question_text?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "setup_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_sessions: {
        Row: {
          created_at: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shared_insight_refs: {
        Row: {
          assistant_message_id: string | null
          conversation_id: string
          created_at: string
          id: string
          insight_id: string
          score: number | null
        }
        Insert: {
          assistant_message_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          insight_id: string
          score?: number | null
        }
        Update: {
          assistant_message_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          insight_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_insight_refs_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_insight_refs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_insight_refs_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "shared_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_insights: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contributors: string[]
          created_at: string
          created_by: string
          embedding: string | null
          id: string
          meta: Json
          project_id: string | null
          source_conversation_id: string | null
          source_message_ids: string[]
          status: string
          summary: string
          tags: string[]
          topic: string
          updated_at: string
          visibility: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contributors?: string[]
          created_at?: string
          created_by: string
          embedding?: string | null
          id?: string
          meta?: Json
          project_id?: string | null
          source_conversation_id?: string | null
          source_message_ids?: string[]
          status?: string
          summary: string
          tags?: string[]
          topic: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contributors?: string[]
          created_at?: string
          created_by?: string
          embedding?: string | null
          id?: string
          meta?: Json
          project_id?: string | null
          source_conversation_id?: string | null
          source_message_ids?: string[]
          status?: string
          summary?: string
          tags?: string[]
          topic?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_insights_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_daily_usage: {
        Args: { p_days?: number }
        Returns: {
          conversations: number
          date: string
          messages: number
          new_memories: number
        }[]
      }
      get_usage_stats: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          active_users: number
          approved_memories: number
          candidate_memories: number
          total_conversations: number
          total_knowledge_chunks: number
          total_knowledge_sources: number
          total_memories: number
          total_messages: number
          total_users: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_knowledge: {
        Args: {
          match_count?: number
          p_project_id?: string
          p_user_id?: string
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          meta: Json
          score: number
          source_id: string
          source_name: string
        }[]
      }
      match_memories: {
        Args: {
          match_count?: number
          min_confidence?: number
          p_project_id?: string
          p_user_id?: string
          query_embedding: string
        }
        Returns: {
          confidence: number
          content: string
          id: string
          pinned: boolean
          score: number
          title: string
          type: Database["public"]["Enums"]["ai_mie_memory_type"]
          updated_at: string
        }[]
      }
      match_origin_decisions: {
        Args: {
          match_count?: number
          p_user_id?: string
          query_embedding: string
        }
        Returns: {
          confidence: number
          context_conditions: string
          decision: string
          id: string
          incident_key: string
          non_negotiables: string
          reasoning: string
          score: number
        }[]
      }
      match_origin_principles: {
        Args: {
          match_count?: number
          p_user_id?: string
          query_embedding: string
        }
        Returns: {
          confidence: number
          description: string
          id: string
          polarity: string
          principle_key: string
          principle_label: string
          score: number
        }[]
      }
      match_shared_insights: {
        Args: {
          match_count?: number
          p_project_id?: string
          query_embedding: string
        }
        Returns: {
          contributors: string[]
          created_by: string
          id: string
          score: number
          summary: string
          tags: string[]
          topic: string
        }[]
      }
    }
    Enums: {
      ai_mie_knowledge_source_type: "gdocs" | "pdf" | "notion" | "gdrive"
      ai_mie_knowledge_status: "pending" | "processing" | "ready" | "error"
      ai_mie_memory_type:
        | "fact"
        | "preference"
        | "procedure"
        | "goal"
        | "context"
      app_role: "admin" | "user" | "origin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_mie_knowledge_source_type: ["gdocs", "pdf", "notion", "gdrive"],
      ai_mie_knowledge_status: ["pending", "processing", "ready", "error"],
      ai_mie_memory_type: [
        "fact",
        "preference",
        "procedure",
        "goal",
        "context",
      ],
      app_role: ["admin", "user", "origin"],
    },
  },
} as const
