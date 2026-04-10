// ─────────────────────────────────────────────
// TIPOS DE BASE DE DATOS SUPABASE
// Este archivo refleja la estructura de la DB
// y es la fuente de verdad para los tipos row
// ─────────────────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      agricultores: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          apellido: string
          dni: string | null
          telefono: string | null
          numero_cuenta: string | null
          fecha_alta: string
          ubicacion: string | null
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['agricultores']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['agricultores']['Insert']>
        Relationships: []
      }
      acopiadores: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          apellido: string
          dni: string | null
          telefono: string | null
          numero_cuenta: string | null
          fecha_alta: string
          ubicacion: string | null
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['acopiadores']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['acopiadores']['Insert']>
        Relationships: []
      }
      colaboradores: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          apellido: string
          dni: string | null
          telefono: string | null
          numero_cuenta: string | null
          fecha_alta: string
          ubicacion: string | null
          rol: 'recepcionista' | 'seleccionador' | 'empaquetador'
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['colaboradores']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['colaboradores']['Insert']>
        Relationships: []
      }
      productos: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          variedad: 'snow_peas' | 'sugar'
          calidad: 'cat1' | 'cat2'
          tipo_produccion: 'organico' | 'convencional'
        }
        Insert: Omit<Database['public']['Tables']['productos']['Row'], 'id' | 'created_at' | 'updated_at' | 'codigo'> & {
          codigo?: string
        }
        Update: Partial<Database['public']['Tables']['productos']['Insert']>
        Relationships: []
      }
      agricultor_producto_hectareas: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          agricultor_id: string
          producto_id: string
          hectareas: number
        }
        Insert: Omit<Database['public']['Tables']['agricultor_producto_hectareas']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['agricultor_producto_hectareas']['Insert']>
        Relationships: []
      }
      personal_campo: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          apellido: string
          dni: string | null
          telefono: string | null
          numero_cuenta: string | null
          fecha_alta: string
          tipo: 'clasificador' | 'cosechador' | 'empacador' | 'supervisor'
          tarifa_destajo: number
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['personal_campo']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['personal_campo']['Insert']>
        Relationships: []
      }
      centros_acopio: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          ubicacion: string | null
          responsable: string | null
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['centros_acopio']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['centros_acopio']['Insert']>
        Relationships: []
      }
      lotes: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          agricultor_id: string
          acopiador_id: string | null
          acopiador_agricultor_id: string | null
          producto_id: string
          centro_acopio_id: string
          fecha_ingreso: string
          peso_bruto_kg: number
          peso_tara_kg: number
          peso_neto_kg: number
          num_cubetas: number
          jabas_prestadas: number
          codigo_lote_agricultor: string | null
          observaciones: string | null
          estado: 'ingresado' | 'en_clasificacion' | 'clasificado' | 'hidroculizado' | 'en_despacho' | 'despachado' | 'liquidado'
        }
        Insert: Omit<Database['public']['Tables']['lotes']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['lotes']['Insert']>
        Relationships: []
      }
      clasificaciones: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          lote_id: string
          fecha_clasificacion: string
          peso_bueno_kg: number
          observaciones: string | null
        }
        Insert: {
          created_by: string
          lote_id: string
          fecha_clasificacion: string
          peso_bueno_kg?: number
          observaciones?: string | null
        }
        Update: Partial<Database['public']['Tables']['clasificaciones']['Insert']>
        Relationships: []
      }
      clasificacion_aportes: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          clasificacion_id: string
          colaborador_id: string
          peso_bueno_kg: number
          kg_cat1: number
          kg_cat2: number
        }
        Insert: {
          created_by: string
          clasificacion_id: string
          colaborador_id: string
          peso_bueno_kg: number
          kg_cat1?: number
          kg_cat2?: number
        }
        Update: Partial<Database['public']['Tables']['clasificacion_aportes']['Insert']>
        Relationships: []
      }
      clasificacion_mesas: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          clasificacion_id: string
          nombre: string
          num_jabas: number
        }
        Insert: {
          created_by: string
          clasificacion_id: string
          nombre: string
          num_jabas?: number
        }
        Update: Partial<Database['public']['Tables']['clasificacion_mesas']['Insert']>
        Relationships: []
      }
      despachos: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          lote_id: string
          fecha_despacho: string
          destino: 'exportacion' | 'mercado_local' | 'planta_proceso'
          tipo_despacho: 'maritima' | 'aerea' | 'terrestre'
          transportista: string | null
          placa_vehiculo: string | null
          num_cajas_despachadas: number
          peso_neto_kg: number
          precio_venta_kg: number
          observaciones: string | null
          numero_senasa: string | null
        }
        Insert: Omit<Database['public']['Tables']['despachos']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['despachos']['Insert']>
        Relationships: []
      }
      liquidaciones_agri: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          agricultor_id: string
          fecha_inicio: string
          fecha_fin: string
          total_kg: number
          total_monto: number
          estado: 'borrador' | 'confirmada' | 'pagada'
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['liquidaciones_agri']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['liquidaciones_agri']['Insert']>
        Relationships: []
      }
      liquidacion_agri_detalle: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          liquidacion_id: string
          lote_id: string
          categoria: 'primera' | 'segunda' | 'descarte'
          peso_kg: number
          precio_kg: number
          subtotal: number
        }
        Insert: Omit<Database['public']['Tables']['liquidacion_agri_detalle']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['liquidacion_agri_detalle']['Insert']>
        Relationships: []
      }
      actividades_personal: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          personal_id: string
          lote_id: string
          tipo_actividad: 'clasificacion' | 'cosecha' | 'empaque' | 'carga'
          fecha: string
          cantidad_unidades: number
          tarifa_unitaria: number
          total: number
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['actividades_personal']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['actividades_personal']['Insert']>
        Relationships: []
      }
      liquidaciones_personal: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          personal_id: string
          quincena: string
          total_unidades: number
          total_monto: number
          estado: 'borrador' | 'confirmada' | 'pagada'
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['liquidaciones_personal']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['liquidaciones_personal']['Insert']>
        Relationships: []
      }
      movimientos_cubetas: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          agricultor_id: string
          lote_id: string | null
          tipo: 'entrega' | 'devolucion'
          cantidad: number
          fecha: string
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['movimientos_cubetas']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['movimientos_cubetas']['Insert']>
        Relationships: []
      }
      config_precios: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          semana: number
          anio: number
          variedad: 'snow_peas' | 'sugar'
          categoria: 'cat1' | 'cat2'
          precio_kg_sol: number
        }
        Insert: Omit<Database['public']['Tables']['config_precios']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['config_precios']['Insert']>
        Relationships: []
      }
      tareo_hidroculizado: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          lote_id: string
          colaborador_id: string
          fecha: string
          n_jabas: number
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['tareo_hidroculizado']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tareo_hidroculizado']['Insert']>
        Relationships: []
      }
      planillas_quincenales: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          periodo_inicio: string
          periodo_fin: string
          total_monto: number
          estado: 'pendiente' | 'pagada'
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['planillas_quincenales']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['planillas_quincenales']['Insert']>
        Relationships: []
      }
      planilla_detalles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          planilla_id: string
          colaborador_id: string
          kg_cat1_seleccion: number
          kg_cat2_seleccion: number
          pago_seleccion: number
          n_jabas_hidroculizado: number
          n_cajas_empaquetado: number
          monto_empaquetado: number
          otros_montos: number
          total: number
        }
        Insert: Omit<Database['public']['Tables']['planilla_detalles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['planilla_detalles']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      replace_agricultor_hectareas: {
        Args: {
          p_agricultor_id: string
          p_created_by: string
          p_items: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      estado_activo: 'activo' | 'inactivo'
      estado_lote: 'ingresado' | 'en_clasificacion' | 'clasificado' | 'hidroculizado' | 'en_despacho' | 'despachado' | 'liquidado'
      estado_liquidacion: 'borrador' | 'confirmada' | 'pagada'
      tipo_producto: 'holantao' | 'snow_peas' | 'otro'
      tipo_personal: 'clasificador' | 'cosechador' | 'empacador' | 'supervisor'
      categoria_clasificacion: 'primera' | 'segunda' | 'descarte'
      destino_despacho: 'exportacion' | 'mercado_local' | 'planta_proceso'
      tipo_movimiento_cubeta: 'entrega' | 'devolucion'
      tipo_actividad: 'clasificacion' | 'cosecha' | 'empaque' | 'carga'
    }
  }
}
