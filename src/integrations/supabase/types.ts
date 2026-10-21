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
      analyses: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          model_id: string
          partial: boolean
          schema_version: string
          stale: boolean
          summary: string
          transcript_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          model_id: string
          partial?: boolean
          schema_version: string
          stale?: boolean
          summary: string
          transcript_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          model_id?: string
          partial?: boolean
          schema_version?: string
          stale?: boolean
          summary?: string
          transcript_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_meeting_id_workspace_id_fkey"
            columns: ["meeting_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "analyses_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_items: {
        Row: {
          analysis_id: string
          created_at: string
          embedding: unknown
          evidence_segment_ids: string[]
          id: string
          kind: string
          meeting_id: string
          position: number
          text: string
          workspace_id: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          embedding?: unknown
          evidence_segment_ids?: string[]
          id?: string
          kind: string
          meeting_id: string
          position?: number
          text: string
          workspace_id: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          embedding?: unknown
          evidence_segment_ids?: string[]
          id?: string
          kind?: string
          meeting_id?: string
          position?: number
          text?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_items_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
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
      extension_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          token_hash: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          token_hash: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_state: {
        Row: {
          key: string
          lease_until: string | null
          pause_reason: string | null
          paused: boolean
          updated_at: string
        }
        Insert: {
          key: string
          lease_until?: string | null
          pause_reason?: string | null
          paused?: boolean
          updated_at?: string
        }
        Update: {
          key?: string
          lease_until?: string | null
          pause_reason?: string | null
          paused?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      live_transcript_chunks: {
        Row: {
          created_at: string
          end_ms: number
          id: string
          meeting_id: string
          recording_id: string
          sequence: number
          start_ms: number
          text: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          end_ms?: number
          id?: string
          meeting_id: string
          recording_id: string
          sequence: number
          start_ms?: number
          text?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          end_ms?: number
          id?: string
          meeting_id?: string
          recording_id?: string
          sequence?: number
          start_ms?: number
          text?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_transcript_chunks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_transcript_chunks_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          analysis_requested_at: string | null
          created_at: string
          current_transcript_id: string | null
          deleted_at: string | null
          ended_at: string | null
          id: string
          meet_url: string | null
          owner_id: string
          people_version: number
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
          analysis_requested_at?: string | null
          created_at?: string
          current_transcript_id?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          meet_url?: string | null
          owner_id: string
          people_version?: number
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
          analysis_requested_at?: string | null
          created_at?: string
          current_transcript_id?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          meet_url?: string | null
          owner_id?: string
          people_version?: number
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
          person_confirmed: boolean
          person_id: string | null
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
          person_confirmed?: boolean
          person_id?: string | null
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
          person_confirmed?: boolean
          person_id?: string | null
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
          {
            foreignKeyName: "participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          aliases: string[]
          avatar_path: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          instagram: string | null
          is_self: boolean
          notes: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          aliases?: string[]
          avatar_path?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          instagram?: string | null
          is_self?: boolean
          notes?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          aliases?: string[]
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          instagram?: string | null
          is_self?: boolean
          notes?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      person_voiceprints: {
        Row: {
          created_at: string
          id: string
          person_id: string
          speaker_id: string | null
          voiceprint: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          person_id: string
          speaker_id?: string | null
          voiceprint: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          person_id?: string
          speaker_id?: string | null
          voiceprint?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_voiceprints_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_voiceprints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_runs: {
        Row: {
          attempt: number
          config_version: string
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          input_version: string
          lease_until: string | null
          meeting_id: string
          model_id: string | null
          output: Json | null
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
          error_message?: string | null
          id?: string
          input_version: string
          lease_until?: string | null
          meeting_id: string
          model_id?: string | null
          output?: Json | null
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
          error_message?: string | null
          id?: string
          input_version?: string
          lease_until?: string | null
          meeting_id?: string
          model_id?: string | null
          output?: Json | null
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
          capture_last_seen_at: string | null
          capture_state: string | null
          channels: number
          codec: string | null
          created_at: string
          device_id: string | null
          duration_ms: number | null
          finalized_at: string | null
          id: string
          interruption_reason: string | null
          manifest_hash: string | null
          meeting_id: string
          sample_rate: number | null
          source_type: string
          status: Database["public"]["Enums"]["recording_status"]
          timeline_offset_ms: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          capture_last_seen_at?: string | null
          capture_state?: string | null
          channels?: number
          codec?: string | null
          created_at?: string
          device_id?: string | null
          duration_ms?: number | null
          finalized_at?: string | null
          id?: string
          interruption_reason?: string | null
          manifest_hash?: string | null
          meeting_id: string
          sample_rate?: number | null
          source_type: string
          status?: Database["public"]["Enums"]["recording_status"]
          timeline_offset_ms?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          capture_last_seen_at?: string | null
          capture_state?: string | null
          channels?: number
          codec?: string | null
          created_at?: string
          device_id?: string | null
          duration_ms?: number | null
          finalized_at?: string | null
          id?: string
          interruption_reason?: string | null
          manifest_hash?: string | null
          meeting_id?: string
          sample_rate?: number | null
          source_type?: string
          status?: Database["public"]["Enums"]["recording_status"]
          timeline_offset_ms?: number
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
      speakers: {
        Row: {
          channel_index: number
          created_at: string
          id: string
          mapping_source: string
          meeting_id: string
          participant_id: string | null
          provider_label: string
          recording_id: string | null
          run_id: string | null
          sample_end_ms: number | null
          sample_start_ms: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel_index?: number
          created_at?: string
          id?: string
          mapping_source?: string
          meeting_id: string
          participant_id?: string | null
          provider_label: string
          recording_id?: string | null
          run_id?: string | null
          sample_end_ms?: number | null
          sample_start_ms?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel_index?: number
          created_at?: string
          id?: string
          mapping_source?: string
          meeting_id?: string
          participant_id?: string | null
          provider_label?: string
          recording_id?: string | null
          run_id?: string | null
          sample_end_ms?: number | null
          sample_start_ms?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speakers_meeting_id_workspace_id_fkey"
            columns: ["meeting_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "speakers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speakers_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          action: Json | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          due_date: string | null
          due_text: string | null
          evidence_segment_ids: string[]
          id: string
          manual: boolean
          meeting_id: string | null
          owner_text: string | null
          priority_suggestion: string | null
          source_analysis_id: string | null
          source_version: number | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          due_date?: string | null
          due_text?: string | null
          evidence_segment_ids?: string[]
          id?: string
          manual?: boolean
          meeting_id?: string | null
          owner_text?: string | null
          priority_suggestion?: string | null
          source_analysis_id?: string | null
          source_version?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          due_date?: string | null
          due_text?: string | null
          evidence_segment_ids?: string[]
          id?: string
          manual?: boolean
          meeting_id?: string | null
          owner_text?: string | null
          priority_suggestion?: string | null
          source_analysis_id?: string | null
          source_version?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_source_analysis_id_fkey"
            columns: ["source_analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          created_at: string
          day: string
          done_at: string | null
          id: string
          position: number
          task_id: string | null
          title: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          done_at?: string | null
          id?: string
          position?: number
          task_id?: string | null
          title: string
          user_id?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          day?: string
          done_at?: string | null
          id?: string
          position?: number
          task_id?: string | null
          title?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_segments: {
        Row: {
          alignment_score: number | null
          channel_index: number
          created_at: string
          embedding: unknown
          end_ms: number
          id: string
          meeting_id: string
          overlap: boolean
          position: number
          recording_id: string | null
          review_state: string
          speaker_id: string | null
          start_ms: number
          text: string
          transcript_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          alignment_score?: number | null
          channel_index?: number
          created_at?: string
          embedding?: unknown
          end_ms: number
          id?: string
          meeting_id: string
          overlap?: boolean
          position: number
          recording_id?: string | null
          review_state?: string
          speaker_id?: string | null
          start_ms: number
          text: string
          transcript_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          alignment_score?: number | null
          channel_index?: number
          created_at?: string
          embedding?: unknown
          end_ms?: number
          id?: string
          meeting_id?: string
          overlap?: boolean
          position?: number
          recording_id?: string | null
          review_state?: string
          speaker_id?: string | null
          start_ms?: number
          text?: string
          transcript_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_segments_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_segments_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          kind: string
          language: string | null
          meeting_id: string
          parent_version_id: string | null
          provider: string
          raw_text: string | null
          reason: string | null
          run_id: string | null
          status: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          kind: string
          language?: string | null
          meeting_id: string
          parent_version_id?: string | null
          provider: string
          raw_text?: string | null
          reason?: string | null
          run_id?: string | null
          status?: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          language?: string | null
          meeting_id?: string
          parent_version_id?: string | null
          provider?: string
          raw_text?: string | null
          reason?: string | null
          run_id?: string | null
          status?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_meeting_id_workspace_id_fkey"
            columns: ["meeting_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transcripts_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "transcripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "processing_runs"
            referencedColumns: ["id"]
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
      bump_people_version: { Args: { _meeting: string }; Returns: undefined }
      cancel_processing: { Args: { _meeting: string }; Returns: undefined }
      capture_heartbeat: {
        Args: { _paused?: boolean; _recording: string }
        Returns: boolean
      }
      delete_meeting: { Args: { _meeting: string }; Returns: undefined }
      expire_captures: { Args: never; Returns: number }
      finalize_recording: {
        Args: {
          _duration_ms: number
          _manifest_hash: string
          _recording: string
        }
        Returns: Database["public"]["Enums"]["meeting_status"]
      }
      finish_capture_internal: {
        Args: { _reason?: string; _recording: string }
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
      meet_start_capture: {
        Args: {
          _codec: string
          _request: string
          _resume: string
          _timezone: string
          _title: string
          _url: string
          _user: string
          _workspace: string
        }
        Returns: Json
      }
      meeting_visible: { Args: { _meeting: string }; Returns: boolean }
      merge_people: {
        Args: { _from: string; _into: string }
        Returns: undefined
      }
      publish_capture_analysis: {
        Args: {
          _items: Json
          _meeting: string
          _partial: boolean
          _summary: string
          _tasks: Json
          _transcript: string
        }
        Returns: string
      }
      publish_capture_transcript: {
        Args: {
          _expected: string
          _recording: string
          _rows: Json
          _run: string
        }
        Returns: string
      }
      recording_visible: { Args: { _rec: string }; Returns: boolean }
      search_items: {
        Args: { _limit?: number; _query: unknown; _ws: string }
        Returns: {
          item_id: string
          kind: string
          meeting_id: string
          meeting_title: string
          score: number
          text: string
        }[]
      }
      search_segments: {
        Args: { _limit?: number; _query: unknown; _ws: string }
        Returns: {
          meeting_id: string
          meeting_title: string
          score: number
          segment_id: string
          speaker_label: string
          start_ms: number
          text: string
        }[]
      }
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
      task_status:
        | "suggested"
        | "accepted"
        | "in_progress"
        | "done"
        | "dismissed"
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
      task_status: [
        "suggested",
        "accepted",
        "in_progress",
        "done",
        "dismissed",
      ],
    },
  },
} as const
