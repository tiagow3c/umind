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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      consent_records: {
        Row: {
          created_at: string
          declared_by: string
          evidence_ref: string | null
          id: string
          meeting_id: string
          method: string
          notice_version: string
          participant_id: string | null
          recorded_at: string
          scope: string
          updated_at: string
          withdrawn_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          declared_by: string
          evidence_ref?: string | null
          id?: string
          meeting_id: string
          method: string
          notice_version: string
          participant_id?: string | null
          recorded_at?: string
          scope?: string
          updated_at?: string
          withdrawn_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          declared_by?: string
          evidence_ref?: string | null
          id?: string
          meeting_id?: string
          method?: string
          notice_version?: string
          participant_id?: string | null
          recorded_at?: string
          scope?: string
          updated_at?: string
          withdrawn_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_meeting_id_workspace_id_fkey"
            columns: ["meeting_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "consent_records_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          current_transcript_id: string | null
          deleted_at: string | null
          ended_at: string | null
          id: string
          owner_id: string
          scheduled_at: string | null
          source_type: string
          started_at: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          timezone: string
          title: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_transcript_id?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          owner_id: string
          scheduled_at?: string | null
          source_type?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          timezone?: string
          title: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_transcript_id?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          owner_id?: string
          scheduled_at?: string | null
          source_type?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          timezone?: string
          title?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          dispatched_at: string | null
          entity_id: string
          event_id: string
          occurred_at: string
          payload: Json
          trace_id: string
          type: string
          version: number
          workspace_id: string
        }
        Insert: {
          dispatched_at?: string | null
          entity_id: string
          event_id?: string
          occurred_at?: string
          payload?: Json
          trace_id?: string
          type: string
          version: number
          workspace_id: string
        }
        Update: {
          dispatched_at?: string | null
          entity_id?: string
          event_id?: string
          occurred_at?: string
          payload?: Json
          trace_id?: string
          type?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          meeting_id: string
          source: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          meeting_id: string
          source?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          meeting_id?: string
          source?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_meeting_id_workspace_id_fkey"
            columns: ["meeting_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      processing_runs: {
        Row: {
          attempt: number
          config_version: string
          created_at: string
          error_code: string | null
          id: string
          input_version: string
          lease_until: string | null
          meeting_id: string
          model_id: string | null
          provider: string | null
          recording_id: string
          stage: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempt?: number
          config_version: string
          created_at?: string
          error_code?: string | null
          id?: string
          input_version: string
          lease_until?: string | null
          meeting_id: string
          model_id?: string | null
          provider?: string | null
          recording_id: string
          stage: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempt?: number
          config_version?: string
          created_at?: string
          error_code?: string | null
          id?: string
          input_version?: string
          lease_until?: string | null
          meeting_id?: string
          model_id?: string | null
          provider?: string | null
          recording_id?: string
          stage?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_runs_meeting_id_workspace_id_fkey"
            columns: ["meeting_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      recording_parts: {
        Row: {
          bytes: number
          created_at: string
          end_ms: number
          id: string
          object_key: string
          recording_id: string
          sequence: number
          sha256: string
          start_ms: number
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bytes: number
          created_at?: string
          end_ms: number
          id?: string
          object_key: string
          recording_id: string
          sequence: number
          sha256: string
          start_ms: number
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bytes?: number
          created_at?: string
          end_ms?: number
          id?: string
          object_key?: string
          recording_id?: string
          sequence?: number
          sha256?: string
          start_ms?: number
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_parts_recording_id_workspace_id_fkey"
            columns: ["recording_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      recordings: {
        Row: {
          channels: number
          codec: string | null
          created_at: string
          device_id: string | null
          duration_ms: number | null
          finalized_at: string | null
          id: string
          manifest_hash: string | null
          meeting_id: string
          sample_rate: number | null
          source_type: string
          status: Database["public"]["Enums"]["recording_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channels?: number
          codec?: string | null
          created_at?: string
          device_id?: string | null
          duration_ms?: number | null
          finalized_at?: string | null
          id?: string
          manifest_hash?: string | null
          meeting_id: string
          sample_rate?: number | null
          source_type: string
          status?: Database["public"]["Enums"]["recording_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channels?: number
          codec?: string | null
          created_at?: string
          device_id?: string | null
          duration_ms?: number | null
          finalized_at?: string | null
          id?: string
          manifest_hash?: string | null
          meeting_id?: string
          sample_rate?: number | null
          source_type?: string
          status?: Database["public"]["Enums"]["recording_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_meeting_id_workspace_id_fkey"
            columns: ["meeting_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          retention_policy_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          retention_policy_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          retention_policy_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_meeting: { Args: { _meeting: string }; Returns: undefined }
      finalize_recording: {
        Args: {
          _duration_ms: number
          _manifest_hash: string
          _recording: string
        }
        Returns: Database["public"]["Enums"]["meeting_status"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: { Args: { _ws: string }; Returns: boolean }
      meeting_visible: { Args: { _meeting: string }; Returns: boolean }
      recording_visible: { Args: { _rec: string }; Returns: boolean }
      start_recording: {
        Args: {
          _channels: number
          _codec: string
          _device: string
          _meeting: string
          _source: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      job_status:
        | "queued"
        | "running"
        | "retry_wait"
        | "succeeded"
        | "failed"
        | "cancelled"
      meeting_status:
        | "draft"
        | "consent_pending"
        | "recording"
        | "paused"
        | "uploading"
        | "processing"
        | "review_ready"
        | "completed"
        | "failed"
        | "deleting"
        | "deleted"
      member_role: "owner" | "admin" | "member"
      recording_status:
        | "local_only"
        | "uploading"
        | "uploaded"
        | "partial"
        | "corrupt"
        | "deleted"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
      job_status: [
        "queued",
        "running",
        "retry_wait",
        "succeeded",
        "failed",
        "cancelled",
      ],
      meeting_status: [
        "draft",
        "consent_pending",
        "recording",
        "paused",
        "uploading",
        "processing",
        "review_ready",
        "completed",
        "failed",
        "deleting",
        "deleted",
      ],
      member_role: ["owner", "admin", "member"],
      recording_status: [
        "local_only",
        "uploading",
        "uploaded",
        "partial",
        "corrupt",
        "deleted",
      ],
    },
  },
} as const
