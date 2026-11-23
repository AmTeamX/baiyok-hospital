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
      appointments: {
        Row: {
          appointment_at: string
          attendance_source: string | null
          attended_at: string | null
          clinic: string
          created_at: string
          external_reference: string | null
          id: string
          import_batch: string | null
          import_batch_id: string | null
          missed_marked_at: string | null
          patient_id: string
          source_system: string
          status: Database["public"]["Enums"]["appointment_status"]
          superseded_by_appointment_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_at: string
          attendance_source?: string | null
          attended_at?: string | null
          clinic: string
          created_at?: string
          external_reference?: string | null
          id?: string
          import_batch?: string | null
          import_batch_id?: string | null
          missed_marked_at?: string | null
          patient_id: string
          source_system?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          superseded_by_appointment_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_at?: string
          attendance_source?: string | null
          attended_at?: string | null
          clinic?: string
          created_at?: string
          external_reference?: string | null
          id?: string
          import_batch?: string | null
          import_batch_id?: string | null
          missed_marked_at?: string | null
          patient_id?: string
          source_system?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          superseded_by_appointment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_superseded_by_appointment_id_fkey"
            columns: ["superseded_by_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          request_id: string | null
          service_unit_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          request_id?: string | null
          service_unit_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          request_id?: string | null
          service_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_service_unit_id_fkey"
            columns: ["service_unit_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          appointment_id: string
          channel: string
          checked_in_at: string
          id: string
        }
        Insert: {
          appointment_id: string
          channel?: string
          checked_in_at?: string
          id?: string
        }
        Update: {
          appointment_id?: string
          channel?: string
          checked_in_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_activities: {
        Row: {
          activity_type: string
          follow_up_id: string
          id: string
          note: string | null
          performed_at: string
          performed_by: string | null
        }
        Insert: {
          activity_type: string
          follow_up_id: string
          id?: string
          note?: string | null
          performed_at?: string
          performed_by?: string | null
        }
        Update: {
          activity_type?: string
          follow_up_id?: string
          id?: string
          note?: string | null
          performed_at?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_activities_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "follow_ups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_activities_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          appointment_id: string
          assigned_at: string | null
          assigned_volunteer_id: string | null
          closed_at: string | null
          closure_reason: string | null
          contacted_at: string | null
          counselling_note: string | null
          created_at: string
          created_by: string | null
          id: string
          missed_reason: string | null
          new_appointment_id: string | null
          priority: string
          reason_note: string | null
          returned_confirmed_at: string | null
          status: Database["public"]["Enums"]["follow_up_status"]
          updated_at: string
          version: number
        }
        Insert: {
          appointment_id: string
          assigned_at?: string | null
          assigned_volunteer_id?: string | null
          closed_at?: string | null
          closure_reason?: string | null
          contacted_at?: string | null
          counselling_note?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          missed_reason?: string | null
          new_appointment_id?: string | null
          priority?: string
          reason_note?: string | null
          returned_confirmed_at?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          appointment_id?: string
          assigned_at?: string | null
          assigned_volunteer_id?: string | null
          closed_at?: string | null
          closure_reason?: string | null
          contacted_at?: string | null
          counselling_note?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          missed_reason?: string | null
          new_appointment_id?: string | null
          priority?: string
          reason_note?: string | null
          returned_confirmed_at?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_assigned_volunteer_id_fkey"
            columns: ["assigned_volunteer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_new_appointment_id_fkey"
            columns: ["new_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          checksum: string
          committed_at: string | null
          created_at: string
          created_by: string
          filename: string
          id: string
          invalid_rows: number
          kind: string
          status: string
          total_rows: number
          valid_rows: number
        }
        Insert: {
          checksum: string
          committed_at?: string | null
          created_at?: string
          created_by: string
          filename: string
          id?: string
          invalid_rows?: number
          kind: string
          status?: string
          total_rows?: number
          valid_rows?: number
        }
        Update: {
          checksum?: string
          committed_at?: string | null
          created_at?: string
          created_by?: string
          filename?: string
          id?: string
          invalid_rows?: number
          kind?: string
          status?: string
          total_rows?: number
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_row_errors: {
        Row: {
          batch_id: string
          created_at: string
          error_code: string
          field: string | null
          id: string
          message: string
          row_number: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          error_code: string
          field?: string | null
          id?: string
          message: string
          row_number: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          error_code?: string
          field?: string | null
          id?: string
          message?: string
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_row_errors_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      line_account_links: {
        Row: {
          consented_at: string | null
          created_at: string
          id: string
          line_account_id: string
          patient_id: string | null
          profile_id: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["line_link_role"]
          status: Database["public"]["Enums"]["line_link_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          consented_at?: string | null
          created_at?: string
          id?: string
          line_account_id: string
          patient_id?: string | null
          profile_id?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["line_link_role"]
          status?: Database["public"]["Enums"]["line_link_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          consented_at?: string | null
          created_at?: string
          id?: string
          line_account_id?: string
          patient_id?: string | null
          profile_id?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["line_link_role"]
          status?: Database["public"]["Enums"]["line_link_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "line_account_links_line_account_id_fkey"
            columns: ["line_account_id"]
            isOneToOne: false
            referencedRelation: "line_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_account_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_account_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_account_links_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      line_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          friend_status: string
          id: string
          last_seen_at: string | null
          line_user_id: string
          picture_url: string | null
          rich_menu_id: string | null
          rich_menu_linked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          friend_status?: string
          id?: string
          last_seen_at?: string | null
          line_user_id: string
          picture_url?: string | null
          rich_menu_id?: string | null
          rich_menu_linked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          friend_status?: string
          id?: string
          last_seen_at?: string | null
          line_user_id?: string
          picture_url?: string | null
          rich_menu_id?: string | null
          rich_menu_linked_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      line_link_codes: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          intended_role: Database["public"]["Enums"]["line_link_role"]
          target_id: string
          target_type: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          intended_role: Database["public"]["Enums"]["line_link_role"]
          target_id: string
          target_type: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          intended_role?: Database["public"]["Enums"]["line_link_role"]
          target_id?: string
          target_type?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "line_link_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      line_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          is_redelivery: boolean
          line_user_id: string | null
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          is_redelivery?: boolean
          line_user_id?: string | null
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          is_redelivery?: boolean
          line_user_id?: string | null
          received_at?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          appointment_id: string
          attempt_count: number
          channel: string
          created_at: string
          error_message: string | null
          follow_up_id: string | null
          id: string
          idempotency_key: string | null
          kind: string
          last_attempt_at: string | null
          next_attempt_at: string | null
          provider_message_id: string | null
          recipient_profile_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          appointment_id: string
          attempt_count?: number
          channel: string
          created_at?: string
          error_message?: string | null
          follow_up_id?: string | null
          id?: string
          idempotency_key?: string | null
          kind: string
          last_attempt_at?: string | null
          next_attempt_at?: string | null
          provider_message_id?: string | null
          recipient_profile_id?: string | null
          sent_at?: string | null
          status: string
        }
        Update: {
          appointment_id?: string
          attempt_count?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          follow_up_id?: string | null
          id?: string
          idempotency_key?: string | null
          kind?: string
          last_attempt_at?: string | null
          next_attempt_at?: string | null
          provider_message_id?: string | null
          recipient_profile_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "follow_ups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          consent_line: boolean
          contact_preference: string
          created_at: string
          full_name: string
          hn: string
          id: string
          line_consent_at: string | null
          line_consent_revoked_at: string | null
          line_linked_at: string | null
          line_user_id: string | null
          phone: string | null
          service_unit_id: string | null
          updated_at: string
          village: string | null
        }
        Insert: {
          birth_date?: string | null
          consent_line?: boolean
          contact_preference?: string
          created_at?: string
          full_name: string
          hn: string
          id?: string
          line_consent_at?: string | null
          line_consent_revoked_at?: string | null
          line_linked_at?: string | null
          line_user_id?: string | null
          phone?: string | null
          service_unit_id?: string | null
          updated_at?: string
          village?: string | null
        }
        Update: {
          birth_date?: string | null
          consent_line?: boolean
          contact_preference?: string
          created_at?: string
          full_name?: string
          hn?: string
          id?: string
          line_consent_at?: string | null
          line_consent_revoked_at?: string | null
          line_linked_at?: string | null
          line_user_id?: string | null
          phone?: string | null
          service_unit_id?: string | null
          updated_at?: string
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_service_unit_id_fkey"
            columns: ["service_unit_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          line_user_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          service_unit: string | null
          service_unit_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          line_user_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          service_unit?: string | null
          service_unit_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          line_user_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          service_unit?: string | null
          service_unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_service_unit_id_fkey"
            columns: ["service_unit_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["id"]
          },
        ]
      }
      service_units: {
        Row: {
          active: boolean
          created_at: string
          id: string
          missed_cutoff_hours: number
          name: string
          reminder_enabled: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          missed_cutoff_hours?: number
          name: string
          reminder_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          missed_cutoff_hours?: number
          name?: string
          reminder_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_case: {
        Args: { p_appointment_id: string; p_volunteer_id: string | null; p_priority: string; p_note: string | null; p_actor_id: string }
        Returns: Json
      }
      add_follow_up_activity: {
        Args: {
          p_activity_type: string
          p_actor_id: string
          p_follow_up_id: string
          p_note: string
        }
        Returns: Json
      }
      assign_follow_up: {
        Args: {
          p_actor_id: string
          p_follow_up_id: string
          p_volunteer_id: string
        }
        Returns: Json
      }
      can_read_follow_up: { Args: { target_id: string }; Returns: boolean }
      commit_import_batch: {
        Args: {
          p_checksum: string
          p_created_by: string
          p_filename: string
          p_kind: string
          p_rows: Json
        }
        Returns: Json
      }
      consume_line_link_code: {
        Args: {
          p_claimed_role: Database["public"]["Enums"]["line_link_role"]
          p_token_hash: string
        }
        Returns: Json
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_service_unit_id: { Args: never; Returns: string }
      default_service_unit_id: { Args: never; Returns: string }
      is_active_line_link: { Args: { p_link_id: string }; Returns: boolean }
      is_clinical_staff: { Args: never; Returns: boolean }
      mark_missed_appointments: { Args: never; Returns: Json }
      reschedule_follow_up: {
        Args: {
          p_actor_id: string
          p_appointment_at: string
          p_follow_up_id: string
          p_priority: string
        }
        Returns: Json
      }
      search_missed_follow_ups: {
        Args: {
          p_area?: string
          p_assignee?: string
          p_from?: string
          p_order?: string
          p_page?: number
          p_page_size?: number
          p_priority?: string
          p_q?: string
          p_service_unit_id: string
          p_sort?: string
          p_status?: string
          p_to?: string
          p_unassigned_only?: boolean
        }
        Returns: Json
      }
      update_follow_up: {
        Args: {
          p_actor_id: string
          p_closure_reason: string
          p_counselling_note: string
          p_expected_version: number
          p_follow_up_id: string
          p_missed_reason: string
          p_priority: string
          p_reason_note: string
          p_status: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "nurse" | "volunteer"
      appointment_status:
        | "scheduled"
        | "attended"
        | "missed"
        | "rescheduled"
        | "cancelled"
      follow_up_status:
        | "pending"
        | "assigned"
        | "contacted"
        | "rescheduled"
        | "returned"
        | "closed"
      line_link_role: "patient" | "volunteer"
      line_link_status: "active" | "revoked" | "deactivated"
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
      app_role: ["admin", "nurse", "volunteer"],
      appointment_status: [
        "scheduled",
        "attended",
        "missed",
        "rescheduled",
        "cancelled",
      ],
      follow_up_status: [
        "pending",
        "assigned",
        "contacted",
        "rescheduled",
        "returned",
        "closed",
      ],
      line_link_role: ["patient", "volunteer"],
      line_link_status: ["active", "revoked", "deactivated"],
    },
  },
} as const
