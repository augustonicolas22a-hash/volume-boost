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
      admins: {
        Row: {
          created_at: string | null
          creditos: number
          criado_por: number | null
          email: string
          id: number
          ip_address: string | null
          key: string
          last_active: string | null
          nome: string
          pin: string | null
          profile_photo: string | null
          rank: string | null
          session_token: string | null
        }
        Insert: {
          created_at?: string | null
          creditos?: number
          criado_por?: number | null
          email: string
          id?: number
          ip_address?: string | null
          key: string
          last_active?: string | null
          nome: string
          pin?: string | null
          profile_photo?: string | null
          rank?: string | null
          session_token?: string | null
        }
        Update: {
          created_at?: string | null
          creditos?: number
          criado_por?: number | null
          email?: string
          id?: number
          ip_address?: string | null
          key?: string
          last_active?: string | null
          nome?: string
          pin?: string | null
          profile_photo?: string | null
          rank?: string | null
          session_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admins_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          from_admin_id: number | null
          id: number
          to_admin_id: number
          total_price: number | null
          transaction_type: string
          unit_price: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          from_admin_id?: number | null
          id?: number
          to_admin_id: number
          total_price?: number | null
          transaction_type: string
          unit_price?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          from_admin_id?: number | null
          id?: number
          to_admin_id?: number
          total_price?: number | null
          transaction_type?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_from_admin_id_fkey"
            columns: ["from_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_to_admin_id_fkey"
            columns: ["to_admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          created_at: string
          id: number
          month: number
          target_revenue: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: number
          month: number
          target_revenue?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: number
          month?: number
          target_revenue?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      pix_payments: {
        Row: {
          admin_id: number
          admin_name: string
          amount: number
          created_at: string | null
          credits: number
          id: number
          paid_at: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          admin_id: number
          admin_name: string
          amount: number
          created_at?: string | null
          credits: number
          id?: number
          paid_at?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          admin_id?: number
          admin_name?: string
          amount?: number
          created_at?: string | null
          credits?: number
          id?: number
          paid_at?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_payments_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tiers: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          max_qty: number | null
          min_qty: number
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          max_qty?: number | null
          min_qty: number
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          max_qty?: number | null
          min_qty?: number
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_admin: {
        Args: { target_id: number; viewer_id: number }
        Returns: boolean
      }
      create_master: {
        Args: {
          p_creator_id: number
          p_email: string
          p_key: string
          p_nome: string
          p_session_token: string
        }
        Returns: number
      }
      create_reseller: {
        Args: {
          p_creator_id: number
          p_email: string
          p_key: string
          p_nome: string
          p_session_token: string
        }
        Returns: number
      }
      get_admin_balance: {
        Args: { p_admin_id: number; p_session_token: string }
        Returns: number
      }
      get_admin_by_id: {
        Args: { p_admin_id: number; p_session_token: string }
        Returns: {
          created_at: string
          creditos: number
          email: string
          id: number
          nome: string
          profile_photo: string
          rank: string
        }[]
      }
      get_admin_rank: { Args: { p_admin_id: number }; Returns: string }
      get_all_masters: {
        Args: { p_admin_id: number; p_session_token: string }
        Returns: {
          created_at: string
          creditos: number
          email: string
          id: number
          nome: string
        }[]
      }
      get_dashboard_stats: {
        Args: { p_admin_id: number; p_session_token: string }
        Returns: {
          total_credits: number
          total_masters: number
          total_resellers: number
        }[]
      }
      get_price_tiers: {
        Args: { p_admin_id: number; p_session_token: string }
        Returns: {
          id: number
          is_active: boolean
          max_qty: number
          min_qty: number
          price: number
        }[]
      }
      get_resellers_by_master: {
        Args: { p_master_id: number; p_session_token: string }
        Returns: {
          created_at: string
          creditos: number
          email: string
          id: number
          nome: string
        }[]
      }
      is_valid_admin: {
        Args: { p_admin_id: number; p_session_token: string }
        Returns: boolean
      }
      logout_admin: { Args: { p_admin_id: number }; Returns: boolean }
      recharge_credits: {
        Args: {
          p_admin_id: number
          p_amount: number
          p_total_price: number
          p_unit_price: number
        }
        Returns: boolean
      }
      search_admins: {
        Args: { p_admin_id: number; p_query: string; p_session_token: string }
        Returns: {
          creditos: number
          email: string
          id: number
          nome: string
          rank: string
        }[]
      }
      set_admin_pin: {
        Args: { p_admin_id: number; p_pin: string }
        Returns: boolean
      }
      transfer_credits: {
        Args: {
          p_amount: number
          p_from_admin_id: number
          p_to_admin_id: number
        }
        Returns: boolean
      }
      validate_login: {
        Args: { p_email: string; p_key: string }
        Returns: {
          creditos: number
          email: string
          has_pin: boolean
          id: number
          nome: string
          profile_photo: string
          rank: string
          session_token: string
        }[]
      }
      validate_pin: {
        Args: { p_admin_id: number; p_pin: string }
        Returns: boolean
      }
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
