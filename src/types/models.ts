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
export type TipoProducto = 'holantao' | 'snow_peas' | 'otro'
export type UnidadMedida = 'kg' | 'caja' | 'cubeta'

export interface Producto extends BaseEntity {
  codigo: string
  nombre: string
  tipo: TipoProducto
  unidad_medida: UnidadMedida
  precio_base_kg: number
  estado: EstadoActivo
}

export type ProductoInsert = Omit<Producto, keyof BaseEntity>
export type ProductoUpdate = Partial<ProductoInsert>

// ─────────────────────────────────────────────
// PERSONAL DE CAMPO
// ─────────────────────────────────────────────
export type TipoPersonal = 'clasificador' | 'cosechador' | 'empacador' | 'supervisor'

export interface PersonalCampo extends BaseEntity {
  codigo: string
  nombre: string
  apellido: string
  dni: string | null
  telefono: string | null
  tipo: TipoPersonal
  tarifa_destajo: number
  estado: EstadoActivo
}

export type PersonalCampoInsert = Omit<PersonalCampo, keyof BaseEntity>
export type PersonalCampoUpdate = Partial<PersonalCampoInsert>

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
  personal_id: UUID
  categoria: CategoriaClasificacion
  peso_kg: number
  num_cajas: number
  fecha_clasificacion: string
  observaciones: string | null
  // relaciones
  personal?: PersonalCampo
  lote?: Lote
}

export type ClasificacionInsert = Omit<Clasificacion, keyof BaseEntity | 'personal' | 'lote'>
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
// ACTIVIDADES DE PERSONAL
// ─────────────────────────────────────────────
export type TipoActividad = 'clasificacion' | 'cosecha' | 'empaque' | 'carga'

export interface ActividadPersonal extends BaseEntity {
  personal_id: UUID
  lote_id: UUID
  tipo_actividad: TipoActividad
  fecha: string
  cantidad_unidades: number      // cajas, kg u otra unidad según actividad
  tarifa_unitaria: number
  total: number
  observaciones: string | null
  // relaciones
  personal?: PersonalCampo
  lote?: Lote
}

export type ActividadPersonalInsert = Omit<ActividadPersonal, keyof BaseEntity | 'personal' | 'lote'>
export type ActividadPersonalUpdate = Partial<ActividadPersonalInsert>

// ─────────────────────────────────────────────
// LIQUIDACIÓN PERSONAL
// ─────────────────────────────────────────────
export interface LiquidacionPersonal extends BaseEntity {
  codigo: string
  personal_id: UUID
  quincena: string      // formato: "2026-Q1-01" (año-quincena-num)
  total_unidades: number
  total_monto: number
  estado: EstadoLiquidacion
  observaciones: string | null
  // relaciones
  personal?: PersonalCampo
  actividades?: ActividadPersonal[]
}

export type LiquidacionPersonalInsert = Omit<LiquidacionPersonal, keyof BaseEntity | 'personal' | 'actividades'>
export type LiquidacionPersonalUpdate = Partial<LiquidacionPersonalInsert>

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
