import type { BaseEntity, EstadoActivo, UUID } from './common'

// ─────────────────────────────────────────────
// AGRICULTOR
// ─────────────────────────────────────────────
export interface Agricultor extends BaseEntity {
  codigo: string
  nombre: string
  apellido: string
  dni: string | null
  telefono: string | null
  numero_cuenta: string | null
  fecha_alta: string
  ubicacion: string | null
  estado: EstadoActivo
  hectareas?: AgricultorHectarea[]
}

export type AgricultorInsert = Omit<Agricultor, keyof BaseEntity | 'hectareas'>
export type AgricultorUpdate = Partial<AgricultorInsert>

export interface AgricultorHectarea extends BaseEntity {
  agricultor_id: UUID
  producto_id: UUID
  hectareas: number
  producto?: Producto
}

export type AgricultorHectareaInsert = Omit<AgricultorHectarea, keyof BaseEntity | 'producto'>
export type AgricultorHectareaUpdate = Partial<AgricultorHectareaInsert>

// ─────────────────────────────────────────────
// PRODUCTO
// ─────────────────────────────────────────────
export type VariedadProducto = 'snow_peas' | 'sugar'
export type CalidadProducto = 'cat1' | 'cat2'
export type TipoProduccion = 'organico' | 'convencional'

export interface Producto extends BaseEntity {
  codigo: string
  nombre: string
  variedad: VariedadProducto
  calidad: CalidadProducto
  tipo_produccion: TipoProduccion
}

export type ProductoInsert = Omit<Producto, keyof BaseEntity>
export type ProductoUpdate = Partial<ProductoInsert>

// ─────────────────────────────────────────────
// CENTRO DE ACOPIO
// ─────────────────────────────────────────────
export interface CentroAcopio extends BaseEntity {
  codigo: string
  nombre: string
  ubicacion: string | null
  responsable: string | null
  estado: EstadoActivo
}

export type CentroAcopioInsert = Omit<CentroAcopio, keyof BaseEntity>
export type CentroAcopioUpdate = Partial<CentroAcopioInsert>

// ─────────────────────────────────────────────
// LOTE
// ─────────────────────────────────────────────
export type EstadoLote =
  | 'ingresado'
  | 'en_clasificacion'
  | 'clasificado'
  | 'en_despacho'
  | 'despachado'
  | 'liquidado'

export interface Lote extends BaseEntity {
  codigo: string
  agricultor_id: UUID
  producto_id: UUID
  centro_acopio_id: UUID
  fecha_ingreso: string           // ISO date
  peso_bruto_kg: number
  peso_tara_kg: number
  peso_neto_kg: number
  num_cubetas: number
  observaciones: string | null
  estado: EstadoLote
  // relaciones (join)
  agricultor?: Agricultor
  producto?: Producto
  centro_acopio?: CentroAcopio
}

export type LoteInsert = Omit<Lote, keyof BaseEntity | 'agricultor' | 'producto' | 'centro_acopio'>
export type LoteUpdate = Partial<LoteInsert>

// ─────────────────────────────────────────────
// CLASIFICACIÓN
// ─────────────────────────────────────────────
export type CategoriaClasificacion = 'primera' | 'segunda' | 'descarte'

export interface Clasificacion extends BaseEntity {
  lote_id: UUID
  personal_id: UUID | null
  categoria: CategoriaClasificacion
  peso_kg: number
  num_cajas: number
  fecha_clasificacion: string
  observaciones: string | null
  // relaciones
  lote?: Lote
}

export type ClasificacionInsert = Omit<Clasificacion, keyof BaseEntity | 'lote' | 'personal_id'> & {
  personal_id?: UUID | null
}
export type ClasificacionUpdate = Partial<ClasificacionInsert>

// ─────────────────────────────────────────────
// DESPACHO
// ─────────────────────────────────────────────
export type DestinoDespacho = 'exportacion' | 'mercado_local' | 'planta_proceso'

export interface Despacho extends BaseEntity {
  lote_id: UUID
  fecha_despacho: string
  destino: DestinoDespacho
  transportista: string | null
  placa_vehiculo: string | null
  num_cajas_despachadas: number
  peso_neto_kg: number
  precio_venta_kg: number
  observaciones: string | null
  // relaciones
  lote?: Lote
}

export type DespachoInsert = Omit<Despacho, keyof BaseEntity | 'lote'>
export type DespachoUpdate = Partial<DespachoInsert>

// ─────────────────────────────────────────────
// LIQUIDACIÓN AGRICULTOR
// ─────────────────────────────────────────────
export type EstadoLiquidacion = 'borrador' | 'confirmada' | 'pagada'

export interface LiquidacionAgri extends BaseEntity {
  codigo: string
  agricultor_id: UUID
  fecha_inicio: string
  fecha_fin: string
  total_kg: number
  total_monto: number
  estado: EstadoLiquidacion
  observaciones: string | null
  // relaciones
  agricultor?: Agricultor
  detalles?: LiquidacionAgriDetalle[]
}

export interface LiquidacionAgriDetalle extends BaseEntity {
  liquidacion_id: UUID
  lote_id: UUID
  categoria: CategoriaClasificacion
  peso_kg: number
  precio_kg: number
  subtotal: number
  // relaciones
  lote?: Lote
}

export type LiquidacionAgriInsert = Omit<LiquidacionAgri, keyof BaseEntity | 'agricultor' | 'detalles'>
export type LiquidacionAgriUpdate = Partial<LiquidacionAgriInsert>

export type LiquidacionAgriDetalleInsert = Omit<LiquidacionAgriDetalle, keyof BaseEntity | 'lote'>

// ─────────────────────────────────────────────
// MOVIMIENTO DE CUBETAS
// ─────────────────────────────────────────────
export type TipoMovimientoCubeta = 'entrega' | 'devolucion'

export interface MovimientoCubeta extends BaseEntity {
  agricultor_id: UUID
  lote_id: UUID | null
  tipo: TipoMovimientoCubeta
  cantidad: number
  fecha: string
  observaciones: string | null
  // relaciones
  agricultor?: Agricultor
  lote?: Lote
}

export type MovimientoCubetaInsert = Omit<MovimientoCubeta, keyof BaseEntity | 'agricultor' | 'lote'>
export type MovimientoCubetaUpdate = Partial<MovimientoCubetaInsert>

// ─────────────────────────────────────────────
// BALANCE DE CUBETAS (virtual, calculado)
// ─────────────────────────────────────────────
export interface BalanceCubetaAgri {
  agricultor_id: UUID
  agricultor?: Agricultor
  total_entregadas: number
  total_devueltas: number
  saldo_pendiente: number
}
