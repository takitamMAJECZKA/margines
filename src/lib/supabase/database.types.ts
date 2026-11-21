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
      dictionaries: {
        Row: {
          color: string
          created_at: string
          id: string
          is_native: boolean
          name: string
          sort_order: number
          source_language: string
          target_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_native?: boolean
          name: string
          sort_order?: number
          source_language: string
          target_language: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_native?: boolean
          name?: string
          sort_order?: number
          source_language?: string
          target_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      set_words: {
        Row: {
          created_at: number
          dictionary_id: string
          set_id: string
          user_id: string
          word_id: string
        }
        Insert: {
          created_at: number
          dictionary_id: string
          set_id: string
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: number
          dictionary_id?: string
          set_id?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_words_set_id_dictionary_id_user_id_fkey"
            columns: ["set_id", "dictionary_id", "user_id"]
            isOneToOne: false
            referencedRelation: "word_sets"
            referencedColumns: ["id", "dictionary_id", "user_id"]
          },
          {
            foreignKeyName: "set_words_word_id_dictionary_id_user_id_fkey"
            columns: ["word_id", "dictionary_id", "user_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id", "dictionary_id", "user_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          default_word_input_language: string
          legacy_imported_at: string | null
          onboarding_completed_at: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          default_word_input_language?: string
          legacy_imported_at?: string | null
          onboarding_completed_at?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          default_word_input_language?: string
          legacy_imported_at?: string | null
          onboarding_completed_at?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      word_sets: {
        Row: {
          created_at: number
          dictionary_id: string
          id: string
          name: string
          updated_at: number
          user_id: string
        }
        Insert: {
          created_at: number
          dictionary_id: string
          id?: string
          name: string
          updated_at: number
          user_id: string
        }
        Update: {
          created_at?: number
          dictionary_id?: string
          id?: string
          name?: string
          updated_at?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_sets_dictionary_id_user_id_fkey"
            columns: ["dictionary_id", "user_id"]
            isOneToOne: false
            referencedRelation: "dictionaries"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      words: {
        Row: {
          created_at: number
          dictionary_id: string
          example_attribution: string
          example_sentence: string
          example_source: string
          example_source_url: string
          example_translation: string
          example_type: string
          id: string
          knowledge_score: number
          last_appeared_at: number | null
          last_review_known: boolean | null
          last_reviewed_at: number | null
          normalized_word: string
          original_word: string
          review_count: number
          translation: string
          updated_at: number
          user_id: string
        }
        Insert: {
          created_at: number
          dictionary_id: string
          example_attribution?: string
          example_sentence?: string
          example_source?: string
          example_source_url?: string
          example_translation?: string
          example_type?: string
          id?: string
          knowledge_score?: number
          last_appeared_at?: number | null
          last_review_known?: boolean | null
          last_reviewed_at?: number | null
          normalized_word: string
          original_word: string
          review_count?: number
          translation?: string
          updated_at: number
          user_id: string
        }
        Update: {
          created_at?: number
          dictionary_id?: string
          example_attribution?: string
          example_sentence?: string
          example_source?: string
          example_source_url?: string
          example_translation?: string
          example_type?: string
          id?: string
          knowledge_score?: number
          last_appeared_at?: number | null
          last_review_known?: boolean | null
          last_reviewed_at?: number | null
          normalized_word?: string
          original_word?: string
          review_count?: number
          translation?: string
          updated_at?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "words_dictionary_id_user_id_fkey"
            columns: ["dictionary_id", "user_id"]
            isOneToOne: false
            referencedRelation: "dictionaries"
            referencedColumns: ["id", "user_id"]
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
    Enums: {},
  },
} as const

