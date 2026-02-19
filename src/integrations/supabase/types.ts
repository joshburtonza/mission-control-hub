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
      agents: {
        Row: {
          created_at: string | null
          current_task: string | null
          health_check: boolean | null
          id: string
          last_activity: string | null
          name: string
          role: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_task?: string | null
          health_check?: boolean | null
          id?: string
          last_activity?: string | null
          name: string
          role: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_task?: string | null
          health_check?: boolean | null
          id?: string
          last_activity?: string | null
          name?: string
          role?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      approvals: {
        Row: {
          approval_type: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          email_queue_id: string | null
          id: string
          notes: string | null
          request_body: string | null
          requested_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approval_type?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email_queue_id?: string | null
          id?: string
          notes?: string | null
          request_body?: string | null
          requested_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_type?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email_queue_id?: string | null
          id?: string
          notes?: string | null
          request_body?: string | null
          requested_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string | null
          agent: string | null
          created_at: string | null
          details: Json | null
          duration_ms: number | null
          error_message: string | null
          executed_at: string | null
          id: string
          status: string | null
        }
        Insert: {
          action?: string | null
          agent?: string | null
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          action?: string | null
          agent?: string | null
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          contact_person: string | null
          created_at: string | null
          email_addresses: string[] | null
          id: string
          name: string
          notes: string | null
          project_name: string | null
          slug: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          contact_person?: string | null
          created_at?: string | null
          email_addresses?: string[] | null
          id?: string
          name: string
          notes?: string | null
          project_name?: string | null
          slug: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_person?: string | null
          created_at?: string | null
          email_addresses?: string[] | null
          id?: string
          name?: string
          notes?: string | null
          project_name?: string | null
          slug?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          analysis: Json | null
          body: string | null
          client: string | null
          created_at: string | null
          from_email: string
          id: string
          priority: number | null
          received_at: string | null
          requires_approval: boolean | null
          status: string | null
          subject: string
          to_email: string
          updated_at: string | null
        }
        Insert: {
          analysis?: Json | null
          body?: string | null
          client?: string | null
          created_at?: string | null
          from_email: string
          id?: string
          priority?: number | null
          received_at?: string | null
          requires_approval?: boolean | null
          status?: string | null
          subject: string
          to_email: string
          updated_at?: string | null
        }
        Update: {
          analysis?: Json | null
          body?: string | null
          client?: string | null
          created_at?: string | null
          from_email?: string
          id?: string
          priority?: number | null
          received_at?: string | null
          requires_approval?: boolean | null
          status?: string | null
          subject?: string
          to_email?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      kill_switch: {
        Row: {
          id: string
          reason: string | null
          status: string | null
          triggered_at: string | null
          triggered_by: string | null
        }
        Insert: {
          id: string
          reason?: string | null
          status?: string | null
          triggered_at?: string | null
          triggered_by?: string | null
        }
        Update: {
          id?: string
          reason?: string | null
          status?: string | null
          triggered_at?: string | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          agent: string | null
          body: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          priority: string
          read_at: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          action_url?: string | null
          agent?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          read_at?: string | null
          status?: string
          title: string
          type?: string
        }
        Update: {
          action_url?: string | null
          agent?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          read_at?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      sophia_csm_config: {
        Row: {
          auto_response_enabled: boolean | null
          cc_emails: string[] | null
          client_id: string | null
          created_at: string | null
          escalation_keywords: string[] | null
          id: string
          response_time_max: number | null
          response_time_min: number | null
          updated_at: string | null
        }
        Insert: {
          auto_response_enabled?: boolean | null
          cc_emails?: string[] | null
          client_id?: string | null
          created_at?: string | null
          escalation_keywords?: string[] | null
          id?: string
          response_time_max?: number | null
          response_time_min?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_response_enabled?: boolean | null
          cc_emails?: string[] | null
          client_id?: string | null
          created_at?: string | null
          escalation_keywords?: string[] | null
          id?: string
          response_time_max?: number | null
          response_time_min?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sophia_csm_config_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      task_queue: {
        Row: {
          agent: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          payload: Json | null
          result: Json | null
          retry_count: number | null
          started_at: string | null
          status: string | null
          task_type: string | null
          updated_at: string | null
        }
        Insert: {
          agent?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          task_type?: string | null
          updated_at?: string | null
        }
        Update: {
          agent?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          task_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          priority: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
