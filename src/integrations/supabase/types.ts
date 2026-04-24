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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      quality_records: {
        Row: {
          bf: number | null
          colour: string | null
          created_at: string
          day: number | null
          denier: string | null
          dispergent_used: string | null
          id: string
          mc_no: string | null
          month: number | null
          party_name: string | null
          pt: number | null
          quality: string | null
          rate_litres_min: number | null
          record_date: string | null
          sd_unit_no: string | null
          shade_no: string | null
          shade_variation: number | null
          total_shade_pct: number | null
          type_of_mixer: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          bf?: number | null
          colour?: string | null
          created_at?: string
          day?: number | null
          denier?: string | null
          dispergent_used?: string | null
          id?: string
          mc_no?: string | null
          month?: number | null
          party_name?: string | null
          pt?: number | null
          quality?: string | null
          rate_litres_min?: number | null
          record_date?: string | null
          sd_unit_no?: string | null
          shade_no?: string | null
          shade_variation?: number | null
          total_shade_pct?: number | null
          type_of_mixer?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          bf?: number | null
          colour?: string | null
          created_at?: string
          day?: number | null
          denier?: string | null
          dispergent_used?: string | null
          id?: string
          mc_no?: string | null
          month?: number | null
          party_name?: string | null
          pt?: number | null
          quality?: string | null
          rate_litres_min?: number | null
          record_date?: string | null
          sd_unit_no?: string | null
          shade_no?: string | null
          shade_variation?: number | null
          total_shade_pct?: number | null
          type_of_mixer?: string | null
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          batch_volume: number | null
          cellulose: number | null
          cf_only_cf: string | null
          consumption_per_day: number | null
          created_at: string
          customer_name: string | null
          days_required: number | null
          denier_filament: string | null
          id: string
          mc_no: string | null
          no_of_positions: number | null
          pigment_conc_full: number | null
          pigment_conc_half: number | null
          pigments: Json | null
          production_to_be_done_kg: number | null
          pump_throw: number | null
          rate_cc_min: number | null
          rate_lit_hr: number | null
          results: Json | null
          sdu_no: string | null
          shade_name: string
          shade_no: string | null
          total_batches: number | null
          total_consumption: number | null
          total_qty: number | null
          total_shade_loading: number | null
          user_id: string
          water_qty: number | null
        }
        Insert: {
          batch_volume?: number | null
          cellulose?: number | null
          cf_only_cf?: string | null
          consumption_per_day?: number | null
          created_at?: string
          customer_name?: string | null
          days_required?: number | null
          denier_filament?: string | null
          id?: string
          mc_no?: string | null
          no_of_positions?: number | null
          pigment_conc_full?: number | null
          pigment_conc_half?: number | null
          pigments?: Json | null
          production_to_be_done_kg?: number | null
          pump_throw?: number | null
          rate_cc_min?: number | null
          rate_lit_hr?: number | null
          results?: Json | null
          sdu_no?: string | null
          shade_name: string
          shade_no?: string | null
          total_batches?: number | null
          total_consumption?: number | null
          total_qty?: number | null
          total_shade_loading?: number | null
          user_id: string
          water_qty?: number | null
        }
        Update: {
          batch_volume?: number | null
          cellulose?: number | null
          cf_only_cf?: string | null
          consumption_per_day?: number | null
          created_at?: string
          customer_name?: string | null
          days_required?: number | null
          denier_filament?: string | null
          id?: string
          mc_no?: string | null
          no_of_positions?: number | null
          pigment_conc_full?: number | null
          pigment_conc_half?: number | null
          pigments?: Json | null
          production_to_be_done_kg?: number | null
          pump_throw?: number | null
          rate_cc_min?: number | null
          rate_lit_hr?: number | null
          results?: Json | null
          sdu_no?: string | null
          shade_name?: string
          shade_no?: string | null
          total_batches?: number | null
          total_consumption?: number | null
          total_qty?: number | null
          total_shade_loading?: number | null
          user_id?: string
          water_qty?: number | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
