export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      senhas: {
        Row: {
          atendente_id: string | null
          atendente_nome: string | null
          created_at: string
          guiche: string | null
          hora_atendimento: string | null
          hora_chamada: string | null
          hora_retirada: string | null
          id: string
          numero: number
          observacoes: string | null
          prefixo: string | null
          prioridade: string | null
          prioridade_nivel: string | null
          senha_completa: string | null
          status: Database["public"]["Enums"]["senha_status"]
          tipo: Database["public"]["Enums"]["senha_tipo"]
          tipo_checkin: Database["public"]["Enums"]["tipo_checkin"] | null
          updated_at: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          atendente_id?: string | null
          atendente_nome?: string | null
          created_at?: string
          guiche?: string | null
          hora_atendimento?: string | null
          hora_chamada?: string | null
          hora_retirada?: string | null
          id?: string
          numero: number
          observacoes?: string | null
          prefixo?: string | null
          prioridade?: string | null
          prioridade_nivel?: string | null
          senha_completa?: string | null
          status?: Database["public"]["Enums"]["senha_status"]
          tipo: Database["public"]["Enums"]["senha_tipo"]
          tipo_checkin?: Database["public"]["Enums"]["tipo_checkin"] | null
          updated_at?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          atendente_id?: string | null
          atendente_nome?: string | null
          created_at?: string
          guiche?: string | null
          hora_atendimento?: string | null
          hora_chamada?: string | null
          hora_retirada?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          prefixo?: string | null
          prioridade?: string | null
          prioridade_nivel?: string | null
          senha_completa?: string | null
          status?: Database["public"]["Enums"]["senha_status"]
          tipo?: Database["public"]["Enums"]["senha_tipo"]
          tipo_checkin?: Database["public"]["Enums"]["tipo_checkin"] | null
          updated_at?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          senha: string
          tipo: Database["public"]["Enums"]["usuario_tipo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome: string
          senha: string
          tipo: Database["public"]["Enums"]["usuario_tipo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          senha?: string
          tipo?: Database["public"]["Enums"]["usuario_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_proximo_numero_senha: {
        Args: {
          tipo_senha: Database["public"]["Enums"]["senha_tipo"]
        }
        Returns: number
      }
    }
    Enums: {
      senha_status: "aguardando" | "atendendo" | "atendida" | "cancelada" | "chamando" | "expirada"
      senha_tipo: "check-in" | "check-out" | "express" | "normal" | "preferencial" | "proprietario"
      tipo_checkin: "express" | "normal" | "proprietario"
      usuario_tipo: "admin" | "atendente" | "gerente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  SENHA_STATUS: {
    AGUARDANDO: 'aguardando' as const,
    CHAMANDO: 'chamando' as const,
    ATENDENDO: 'atendendo' as const,
    ATENDIDA: 'atendida' as const,
    CANCELADA: 'cancelada' as const,
    EXPIRADA: 'expirada' as const,
  },
  SENHA_TIPO: {
    NORMAL: 'normal' as const,
    PRIORITARIO: 'prioritario' as const,
    EXPRESS: 'express' as const,
    PREFERENCIAL: 'preferencial' as const,
    PROPRIETARIO: 'proprietario' as const,
  },
  TIPO_CHECKIN: {
    NORMAL: 'normal' as const,
    EXPRESS: 'express' as const,
    PROPRIETARIO: 'proprietario' as const,
  },
  PRIORIDADE_NIVEL: {
    COMUM: 'comum' as const,
    PRIORITARIO: 'prioritario' as const,
  },
  USUARIO_TIPO: {
    ADMIN: 'admin' as const,
    ATENDENTE: 'atendente' as const,
    GERENTE: 'gerente' as const,
  },
} as const;
