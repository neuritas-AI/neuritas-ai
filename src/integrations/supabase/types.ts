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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      ai_academy_items: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_mime: string | null
          file_name: string | null
          id: string
          importance: string | null
          link: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_mime?: string | null
          file_name?: string | null
          id?: string
          importance?: string | null
          link?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_mime?: string | null
          file_name?: string | null
          id?: string
          importance?: string | null
          link?: string | null
          storage_path?: string | null
          title?: string
        }
        Relationships: []
      }
      appointment_attendance: {
        Row: {
          appointment_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointment_types: {
        Row: {
          color: string
          created_at: string
          id: string
          key: string
          label: string
          requires_attendance: boolean
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          key: string
          label: string
          requires_attendance?: boolean
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          key?: string
          label?: string
          requires_attendance?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_type: string
          color: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          end_at: string
          id: string
          participants: string[]
          project_id: string | null
          reminder_at: string | null
          reminder_sent: boolean
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          appointment_type?: string
          color?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          end_at: string
          id?: string
          participants?: string[]
          project_id?: string | null
          reminder_at?: string | null
          reminder_sent?: boolean
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          appointment_type?: string
          color?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          end_at?: string
          id?: string
          participants?: string[]
          project_id?: string | null
          reminder_at?: string | null
          reminder_sent?: boolean
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          assigned_to: string[]
          color: string | null
          company: string
          created_at: string
          created_by: string | null
          email: string | null
          follow_up_at: string | null
          follow_up_note: string | null
          follow_up_reason: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string[]
          color?: string | null
          company: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          follow_up_at?: string | null
          follow_up_note?: string | null
          follow_up_reason?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string[]
          color?: string | null
          company?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          follow_up_at?: string | null
          follow_up_note?: string | null
          follow_up_reason?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          appointment_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          invoice_id: string | null
          mime_type: string | null
          name: string
          project_id: string | null
          quote_id: string | null
          size: number | null
          storage_path: string
          task_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          mime_type?: string | null
          name: string
          project_id?: string | null
          quote_id?: string | null
          size?: number | null
          storage_path: string
          task_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          mime_type?: string | null
          name?: string
          project_id?: string | null
          quote_id?: string | null
          size?: number | null
          storage_path?: string
          task_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          number: string
          project_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          project_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          project_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      project_meetings: {
        Row: {
          appointment_id: string | null
          conducted_by: string | null
          created_at: string
          created_by: string | null
          discussed: string | null
          id: string
          meeting_date: string
          meeting_type: string
          problem: string | null
          project_id: string
          solution: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          conducted_by?: string | null
          created_at?: string
          created_by?: string | null
          discussed?: string | null
          id?: string
          meeting_date?: string
          meeting_type?: string
          problem?: string | null
          project_id: string
          solution?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          conducted_by?: string | null
          created_at?: string
          created_by?: string | null
          discussed?: string | null
          id?: string
          meeting_date?: string
          meeting_type?: string
          problem?: string | null
          project_id?: string
          solution?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          assigned_to: string[]
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          id: string
          is_internal: boolean
          name: string
          status: Database["public"]["Enums"]["project_status"]
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string[]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_internal?: boolean
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string[]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_internal?: boolean
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          issue_date: string
          notes: string | null
          number: string
          project_id: string | null
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          assignee_ids: string[]
          created_at: string
          created_by: string | null
          current_worker_id: string | null
          customer_id: string | null
          deadline: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_ids?: string[]
          created_at?: string
          created_by?: string | null
          current_worker_id?: string | null
          customer_id?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_ids?: string[]
          created_at?: string
          created_by?: string | null
          current_worker_id?: string | null
          customer_id?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_edit_customers: boolean
          can_edit_invoices: boolean
          can_edit_projects: boolean
          can_edit_quotes: boolean
          can_edit_tasks: boolean
          can_manage_appointments: boolean
          can_manage_customers: boolean
          can_manage_projects: boolean
          can_manage_tasks: boolean
          can_view_calendar: boolean
          can_view_customers: boolean
          can_view_invoices: boolean
          can_view_projects: boolean
          can_view_quotes: boolean
          can_view_tasks: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_edit_customers?: boolean
          can_edit_invoices?: boolean
          can_edit_projects?: boolean
          can_edit_quotes?: boolean
          can_edit_tasks?: boolean
          can_manage_appointments?: boolean
          can_manage_customers?: boolean
          can_manage_projects?: boolean
          can_manage_tasks?: boolean
          can_view_calendar?: boolean
          can_view_customers?: boolean
          can_view_invoices?: boolean
          can_view_projects?: boolean
          can_view_quotes?: boolean
          can_view_tasks?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_edit_customers?: boolean
          can_edit_invoices?: boolean
          can_edit_projects?: boolean
          can_edit_quotes?: boolean
          can_edit_tasks?: boolean
          can_manage_appointments?: boolean
          can_manage_customers?: boolean
          can_manage_projects?: boolean
          can_manage_tasks?: boolean
          can_view_calendar?: boolean
          can_view_customers?: boolean
          can_view_invoices?: boolean
          can_view_projects?: boolean
          can_view_quotes?: boolean
          can_view_tasks?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_notifications: { Args: never; Returns: undefined }
      dispatch_reminders: { Args: never; Returns: undefined }
      has_permission: {
        Args: { _perm: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "employee"
      customer_status: "lead" | "active" | "completed" | "follow_up"
      invoice_status: "to_send" | "sent" | "paid" | "overdue"
      project_status: "planned" | "active" | "on_hold" | "completed" | "lost"
      quote_status: "draft" | "sent" | "approved" | "rejected"
      task_priority: "low" | "normal" | "high"
      task_status: "todo" | "in_progress" | "done"
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
      app_role: ["admin", "employee"],
      customer_status: ["lead", "active", "completed", "follow_up"],
      invoice_status: ["to_send", "sent", "paid", "overdue"],
      project_status: ["planned", "active", "on_hold", "completed", "lost"],
      quote_status: ["draft", "sent", "approved", "rejected"],
      task_priority: ["low", "normal", "high"],
      task_status: ["todo", "in_progress", "done"],
    },
  },
} as const
