export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole =
  | "Volunteer"
  | "Center Lead"
  | "Admin"
  | "Board Director"
  | "Board of Directors"
  | "Trainer"
  | "Partner";

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in_time: string | null
          created_at: string
          id: string
          session_id: string
          status: string
          user_id: string
          checkout_time: string | null
          method: string | null
          geo_location: string | null
        }
        Insert: {
          check_in_time?: string | null
          created_at?: string
          id?: string
          session_id: string
          status: string
          user_id: string
          checkout_time?: string | null
          method?: string | null
          geo_location?: string | null
        }
        Update: {
          check_in_time?: string | null
          created_at?: string
          id?: string
          session_id?: string
          status?: string
          user_id?: string
          checkout_time?: string | null
          method?: string | null
          geo_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          id: string
          center_id: string | null
          name: string
          grade: string | null
          subject: string | null
          schedule_rrule: string | null
          start_time: string
          end_time: string
        }
        Insert: {
          id?: string
          center_id?: string | null
          name: string
          grade?: string | null
          subject?: string | null
          schedule_rrule?: string | null
          start_time: string
          end_time: string
        }
        Update: {
          id?: string
          center_id?: string | null
          name?: string
          grade?: string | null
          subject?: string | null
          schedule_rrule?: string | null
          start_time?: string
          end_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          }
        ]
      }
      sessions: {
        Row: {
          capacity: number
          center_id: string
          created_at: string
          end_time: string
          id: string
          start_time: string
          topic: string
          kiosk_token: string | null
          batch_id: string | null
          backup_id: string | null
          notes: string | null
          is_urgent: boolean | null
        }
        Insert: {
          capacity: number
          center_id: string
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          topic: string
          kiosk_token?: string | null
          batch_id?: string | null
          backup_id?: string | null
          notes?: string | null
          is_urgent?: boolean | null
        }
        Update: {
          capacity?: number
          center_id?: string
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          topic?: string
          kiosk_token?: string | null
          batch_id?: string | null
          backup_id?: string | null
          notes?: string | null
          is_urgent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      resources: {
        Row: {
          id: string
          center_id: string | null
          uploader_id: string
          title: string
          description: string
          file_url: string
          subject: string
          grade_level: string
          created_at: string
          tags: string[] | null
          version: string | null
          center_scope: string[] | null
        }
        Insert: {
          id?: string
          center_id?: string | null
          uploader_id: string
          title: string
          description: string
          file_url: string
          subject: string
          grade_level: string
          created_at?: string
          tags?: string[] | null
          version?: string | null
          center_scope?: string[] | null
        }
        Update: {
          id?: string
          center_id?: string | null
          uploader_id?: string
          title?: string
          description?: string
          file_url?: string
          subject?: string
          grade_level?: string
          created_at?: string
          tags?: string[] | null
          version?: string | null
          center_scope?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          assigned_center_id: string | null
          created_at: string
          email: string | null
          id: string
          role: string
          volunteer_code: string | null
          first_name: string | null
          last_name: string | null
          phone: string | null
          city: string | null
          languages: string[] | null
          skills: string[] | null
          availability: Json | null
          status: string
          id_verification_status: string
          consent_accepted: boolean
          center_scope: string[] | null
          id_document_url: string | null
          nda_document_url: string | null
          consent_form_url: string | null
          background_check_cleared: boolean
        }
        Insert: {
          assigned_center_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          role: string
          volunteer_code?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          city?: string | null
          languages?: string[] | null
          skills?: string[] | null
          availability?: Json | null
          status?: string
          id_verification_status?: string
          consent_accepted?: boolean
          center_scope?: string[] | null
          id_document_url?: string | null
          nda_document_url?: string | null
          consent_form_url?: string | null
          background_check_cleared?: boolean
        }
        Update: {
          assigned_center_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          role?: string
          volunteer_code?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          city?: string | null
          languages?: string[] | null
          skills?: string[] | null
          availability?: Json | null
          status?: string
          id_verification_status?: string
          consent_accepted?: boolean
          center_scope?: string[] | null
          id_document_url?: string | null
          nda_document_url?: string | null
          consent_form_url?: string | null
          background_check_cleared?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "users_assigned_center_id_fkey"
            columns: ["assigned_center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      session_enrollments: {
        Row: {
          id: string
          session_id: string
          user_id: string
          status: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          status?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_enrollments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      leaves: {
        Row: {
          id: string
          volunteer_id: string | null
          start_date: string
          end_date: string
          reason: string | null
          status: string
          approver_id: string | null
        }
        Insert: {
          id?: string
          volunteer_id?: string | null
          start_date: string
          end_date: string
          reason?: string | null
          status?: string
          approver_id?: string | null
        }
        Update: {
          id?: string
          volunteer_id?: string | null
          start_date?: string
          end_date?: string
          reason?: string | null
          status?: string
          approver_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaves_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          target_role: string
          author_id: string
          center_id: string
          created_at: string
          audience_filter: string | null
          channels: string[] | null
          template_id: string | null
          sent_at: string | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          target_role: string
          author_id: string
          center_id: string
          created_at?: string
          audience_filter?: string | null
          channels?: string[] | null
          template_id?: string | null
          sent_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          target_role?: string
          author_id?: string
          center_id?: string
          created_at?: string
          audience_filter?: string | null
          channels?: string[] | null
          template_id?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          entity: string
          entity_id: string | null
          before_state: Json | null
          after_state: Json | null
          timestamp: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          entity: string
          entity_id?: string | null
          before_state?: Json | null
          after_state?: Json | null
          timestamp?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          entity?: string
          entity_id?: string | null
          before_state?: Json | null
          after_state?: Json | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      students: {
        Row: {
          id: string
          center_id: string | null
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          center_id?: string | null
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          center_id?: string | null
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          }
        ]
      }
      student_attendance: {
        Row: {
          id: string
          session_id: string | null
          student_id: string | null
          status: string
          marked_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id?: string | null
          student_id?: string | null
          status: string
          marked_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string | null
          student_id?: string | null
          status?: string
          marked_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      assessments: {
        Row: {
          id: string
          student_id: string | null
          session_id: string | null
          exam_type: string | null
          score_achieved: number | null
          max_score: number | null
          status: string | null
          date_administered: string | null
          recorded_by: string | null
          notes: string | null
          created_at: string
          date: string
          subject: string
        }
        Insert: {
          id?: string
          student_id?: string | null
          session_id?: string | null
          exam_type?: string | null
          score_achieved?: number | null
          max_score?: number | null
          status?: string | null
          date_administered?: string | null
          recorded_by?: string | null
          notes?: string | null
          created_at?: string
          date: string
          subject: string
        }
        Update: {
          id?: string
          student_id?: string | null
          session_id?: string | null
          exam_type?: string | null
          score_achieved?: number | null
          max_score?: number | null
          status?: string | null
          date_administered?: string | null
          recorded_by?: string | null
          notes?: string | null
          created_at?: string
          date?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      trainings: {
        Row: {
          id: string
          center_id: string | null
          name: string
          type: string
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          center_id?: string | null
          name: string
          type: string
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          center_id?: string | null
          name?: string
          type?: string
          date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          }
        ]
      }
      training_attendance: {
        Row: {
          id: string
          training_id: string | null
          volunteer_id: string | null
          status: string
          marked_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          training_id?: string | null
          volunteer_id?: string | null
          status: string
          marked_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          training_id?: string | null
          volunteer_id?: string | null
          status?: string
          marked_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attendance_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_session_center: { Args: { session_id: string }; Returns: string }
      get_user_center: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

