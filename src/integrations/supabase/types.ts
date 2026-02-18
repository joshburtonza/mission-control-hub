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
          id: string
          last_activity: string | null
          name: string
          role: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          current_task?: string | null
          id?: string
          last_activity?: string | null
          name: string
          role: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          current_task?: string | null
          id?: string
          last_activity?: string | null
          name?: string
          role?: string
          status?: string | null
        }
        Relationships: []
      }
      approvals: {
        Row: {
          approval_type: string | null
          approved_by: string | null
          created_at: string | null
          email_queue_id: string | null
          id: string
          request_body: string | null
          status: string | null
        }
        Insert: {
          approval_type?: string | null
          approved_by?: string | null
          created_at?: string | null
          email_queue_id?: string | null
          id?: string
          request_body?: string | null
          status?: string | null
        }
        Update: {
          approval_type?: string | null
          approved_by?: string | null
          created_at?: string | null
          email_queue_id?: string | null
          id?: string
          request_body?: string | null
          status?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string | null
          agent: string | null
          details: Json | null
          error_message: string | null
          executed_at: string | null
          id: string
          status: string | null
        }
        Insert: {
          action?: string | null
          agent?: string | null
          details?: Json | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          action?: string | null
          agent?: string | null
          details?: Json | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          email_addresses: string[] | null
          id: string
          name: string
          project_name: string | null
          slug: string
        }
        Insert: {
          email_addresses?: string[] | null
          id?: string
          name: string
          project_name?: string | null
          slug: string
        }
        Update: {
          email_addresses?: string[] | null
          id?: string
          name?: string
          project_name?: string | null
          slug?: string
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
          requires_approval: boolean | null
          status: string | null
          subject: string
          to_email: string
        }
        Insert: {
          analysis?: Json | null
          body?: string | null
          client?: string | null
          created_at?: string | null
          from_email: string
          id?: string
          requires_approval?: boolean | null
          status?: string | null
          subject: string
          to_email: string
        }
        Update: {
          analysis?: Json | null
          body?: string | null
          client?: string | null
          created_at?: string | null
          from_email?: string
          id?: string
          requires_approval?: boolean | null
          status?: string | null
          subject?: string
          to_email?: string
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
      task_queue: {
        Row: {
          agent: string | null
          created_at: string | null
          id: string
          payload: Json | null
          result: Json | null
          status: string | null
          task_type: string | null
        }
        Insert: {
          agent?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string | null
          task_type?: string | null
        }
        Update: {
          agent?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string | null
          task_type?: string | null
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
