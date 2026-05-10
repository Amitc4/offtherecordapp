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
      admin_requests: {
        Row: {
          created_at: string
          id: string
          requested_role: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_display_name: string
          target_email: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          requested_role: string
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_display_name: string
          target_email: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          requested_role?: string
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_display_name?: string
          target_email?: string
          target_user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          sender_id: string
          text: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          sender_id: string
          text: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          archived_by: string[]
          created_at: string
          id: number
          last_read_p1: string
          last_read_p2: string
          participant_1: string
          participant_2: string
          record_id: string | null
          record_title: string | null
          updated_at: string
        }
        Insert: {
          archived_by?: string[]
          created_at?: string
          id?: number
          last_read_p1?: string
          last_read_p2?: string
          participant_1: string
          participant_2: string
          record_id?: string | null
          record_title?: string | null
          updated_at?: string
        }
        Update: {
          archived_by?: string[]
          created_at?: string
          id?: number
          last_read_p1?: string
          last_read_p2?: string
          participant_1?: string
          participant_2?: string
          record_id?: string | null
          record_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "user_records"
            referencedColumns: ["id"]
          },
        ]
      }
      discogs_tokens: {
        Row: {
          access_secret: string
          access_token: string
          created_at: string
          discogs_username: string | null
          id: string
          user_id: string
        }
        Insert: {
          access_secret: string
          access_token: string
          created_at?: string
          discogs_username?: string | null
          id?: string
          user_id: string
        }
        Update: {
          access_secret?: string
          access_token?: string
          created_at?: string
          discogs_username?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      grading_history: {
        Row: {
          confidence: number | null
          created_at: string
          defects: Json | null
          details: Json | null
          grade: string | null
          grade_label: string | null
          id: string
          notes: string | null
          photo_url: string | null
          photo_urls: string[] | null
          record_artist: string | null
          record_id: string | null
          record_title: string | null
          score: number | null
          summary: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          defects?: Json | null
          details?: Json | null
          grade?: string | null
          grade_label?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          record_artist?: string | null
          record_id?: string | null
          record_title?: string | null
          score?: number | null
          summary?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          defects?: Json | null
          details?: Json | null
          grade?: string | null
          grade_label?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          record_artist?: string | null
          record_id?: string | null
          record_title?: string | null
          score?: number | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_history_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "user_records"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          from_user_id: string | null
          id: string
          read: boolean
          record_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          read?: boolean
          record_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          read?: boolean
          record_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "user_records"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          created_at: string
          discogs_connected: boolean
          discogs_username: string | null
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          latitude: number | null
          longitude: number | null
          nickname: string | null
          phone_number: string | null
          short_id: string | null
          spotify_connected: boolean
          spotify_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          created_at?: string
          discogs_connected?: boolean
          discogs_username?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          nickname?: string | null
          phone_number?: string | null
          short_id?: string | null
          spotify_connected?: boolean
          spotify_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          created_at?: string
          discogs_connected?: boolean
          discogs_username?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          nickname?: string | null
          phone_number?: string | null
          short_id?: string | null
          spotify_connected?: boolean
          spotify_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      record_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          record_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          record_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_photos_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "user_records"
            referencedColumns: ["id"]
          },
        ]
      }
      spotify_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          scope: string | null
          spotify_display_name: string | null
          spotify_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          scope?: string | null
          spotify_display_name?: string | null
          spotify_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string | null
          spotify_display_name?: string | null
          spotify_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_inquiries: {
        Row: {
          admin_response: string | null
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_offer_items: {
        Row: {
          created_at: string
          id: string
          offer_id: string
          owner_id: string
          record_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          offer_id: string
          owner_id: string
          record_id: string
        }
        Update: {
          created_at?: string
          id?: string
          offer_id?: string
          owner_id?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "trade_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offer_items_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "user_records"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_offers: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          receiver_cash: number
          receiver_confirmed: boolean
          receiver_id: string
          sender_cash: number | null
          sender_confirmed: boolean
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          receiver_cash?: number
          receiver_confirmed?: boolean
          receiver_id: string
          sender_cash?: number | null
          sender_confirmed?: boolean
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          receiver_cash?: number
          receiver_confirmed?: boolean
          receiver_id?: string
          sender_cash?: number | null
          sender_confirmed?: boolean
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_records: {
        Row: {
          artist: string
          condition: string | null
          cover_image: string | null
          created_at: string
          discogs_release_id: number | null
          format: string | null
          genre: string | null
          id: string
          notes: string | null
          price: number | null
          sealed: boolean
          status: string
          title: string
          user_id: string
          year: number | null
        }
        Insert: {
          artist: string
          condition?: string | null
          cover_image?: string | null
          created_at?: string
          discogs_release_id?: number | null
          format?: string | null
          genre?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          sealed?: boolean
          status?: string
          title: string
          user_id: string
          year?: number | null
        }
        Update: {
          artist?: string
          condition?: string | null
          cover_image?: string | null
          created_at?: string
          discogs_release_id?: number | null
          format?: string | null
          genre?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          sealed?: boolean
          status?: string
          title?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: []
      }
      user_reviews: {
        Row: {
          created_at: string
          id: string
          offer_id: string
          rating: number
          review_text: string | null
          reviewed_id: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          offer_id: string
          rating: number
          review_text?: string | null
          reviewed_id: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          offer_id?: string
          rating?: number
          review_text?: string | null
          reviewed_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reviews_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "trade_offers"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_wishlist: {
        Row: {
          artist: string
          cover_image: string | null
          created_at: string
          discogs_release_id: number | null
          id: string
          notes: string | null
          title: string
          user_id: string
          year: number | null
        }
        Insert: {
          artist: string
          cover_image?: string | null
          created_at?: string
          discogs_release_id?: number | null
          id?: string
          notes?: string | null
          title: string
          user_id: string
          year?: number | null
        }
        Update: {
          artist?: string
          cover_image?: string | null
          created_at?: string
          discogs_release_id?: number | null
          id?: string
          notes?: string | null
          title?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "main_admin"
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
      app_role: ["admin", "user", "main_admin"],
    },
  },
} as const
