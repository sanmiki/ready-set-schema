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
      account_suspensions: {
        Row: {
          created_at: string
          reason: string
          suspended_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reason?: string
          suspended_by: string
          user_id: string
        }
        Update: {
          created_at?: string
          reason?: string
          suspended_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_suspensions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          meta: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          product_id: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          product_id?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          product_id?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          amount_tetri: number | null
          context: string
          context_key: string
          created_at: string
          document_key: string
          document_version: string
          id: string
          product_id: string | null
          user_id: string
        }
        Insert: {
          amount_tetri?: number | null
          context: string
          context_key: string
          created_at?: string
          document_key: string
          document_version: string
          id?: string
          product_id?: string | null
          user_id: string
        }
        Update: {
          amount_tetri?: number | null
          context?: string
          context_key?: string
          created_at?: string
          document_key?: string
          document_version?: string
          id?: string
          product_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      listing_contacts: {
        Row: {
          is_public: boolean
          phone: string
          product_id: string
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          is_public?: boolean
          phone: string
          product_id: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          is_public?: boolean
          phone?: string
          product_id?: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "listing_contacts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_moderation: {
        Row: {
          created_at: string
          kind: string
          moderated_by: string
          previous_status: Database["public"]["Enums"]["product_status"]
          product_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          kind: string
          moderated_by: string
          previous_status: Database["public"]["Enums"]["product_status"]
          product_id: string
          reason?: string
        }
        Update: {
          created_at?: string
          kind?: string
          moderated_by?: string
          previous_status?: Database["public"]["Enums"]["product_status"]
          product_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_moderation_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_promotions: {
        Row: {
          amount_tetri: number
          bump_mode: string
          created_at: string
          days: number
          ends_at: string
          highlight: boolean
          id: string
          idempotency_key: string
          method: string
          product_id: string
          starts_at: string
          tier: string | null
          user_id: string
        }
        Insert: {
          amount_tetri: number
          bump_mode?: string
          created_at?: string
          days: number
          ends_at: string
          highlight?: boolean
          id?: string
          idempotency_key: string
          method: string
          product_id: string
          starts_at?: string
          tier?: string | null
          user_id: string
        }
        Update: {
          amount_tetri?: number
          bump_mode?: string
          created_at?: string
          days?: number
          ends_at?: string
          highlight?: boolean
          id?: string
          idempotency_key?: string
          method?: string
          product_id?: string
          starts_at?: string
          tier?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_promotions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_publications: {
        Row: {
          amount_tetri: number
          created_at: string
          method: Database["public"]["Enums"]["publication_method"]
          product_id: string
          user_id: string
        }
        Insert: {
          amount_tetri?: number
          created_at?: string
          method: Database["public"]["Enums"]["publication_method"]
          product_id: string
          user_id: string
        }
        Update: {
          amount_tetri?: number
          created_at?: string
          method?: Database["public"]["Enums"]["publication_method"]
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_tetri: number
          created_at: string
          id: string
          product_id: string | null
          provider: string | null
          provider_ref: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_tetri: number
          created_at?: string
          id?: string
          product_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_tetri?: number
          created_at?: string
          id?: string
          product_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          purpose?: Database["public"]["Enums"]["payment_purpose"]
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          contact_email: string
          contact_phone: string
          first_listing_free: boolean
          id: boolean
          listing_fee_tetri: number
          moderation_note: string
          updated_at: string
        }
        Insert: {
          contact_email?: string
          contact_phone?: string
          first_listing_free?: boolean
          id?: boolean
          listing_fee_tetri?: number
          moderation_note?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_phone?: string
          first_listing_free?: boolean
          id?: boolean
          listing_fee_tetri?: number
          moderation_note?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          id?: string
          product_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          id?: string
          product_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          audience: string | null
          brand: string | null
          category_id: string | null
          city: string | null
          color: string | null
          condition: string
          created_at: string
          description: string
          id: string
          neighborhood: string | null
          price: number
          seller_id: string
          size: string | null
          status: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string | null
          brand?: string | null
          category_id?: string | null
          city?: string | null
          color?: string | null
          condition?: string
          created_at?: string
          description?: string
          id?: string
          neighborhood?: string | null
          price: number
          seller_id: string
          size?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string | null
          brand?: string | null
          category_id?: string | null
          city?: string | null
          color?: string | null
          condition?: string
          created_at?: string
          description?: string
          id?: string
          neighborhood?: string | null
          price?: number
          seller_id?: string
          size?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          display_name: string | null
          id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
      promotion_prices: {
        Row: {
          code: string
          tetri: number
          updated_at: string
        }
        Insert: {
          code: string
          tetri: number
          updated_at?: string
        }
        Update: {
          code?: string
          tetri?: number
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_decision: string | null
          created_at: string
          details: string
          id: string
          product_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          admin_decision?: string | null
          created_at?: string
          details?: string
          id?: string
          product_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          admin_decision?: string | null
          created_at?: string
          details?: string
          id?: string
          product_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_contacts: {
        Row: {
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_tetri: number
          created_at: string
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["wallet_tx_kind"]
          payment_id: string | null
          product_id: string | null
          user_id: string
        }
        Insert: {
          amount_tetri: number
          created_at?: string
          id?: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["wallet_tx_kind"]
          payment_id?: string | null
          product_id?: string | null
          user_id: string
        }
        Update: {
          amount_tetri?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["wallet_tx_kind"]
          payment_id?: string | null
          product_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_finance: { Args: { _limit: number }; Returns: Json }
      admin_listings: {
        Args: {
          _category: string
          _limit: number
          _offset: number
          _q: string
          _since: string
          _status: string
        }
        Returns: {
          category_name: string
          created_at: string
          id: string
          image_path: string
          moderation: string
          moderation_reason: string
          price: number
          reports: number
          seller_id: string
          seller_username: string
          status: Database["public"]["Enums"]["product_status"]
          title: string
          total: number
        }[]
      }
      admin_moderate_listing: {
        Args: { _action: string; _product_id: string; _reason: string }
        Returns: string
      }
      admin_promotions: {
        Args: { _limit: number; _offset: number }
        Returns: {
          amount_tetri: number
          bump_mode: string
          days: number
          ends_at: string
          highlight: boolean
          id: string
          method: string
          paid: boolean
          product_id: string
          product_title: string
          seller_username: string
          starts_at: string
          tier: string
          total: number
        }[]
      }
      admin_reports: {
        Args: { _limit: number; _offset: number; _status: string }
        Returns: {
          admin_decision: string
          created_at: string
          details: string
          id: string
          product_id: string
          product_title: string
          reason: string
          reported_user_id: string
          reported_username: string
          reporter_username: string
          reviewed_at: string
          status: string
          total: number
        }[]
      }
      admin_set_suspension: {
        Args: { _reason: string; _suspend: boolean; _user_id: string }
        Returns: string
      }
      admin_stats: { Args: never; Returns: Json }
      admin_update_report: {
        Args: { _decision: string; _report_id: string; _status: string }
        Returns: string
      }
      admin_update_settings: {
        Args: {
          _email: string
          _fee: number
          _first_free: boolean
          _note: string
          _phone: string
          _prices: Json
        }
        Returns: string
      }
      admin_users: {
        Args: { _limit: number; _offset: number; _q: string; _status: string }
        Returns: {
          active_listings: number
          city: string
          created_at: string
          display_name: string
          id: string
          listings: number
          reports: number
          suspended: boolean
          suspension_reason: string
          total: number
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_suspended: { Args: { _uid: string }; Returns: boolean }
      listing_fee_quote: { Args: never; Returns: number }
      listing_has_public_phone: {
        Args: { _product_id: string }
        Returns: boolean
      }
      listing_public_phone: { Args: { _product_id: string }; Returns: string }
      listing_public_whatsapp: {
        Args: { _product_id: string }
        Returns: string
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      messaging_inbox: {
        Args: never
        Returns: {
          buyer_id: string
          id: string
          image_path: string
          latest_content: string
          other_name: string
          product_id: string
          product_title: string
          seller_id: string
          unread_count: number
          updated_at: string
        }[]
      }
      promoted_listings: {
        Args: never
        Returns: {
          highlighted: boolean
          product_id: string
          rank_at: string
          tier_rank: number
        }[]
      }
      promotion_quote: {
        Args: {
          _bump: string
          _days: number
          _highlight: boolean
          _tier: string
        }
        Returns: number
      }
      publish_listing: { Args: { _product_id: string }; Returns: string }
      purchase_promotion: {
        Args: {
          _bump: string
          _days: number
          _highlight: boolean
          _key: string
          _product_id: string
          _tier: string
        }
        Returns: string
      }
      record_legal_acceptance: {
        Args: {
          _amount_tetri?: number
          _context: string
          _context_key: string
          _product_id?: string
        }
        Returns: undefined
      }
      require_admin: { Args: never; Returns: string }
      start_conversation: { Args: { _product_id: string }; Returns: string }
      wallet_balance: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin"
      payment_purpose: "topup" | "listing"
      payment_status: "pending" | "paid" | "failed" | "canceled"
      product_status: "draft" | "active" | "reserved" | "sold"
      publication_method: "free" | "wallet" | "card" | "legacy"
      wallet_tx_kind: "topup" | "listing_charge" | "refund" | "promotion_charge"
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
      app_role: ["admin"],
      payment_purpose: ["topup", "listing"],
      payment_status: ["pending", "paid", "failed", "canceled"],
      product_status: ["draft", "active", "reserved", "sold"],
      publication_method: ["free", "wallet", "card", "legacy"],
      wallet_tx_kind: ["topup", "listing_charge", "refund", "promotion_charge"],
    },
  },
} as const
