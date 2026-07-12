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
      brands: {
        Row: {
          base_url: string
          created_at: string | null
          currency: string
          domain: string
          id: string
          logo_url: string | null
          name: string
          platform: string
          slug: string
          sync_status: string
        }
        Insert: {
          base_url: string
          created_at?: string | null
          currency?: string
          domain: string
          id?: string
          logo_url?: string | null
          name: string
          platform: string
          slug: string
          sync_status?: string
        }
        Update: {
          base_url?: string
          created_at?: string | null
          currency?: string
          domain?: string
          id?: string
          logo_url?: string | null
          name?: string
          platform?: string
          slug?: string
          sync_status?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          brand_id: string
          ends_at: string | null
          hero_image: string | null
          id: string
          kind: string
          source: string
          starts_at: string
          status: string
          subtitle: string | null
          title: string
        }
        Insert: {
          brand_id: string
          ends_at?: string | null
          hero_image?: string | null
          id?: string
          kind: string
          source?: string
          starts_at: string
          status?: string
          subtitle?: string | null
          title: string
        }
        Update: {
          brand_id?: string
          ends_at?: string | null
          hero_image?: string | null
          id?: string
          kind?: string
          source?: string
          starts_at?: string
          status?: string
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      events_analytics: {
        Row: {
          created_at: string | null
          id: number
          name: string
          props: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          name: string
          props?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: never
          name?: string
          props?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          brand_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_runs: {
        Row: {
          brand_slug: string
          drop_file: string
          error: string | null
          events_written: number | null
          finished_at: string | null
          id: number
          products_seen: number | null
          scraped_at: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          brand_slug: string
          drop_file: string
          error?: string | null
          events_written?: number | null
          finished_at?: string | null
          id?: never
          products_seen?: number | null
          scraped_at?: string | null
          started_at?: string | null
          status: string
        }
        Update: {
          brand_slug?: string
          drop_file?: string
          error?: string | null
          events_written?: number | null
          finished_at?: string | null
          id?: never
          products_seen?: number | null
          scraped_at?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          deeplink: string | null
          id: string
          read_at: string | null
          sent_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          deeplink?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          deeplink?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string | null
          id: number
          new_value: Json | null
          old_value: Json | null
          product_id: string
          type: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          product_id: string
          type: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          product_id?: string
          type?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          position: number
          product_id: string
          src: string
        }
        Insert: {
          id?: string
          position?: number
          product_id: string
          src: string
        }
        Update: {
          id?: string
          position?: number
          product_id?: string
          src?: string
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
          brand_id: string
          category: string | null
          description: string | null
          external_id: string
          fabric: string | null
          first_seen_at: string | null
          id: string
          is_active: boolean | null
          last_seen_at: string | null
          missing_count: number
          product_url: string
          tags: string[] | null
          title: string
        }
        Insert: {
          brand_id: string
          category?: string | null
          description?: string | null
          external_id: string
          fabric?: string | null
          first_seen_at?: string | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          missing_count?: number
          product_url: string
          tags?: string[] | null
          title: string
        }
        Update: {
          brand_id?: string
          category?: string | null
          description?: string | null
          external_id?: string
          fabric?: string | null
          first_seen_at?: string | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          missing_count?: number
          product_url?: string
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          expo_push_token: string | null
          id: string
          notif_prefs: Json | null
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          expo_push_token?: string | null
          id: string
          notif_prefs?: Json | null
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          expo_push_token?: string | null
          id?: string
          notif_prefs?: Json | null
          phone?: string | null
        }
        Relationships: []
      }
      variants: {
        Row: {
          available: boolean
          compare_at_price: number | null
          external_id: string
          id: string
          price: number
          product_id: string
          title: string | null
        }
        Insert: {
          available?: boolean
          compare_at_price?: number | null
          external_id: string
          id?: string
          price: number
          product_id: string
          title?: string | null
        }
        Update: {
          available?: boolean
          compare_at_price?: number | null
          external_id?: string
          id?: string
          price?: number
          product_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string | null
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_user_id_fkey"
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
