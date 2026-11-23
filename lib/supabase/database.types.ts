export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      service_units: {
        Row: { id: string; name: string; timezone: string; missed_cutoff_hours: number; reminder_enabled: boolean; active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; timezone?: string; missed_cutoff_hours?: number; reminder_enabled?: boolean; active?: boolean; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["service_units"]["Insert"]>;
      };
      profiles: {
        Row: { id: string; full_name: string; role: "admin" | "nurse" | "volunteer"; service_unit: string | null; service_unit_id: string | null; active: boolean; phone: string | null; line_user_id: string | null; created_at: string; updated_at: string };
        Insert: { id: string; full_name: string; role?: "admin" | "nurse" | "volunteer"; service_unit?: string | null; service_unit_id?: string | null; active?: boolean; phone?: string | null; line_user_id?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      patients: {
        Row: { id: string; hn: string; full_name: string; birth_date: string | null; phone: string | null; village: string | null; service_unit_id: string | null; line_user_id: string | null; consent_line: boolean; line_linked_at: string | null; line_consent_at: string | null; line_consent_revoked_at: string | null; contact_preference: "line" | "phone" | "both" | "none"; created_at: string; updated_at: string };
        Insert: { id?: string; hn: string; full_name: string; birth_date?: string | null; phone?: string | null; village?: string | null; service_unit_id?: string | null; line_user_id?: string | null; consent_line?: boolean; line_linked_at?: string | null; line_consent_at?: string | null; line_consent_revoked_at?: string | null; contact_preference?: "line" | "phone" | "both" | "none"; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
      };
      appointments: {
        Row: { id: string; patient_id: string; appointment_at: string; clinic: string; status: "scheduled" | "attended" | "missed" | "rescheduled" | "cancelled"; attended_at: string | null; import_batch: string | null; import_batch_id: string | null; external_reference: string | null; source_system: string; superseded_by_appointment_id: string | null; missed_marked_at: string | null; attendance_source: "import" | "check_in" | "manual" | null; created_at: string; updated_at: string };
        Insert: { id?: string; patient_id: string; appointment_at: string; clinic: string; status?: "scheduled" | "attended" | "missed" | "rescheduled" | "cancelled"; attended_at?: string | null; import_batch?: string | null; import_batch_id?: string | null; external_reference?: string | null; source_system?: string; superseded_by_appointment_id?: string | null; missed_marked_at?: string | null; attendance_source?: "import" | "check_in" | "manual" | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
      };
      follow_ups: {
        Row: { id: string; appointment_id: string; status: "pending" | "assigned" | "contacted" | "rescheduled" | "returned" | "closed"; missed_reason: string | null; reason_note: string | null; counselling_note: string | null; assigned_volunteer_id: string | null; new_appointment_id: string | null; returned_confirmed_at: string | null; closure_reason: string | null; priority: "normal" | "high" | "urgent"; assigned_at: string | null; contacted_at: string | null; closed_at: string | null; version: number; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; appointment_id: string; status?: "pending" | "assigned" | "contacted" | "rescheduled" | "returned" | "closed"; missed_reason?: string | null; reason_note?: string | null; counselling_note?: string | null; assigned_volunteer_id?: string | null; new_appointment_id?: string | null; returned_confirmed_at?: string | null; closure_reason?: string | null; priority?: "normal" | "high" | "urgent"; assigned_at?: string | null; contacted_at?: string | null; closed_at?: string | null; version?: number; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["follow_ups"]["Insert"]>;
      };
      import_batches: {
        Row: { id: string; kind: "appointments" | "service_results"; filename: string; checksum: string; status: "preview" | "committed" | "failed" | "cancelled"; total_rows: number; valid_rows: number; invalid_rows: number; created_by: string; created_at: string; committed_at: string | null };
        Insert: { id?: string; kind: "appointments" | "service_results"; filename: string; checksum: string; status?: "preview" | "committed" | "failed" | "cancelled"; total_rows?: number; valid_rows?: number; invalid_rows?: number; created_by: string; created_at?: string; committed_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["import_batches"]["Insert"]>;
      };
      import_row_errors: {
        Row: { id: string; batch_id: string; row_number: number; field: string | null; error_code: string; message: string; created_at: string };
        Insert: { id?: string; batch_id: string; row_number: number; field?: string | null; error_code: string; message: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["import_row_errors"]["Insert"]>;
      };
      audit_logs: {
        Row: { id: string; actor_id: string | null; actor_role: "admin" | "nurse" | "volunteer" | null; service_unit_id: string | null; action: string; entity_type: string; entity_id: string | null; before_data: Json | null; after_data: Json | null; request_id: string | null; created_at: string };
        Insert: { id?: string; actor_id?: string | null; actor_role?: "admin" | "nurse" | "volunteer" | null; service_unit_id?: string | null; action: string; entity_type: string; entity_id?: string | null; before_data?: Json | null; after_data?: Json | null; request_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
      notification_logs: {
        Row: { id: string; appointment_id: string; follow_up_id: string | null; recipient_profile_id: string | null; kind: string; channel: string; status: "pending" | "processing" | "sent" | "failed" | "dead_letter"; error_message: string | null; sent_at: string | null; attempt_count: number; next_attempt_at: string | null; provider_message_id: string | null; idempotency_key: string | null };
        Insert: { id?: string; appointment_id: string; follow_up_id?: string | null; recipient_profile_id?: string | null; kind: string; channel: string; status: "pending" | "processing" | "sent" | "failed" | "dead_letter"; error_message?: string | null; sent_at?: string | null; attempt_count?: number; next_attempt_at?: string | null; provider_message_id?: string | null; idempotency_key?: string | null };
        Update: Partial<Database["public"]["Tables"]["notification_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { app_role: "admin" | "nurse" | "volunteer"; appointment_status: "scheduled" | "attended" | "missed" | "rescheduled" | "cancelled"; follow_up_status: "pending" | "assigned" | "contacted" | "rescheduled" | "returned" | "closed" };
    CompositeTypes: Record<string, never>;
  };
};

