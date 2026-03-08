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
      agent_commands: {
        Row: {
          ack_at: string | null
          command: string
          created_at: string | null
          done_at: string | null
          expires_at: string | null
          from_agent_id: string
          id: string
          payload: Json | null
          result: string | null
          status: string
          to_agent_id: string
        }
        Insert: {
          ack_at?: string | null
          command: string
          created_at?: string | null
          done_at?: string | null
          expires_at?: string | null
          from_agent_id: string
          id?: string
          payload?: Json | null
          result?: string | null
          status?: string
          to_agent_id: string
        }
        Update: {
          ack_at?: string | null
          command?: string
          created_at?: string | null
          done_at?: string | null
          expires_at?: string | null
          from_agent_id?: string
          id?: string
          payload?: Json | null
          result?: string | null
          status?: string
          to_agent_id?: string
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          agent: string
          confidence: number
          content: string
          created_at: string
          id: string
          memory_type: string
          reinforced_at: string
          scope: string
        }
        Insert: {
          agent: string
          confidence?: number
          content: string
          created_at?: string
          id?: string
          memory_type: string
          reinforced_at?: string
          scope: string
        }
        Update: {
          agent?: string
          confidence?: number
          content?: string
          created_at?: string
          id?: string
          memory_type?: string
          reinforced_at?: string
          scope?: string
        }
        Relationships: []
      }
      agent_metrics: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          metrics: Json
          period: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          metrics?: Json
          period: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          metrics?: Json
          period?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      agent_registry: {
        Row: {
          agent_id: string
          created_at: string | null
          description: string | null
          display_name: string
          domain: string | null
          error_count_today: number
          is_enabled: boolean
          kpis: Json | null
          last_result: string | null
          last_run_at: string | null
          last_run_duration_ms: number | null
          machine: string | null
          next_run_at: string | null
          run_count_today: number
          status: string
          supervisor_id: string | null
          tier: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          description?: string | null
          display_name: string
          domain?: string | null
          error_count_today?: number
          is_enabled?: boolean
          kpis?: Json | null
          last_result?: string | null
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          machine?: string | null
          next_run_at?: string | null
          run_count_today?: number
          status?: string
          supervisor_id?: string | null
          tier: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          domain?: string | null
          error_count_today?: number
          is_enabled?: boolean
          kpis?: Json | null
          last_result?: string | null
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          machine?: string | null
          next_run_at?: string | null
          run_count_today?: number
          status?: string
          supervisor_id?: string | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
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
      calendar_events: {
        Row: {
          all_day: boolean | null
          attendees: Json | null
          calendar_id: string | null
          description: string | null
          end_at: string | null
          id: string
          location: string | null
          meet_link: string | null
          start_at: string
          status: string | null
          synced_at: string | null
          title: string
        }
        Insert: {
          all_day?: boolean | null
          attendees?: Json | null
          calendar_id?: string | null
          description?: string | null
          end_at?: string | null
          id: string
          location?: string | null
          meet_link?: string | null
          start_at: string
          status?: string | null
          synced_at?: string | null
          title: string
        }
        Update: {
          all_day?: boolean | null
          attendees?: Json | null
          calendar_id?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          location?: string | null
          meet_link?: string | null
          start_at?: string
          status?: string | null
          synced_at?: string | null
          title?: string
        }
        Relationships: []
      }
      client_activity: {
        Row: {
          client_slug: string
          created_at: string | null
          event_type: string
          id: number
          metadata: Json | null
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          client_slug: string
          created_at?: string | null
          event_type: string
          id?: number
          metadata?: Json | null
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          client_slug?: string
          created_at?: string | null
          event_type?: string
          id?: number
          metadata?: Json | null
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      client_activity_alerts: {
        Row: {
          client_slug: string
          last_alerted_at: string | null
          last_event_count: number | null
        }
        Insert: {
          client_slug: string
          last_alerted_at?: string | null
          last_event_count?: number | null
        }
        Update: {
          client_slug?: string
          last_alerted_at?: string | null
          last_event_count?: number | null
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
          profile: Json | null
          project_name: string | null
          sentiment: string | null
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
          profile?: Json | null
          project_name?: string | null
          sentiment?: string | null
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
          profile?: Json | null
          project_name?: string | null
          sentiment?: string | null
          slug?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      debt_entries: {
        Row: {
          created_at: string | null
          id: string
          interest_rate: number | null
          monthly_payment: number
          name: string
          notes: string | null
          remaining_amount: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interest_rate?: number | null
          monthly_payment: number
          name: string
          notes?: string | null
          remaining_amount: number
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interest_rate?: number | null
          monthly_payment?: number
          name?: string
          notes?: string | null
          remaining_amount?: number
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          analysis: Json | null
          approval_telegram_message_id: string | null
          approval_telegram_sent_at: string | null
          body: string | null
          client: string | null
          created_at: string | null
          from_email: string
          gmail_thread_id: string | null
          id: string
          last_error: string | null
          priority: number | null
          received_at: string | null
          requires_approval: boolean | null
          scheduled_send_at: string | null
          sent_at: string | null
          status: string | null
          subject: string
          to_email: string
          updated_at: string | null
        }
        Insert: {
          analysis?: Json | null
          approval_telegram_message_id?: string | null
          approval_telegram_sent_at?: string | null
          body?: string | null
          client?: string | null
          created_at?: string | null
          from_email: string
          gmail_thread_id?: string | null
          id?: string
          last_error?: string | null
          priority?: number | null
          received_at?: string | null
          requires_approval?: boolean | null
          scheduled_send_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          to_email: string
          updated_at?: string | null
        }
        Update: {
          analysis?: Json | null
          approval_telegram_message_id?: string | null
          approval_telegram_sent_at?: string | null
          body?: string | null
          client?: string | null
          created_at?: string | null
          from_email?: string
          gmail_thread_id?: string | null
          id?: string
          last_error?: string | null
          priority?: number | null
          received_at?: string | null
          requires_approval?: boolean | null
          scheduled_send_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          to_email?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      finance_config: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          account_type: string | null
          amount: number
          balance_after: number | null
          category: string | null
          created_at: string | null
          date: string
          description: string | null
          fnb_tx_id: string | null
          fx_fee: number | null
          id: string
          matched_client: string | null
          matched_sub: string | null
          merchant_name: string | null
          notes: string | null
          reference: string | null
          type: string
        }
        Insert: {
          account_type?: string | null
          amount: number
          balance_after?: number | null
          category?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          fnb_tx_id?: string | null
          fx_fee?: number | null
          id?: string
          matched_client?: string | null
          matched_sub?: string | null
          merchant_name?: string | null
          notes?: string | null
          reference?: string | null
          type: string
        }
        Update: {
          account_type?: string | null
          amount?: number
          balance_after?: number | null
          category?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          fnb_tx_id?: string | null
          fx_fee?: number | null
          id?: string
          matched_client?: string | null
          matched_sub?: string | null
          merchant_name?: string | null
          notes?: string | null
          reference?: string | null
          type?: string
        }
        Relationships: []
      }
      group_chat_history: {
        Row: {
          chat_id: string
          id: string
          is_bot: boolean | null
          message: string
          sender: string
          ts: string | null
        }
        Insert: {
          chat_id: string
          id?: string
          is_bot?: boolean | null
          message: string
          sender: string
          ts?: string | null
        }
        Update: {
          chat_id?: string
          id?: string
          is_bot?: boolean | null
          message?: string
          sender?: string
          ts?: string | null
        }
        Relationships: []
      }
      income_entries: {
        Row: {
          amount: number
          client: string
          created_at: string | null
          currency: string | null
          id: string
          month: string
          notes: string | null
          project: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          client: string
          created_at?: string | null
          currency?: string | null
          id?: string
          month: string
          notes?: string | null
          project: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          client?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          month?: string
          notes?: string | null
          project?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      interaction_log: {
        Row: {
          actor: string
          id: string
          notes: string | null
          processed: boolean
          signal_data: Json
          signal_type: string
          timestamp: string
          user_id: string
        }
        Insert: {
          actor: string
          id?: string
          notes?: string | null
          processed?: boolean
          signal_data?: Json
          signal_type: string
          timestamp?: string
          user_id: string
        }
        Update: {
          actor?: string
          id?: string
          notes?: string | null
          processed?: boolean
          signal_data?: Json
          signal_type?: string
          timestamp?: string
          user_id?: string
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
      leads: {
        Row: {
          ai_analysed_at: string | null
          ai_analysis: Json | null
          ai_score: number | null
          alexa_ranking: number | null
          angellist_url: string | null
          annual_revenue: string | null
          apollo_id: string | null
          assigned_to: string | null
          client_id: string | null
          company: string | null
          company_description: string | null
          company_keywords: string[] | null
          company_languages: string[] | null
          company_linkedin_url: string | null
          company_phone: string | null
          created_at: string | null
          departments: string[] | null
          dept_head_count: Json | null
          email: string
          email_status: string | null
          employee_count: number | null
          enriched_at: string | null
          facebook_url: string | null
          first_name: string
          founded_year: number | null
          funding_events: Json | null
          headline: string | null
          id: string
          industry: string | null
          last_contacted_at: string | null
          last_name: string | null
          latest_funding_stage: string | null
          linkedin_status: string | null
          linkedin_url: string | null
          location_city: string | null
          location_country: string | null
          logo_url: string | null
          market_cap: string | null
          notes: string | null
          person_city: string | null
          person_country: string | null
          person_timezone: string | null
          photo_url: string | null
          publicly_traded_exchange: string | null
          publicly_traded_symbol: string | null
          quality_score: number
          reply_received_at: string | null
          reply_sentiment: string | null
          seniority: string | null
          source: string | null
          status: string | null
          tags: string[] | null
          tech_stack: string[] | null
          title: string | null
          total_funding: string | null
          twitter_url: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          ai_analysed_at?: string | null
          ai_analysis?: Json | null
          ai_score?: number | null
          alexa_ranking?: number | null
          angellist_url?: string | null
          annual_revenue?: string | null
          apollo_id?: string | null
          assigned_to?: string | null
          client_id?: string | null
          company?: string | null
          company_description?: string | null
          company_keywords?: string[] | null
          company_languages?: string[] | null
          company_linkedin_url?: string | null
          company_phone?: string | null
          created_at?: string | null
          departments?: string[] | null
          dept_head_count?: Json | null
          email: string
          email_status?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          facebook_url?: string | null
          first_name: string
          founded_year?: number | null
          funding_events?: Json | null
          headline?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          latest_funding_stage?: string | null
          linkedin_status?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          logo_url?: string | null
          market_cap?: string | null
          notes?: string | null
          person_city?: string | null
          person_country?: string | null
          person_timezone?: string | null
          photo_url?: string | null
          publicly_traded_exchange?: string | null
          publicly_traded_symbol?: string | null
          quality_score?: number
          reply_received_at?: string | null
          reply_sentiment?: string | null
          seniority?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          tech_stack?: string[] | null
          title?: string | null
          total_funding?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          ai_analysed_at?: string | null
          ai_analysis?: Json | null
          ai_score?: number | null
          alexa_ranking?: number | null
          angellist_url?: string | null
          annual_revenue?: string | null
          apollo_id?: string | null
          assigned_to?: string | null
          client_id?: string | null
          company?: string | null
          company_description?: string | null
          company_keywords?: string[] | null
          company_languages?: string[] | null
          company_linkedin_url?: string | null
          company_phone?: string | null
          created_at?: string | null
          departments?: string[] | null
          dept_head_count?: Json | null
          email?: string
          email_status?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          facebook_url?: string | null
          first_name?: string
          founded_year?: number | null
          funding_events?: Json | null
          headline?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          latest_funding_stage?: string | null
          linkedin_status?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          logo_url?: string | null
          market_cap?: string | null
          notes?: string | null
          person_city?: string | null
          person_country?: string | null
          person_timezone?: string | null
          photo_url?: string | null
          publicly_traded_exchange?: string | null
          publicly_traded_symbol?: string | null
          quality_score?: number
          reply_received_at?: string | null
          reply_sentiment?: string | null
          seniority?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          tech_stack?: string[] | null
          title?: string | null
          total_funding?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_users: {
        Row: {
          allowed_pages: string[] | null
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          role: string
        }
        Insert: {
          allowed_pages?: string[] | null
          created_at?: string | null
          display_name?: string | null
          email: string
          id?: string
          role?: string
        }
        Update: {
          allowed_pages?: string[] | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          role?: string
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
      outreach_log: {
        Row: {
          body: string | null
          created_at: string | null
          gmail_message_id: string | null
          id: string
          lead_id: string
          open_count: number
          opened_at: string | null
          sent_at: string | null
          step: number
          subject: string | null
          tracking_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          gmail_message_id?: string | null
          id?: string
          lead_id: string
          open_count?: number
          opened_at?: string | null
          sent_at?: string | null
          step: number
          subject?: string | null
          tracking_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          gmail_message_id?: string | null
          id?: string
          lead_id?: string
          open_count?: number
          opened_at?: string | null
          sent_at?: string | null
          step?: number
          subject?: string | null
          tracking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sources: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          raw_content: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          raw_content: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          raw_content?: string
          status?: string
          title?: string
          updated_at?: string
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
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          category: string
          created_at: string | null
          currency: string
          id: string
          name: string
          notes: string | null
          status: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          category?: string
          created_at?: string | null
          currency?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          category?: string
          created_at?: string | null
          currency?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
        }
        Relationships: []
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
      user_models: {
        Row: {
          communication: Json
          created_at: string
          decision_patterns: Json
          flags: Json
          goals: Json
          id: string
          preferences: Json
          raw_observations: string[]
          relationship: Json
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          communication?: Json
          created_at?: string
          decision_patterns?: Json
          flags?: Json
          goals?: Json
          id?: string
          preferences?: Json
          raw_observations?: string[]
          relationship?: Json
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          communication?: Json
          created_at?: string
          decision_patterns?: Json
          flags?: Json
          goals?: Json
          id?: string
          preferences?: Json
          raw_observations?: string[]
          relationship?: Json
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          chat_id: string
          client_slug: string | null
          created_at: string | null
          from_number: string | null
          group_name: string | null
          id: string
          inbound_text: string | null
          is_group: boolean | null
          outbound_text: string | null
          sender_name: string | null
          skipped: boolean | null
        }
        Insert: {
          chat_id: string
          client_slug?: string | null
          created_at?: string | null
          from_number?: string | null
          group_name?: string | null
          id?: string
          inbound_text?: string | null
          is_group?: boolean | null
          outbound_text?: string | null
          sender_name?: string | null
          skipped?: boolean | null
        }
        Update: {
          chat_id?: string
          client_slug?: string | null
          created_at?: string | null
          from_number?: string | null
          group_name?: string | null
          id?: string
          inbound_text?: string | null
          is_group?: boolean | null
          outbound_text?: string | null
          sender_name?: string | null
          skipped?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_agent_commands: { Args: never; Returns: undefined }
      log_email_open: { Args: { log_id: string }; Returns: undefined }
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
