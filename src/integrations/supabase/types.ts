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
      app_features: {
        Row: {
          code: string
          description: string | null
          display_order: number | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          label: string
        }
        Insert: {
          code: string
          description?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          label: string
        }
        Update: {
          code?: string
          description?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          attendance_date: string
          attendance_type: Database["public"]["Enums"]["attendance_type"]
          class_id: string | null
          created_at: string | null
          excused_reason: string | null
          id: string
          notes: string | null
          reporter_id: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string | null
        }
        Insert: {
          attendance_date: string
          attendance_type: Database["public"]["Enums"]["attendance_type"]
          class_id?: string | null
          created_at?: string | null
          excused_reason?: string | null
          id?: string
          notes?: string | null
          reporter_id?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string | null
        }
        Update: {
          attendance_date?: string
          attendance_type?: Database["public"]["Enums"]["attendance_type"]
          class_id?: string | null
          created_at?: string | null
          excused_reason?: string | null
          id?: string
          notes?: string | null
          reporter_id?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          label: string
          school_id: string
          session_id: string
          session_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          school_id: string
          session_id: string
          session_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          school_id?: string
          session_id?: string
          session_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          grade: number
          id: string
          is_active: boolean | null
          name: string
          school_id: string
          school_year: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          grade: number
          id?: string
          is_active?: boolean | null
          name: string
          school_id: string
          school_year: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          grade?: number
          id?: string
          is_active?: boolean | null
          name?: string
          school_id?: string
          school_year?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_members: {
        Row: {
          created_at: string
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_schedules: {
        Row: {
          created_at: string | null
          duty_date: string
          id: string
          location: string | null
          notes: string | null
          school_id: string
          shift: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duty_date: string
          id?: string
          location?: string | null
          notes?: string | null
          school_id: string
          shift?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duty_date?: string
          id?: string
          location?: string | null
          notes?: string | null
          school_id?: string
          shift?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emulation_scores: {
        Row: {
          academic_score: number | null
          boarding_score: number | null
          class_id: string
          created_at: string
          discipline_score: number | null
          id: string
          notes: string | null
          reporter_id: string | null
          school_id: string
          school_year: string
          updated_at: string
          week_number: number
        }
        Insert: {
          academic_score?: number | null
          boarding_score?: number | null
          class_id: string
          created_at?: string
          discipline_score?: number | null
          id?: string
          notes?: string | null
          reporter_id?: string | null
          school_id: string
          school_year: string
          updated_at?: string
          week_number: number
        }
        Update: {
          academic_score?: number | null
          boarding_score?: number | null
          class_id?: string
          created_at?: string
          discipline_score?: number | null
          id?: string
          notes?: string | null
          reporter_id?: string | null
          school_id?: string
          school_year?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "emulation_scores_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emulation_scores_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emulation_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      global_roles: {
        Row: {
          created_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      login_history: {
        Row: {
          id: string
          ip_address: string | null
          login_at: string | null
          school_id: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_at?: string | null
          school_id?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_at?: string | null
          school_id?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_settings: {
        Row: {
          breakfast_deadline_offset: number
          breakfast_deadline_time: string
          created_at: string
          dinner_deadline_offset: number
          dinner_deadline_time: string
          id: string
          lunch_deadline_offset: number
          lunch_deadline_time: string
          rice_per_student: number
          school_id: string
          updated_at: string
        }
        Insert: {
          breakfast_deadline_offset?: number
          breakfast_deadline_time?: string
          created_at?: string
          dinner_deadline_offset?: number
          dinner_deadline_time?: string
          id?: string
          lunch_deadline_offset?: number
          lunch_deadline_time?: string
          rice_per_student?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          breakfast_deadline_offset?: number
          breakfast_deadline_time?: string
          created_at?: string
          dinner_deadline_offset?: number
          dinner_deadline_time?: string
          id?: string
          lunch_deadline_offset?: number
          lunch_deadline_time?: string
          rice_per_student?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_group_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          feature_code: string
          group_id: string
          id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          feature_code: string
          group_id: string
          id?: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          feature_code?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          school_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          school_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          school_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string | null
          full_name: string
          gender: string | null
          id: string
          phone: string | null
          position: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string | null
          full_name: string
          gender?: string | null
          id: string
          phone?: string | null
          position?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          phone?: string | null
          position?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      rice_inventory: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rice_inventory_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rice_inventory_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_features: {
        Row: {
          created_at: string | null
          feature_code: string
          id: string
          is_enabled: boolean | null
          school_id: string
        }
        Insert: {
          created_at?: string | null
          feature_code: string
          id?: string
          is_enabled?: boolean | null
          school_id: string
        }
        Update: {
          created_at?: string | null
          feature_code?: string
          id?: string
          is_enabled?: boolean | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_features_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_memberships: {
        Row: {
          class_id: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          status: Database["public"]["Enums"]["membership_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          status?: Database["public"]["Enums"]["membership_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string
          status?: Database["public"]["Enums"]["membership_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          code: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          cccd: string | null
          class_id: string | null
          created_at: string | null
          date_of_birth: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          is_active: boolean | null
          is_boarding: boolean | null
          meal_group: string | null
          notes: string | null
          parent_phone: string | null
          phone: string | null
          room_number: string | null
          school_id: string
          student_code: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cccd?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean | null
          is_boarding?: boolean | null
          meal_group?: string | null
          notes?: string | null
          parent_phone?: string | null
          phone?: string | null
          room_number?: string | null
          school_id: string
          student_code: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cccd?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean | null
          is_boarding?: boolean | null
          meal_group?: string | null
          notes?: string | null
          parent_phone?: string | null
          phone?: string | null
          room_number?: string | null
          school_id?: string
          student_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_groups: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          feature_code: string
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          feature_code: string
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          feature_code?: string
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      week_settings: {
        Row: {
          created_at: string
          end_date: string
          id: string
          school_id: string
          school_year: string
          start_date: string
          updated_at: string
          week_number: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          school_id: string
          school_year: string
          start_date: string
          updated_at?: string
          week_number: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          school_id?: string
          school_year?: string
          start_date?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "week_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_teacher_class: { Args: { sid: string; uid: string }; Returns: string }
      has_role_in_school: {
        Args: {
          r: Database["public"]["Enums"]["app_role"]
          sid: string
          uid: string
        }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { cid: string; sid: string; uid: string }
        Returns: boolean
      }
      is_school_admin: { Args: { sid: string; uid: string }; Returns: boolean }
      is_school_member: { Args: { sid: string; uid: string }; Returns: boolean }
      is_super_admin: { Args: { uid: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "teacher"
        | "class_teacher"
        | "accountant"
        | "kitchen"
        | "board"
        | "staff"
      attendance_status: "present" | "absent" | "late" | "excused"
      attendance_type:
        | "evening_study"
        | "boarding"
        | "breakfast"
        | "lunch"
        | "dinner"
      gender: "male" | "female"
      membership_status: "active" | "suspended"
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
      app_role: [
        "super_admin",
        "admin",
        "teacher",
        "class_teacher",
        "accountant",
        "kitchen",
        "board",
        "staff",
      ],
      attendance_status: ["present", "absent", "late", "excused"],
      attendance_type: [
        "evening_study",
        "boarding",
        "breakfast",
        "lunch",
        "dinner",
      ],
      gender: ["male", "female"],
      membership_status: ["active", "suspended"],
    },
  },
} as const
