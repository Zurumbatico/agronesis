import { TRANSICIONES_LOTE } from '@/constants'
import type { EstadoLote } from '@/types/models'
import type { CategoriaClasificacion, Clasificacion, Despacho } from '@/types/models'

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: LOTES Y ESTADOS
// ─────────────────────────────────────────────

/**
 * Verifica si una transición de estado de lote es válida
 */
export function puedeTransicionarLote(
  estadoActual: EstadoLote,
  nuevoEstado: EstadoLote
): boolean {
  const permitidos = TRANSICIONES_LOTE[estadoActual] ?? []
  return permitidos.includes(nuevoEstado)
}

/**
 * Retorna el próximo estado válido de un lote
 */
export function siguienteEstadoLote(estadoActual: EstadoLote): EstadoLote | null {
  const permitidos = TRANSICIONES_LOTE[estadoActual]
  if (!permitidos || permitidos.length === 0) return null
  return permitidos[0] as EstadoLote
}

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: CLASIFICACIONES
// ─────────────────────────────────────────────

/**
 * Retorna totales por "categoría" compatibles con el módulo de liquidaciones.
 * Con el nuevo modelo, "primera" = kg buenos totales de la sesión;
 * segunda y descarte quedan en cero (ya no se registran por separado).
 */
export function calcularTotalesClasificacion(
  clasificaciones: Clasificacion[]
): Record<CategoriaClasificacion, { peso_kg: number; num_cajas: number }> {
  const totalBuenos = clasificaciones.reduce((acc, c) => acc + c.peso_bueno_kg, 0)
  return {
    primera:  { peso_kg: totalBuenos, num_cajas: 0 },
    segunda:  { peso_kg: 0,           num_cajas: 0 },
    descarte: { peso_kg: 0,           num_cajas: 0 },
  }
}

/**
 * Calcula el total de kg buenos de un lote (suma de sessions).
 */
export function calcularPesoTotalClasificado(clasificaciones: Clasificacion[]): number {
  return clasificaciones.reduce((acc, c) => acc + c.peso_bueno_kg, 0)
}

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: LIQUIDACIONES
// ─────────────────────────────────────────────

/**
 * Calcula el subtotal de una línea de liquidación
 */
export function calcularSubtotalLiquidacion(pesoKg: number, precioKg: number): number {
  return Math.round(pesoKg * precioKg * 100) / 100
}

/**
 * Calcula el total de una liquidación agri a partir de sus detalles
 */
export function calcularTotalLiquidacionAgri(
  detalles: Array<{ peso_kg: number; precio_kg: number }>
): { total_kg: number; total_monto: number } {
  const total_kg = detalles.reduce((acc, d) => acc + d.peso_kg, 0)
  const total_monto = detalles.reduce(
    (acc, d) => acc + calcularSubtotalLiquidacion(d.peso_kg, d.precio_kg),
    0
  )
  return {
    total_kg: Math.round(total_kg * 100) / 100,
    total_monto: Math.round(total_monto * 100) / 100,
  }
}

/**
 * Calcula el total de una liquidación de personal
 */
export function calcularTotalActividades(
  actividades: Array<{ cantidad_unidades: number; tarifa_unitaria: number }>
): { total_unidades: number; total_monto: number } {
  const total_unidades = actividades.reduce((acc, a) => acc + a.cantidad_unidades, 0)
  const total_monto = actividades.reduce(
    (acc, a) => acc + a.cantidad_unidades * a.tarifa_unitaria,
    0
  )
  return {
    total_unidades,
    total_monto: Math.round(total_monto * 100) / 100,
  }
}

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: CUBETAS
// ─────────────────────────────────────────────

/**
 * Calcula el saldo pendiente de cubetas de un agricultor
 */
export function calcularSaldoCubetas(
  movimientos: Array<{ tipo: 'entrega' | 'devolucion'; cantidad: number }>
): { total_entregadas: number; total_devueltas: number; saldo_pendiente: number } {
  const total_entregadas = movimientos
    .filter((m) => m.tipo === 'entrega')
    .reduce((acc, m) => acc + m.cantidad, 0)

  const total_devueltas = movimientos
    .filter((m) => m.tipo === 'devolucion')
    .reduce((acc, m) => acc + m.cantidad, 0)

  return {
    total_entregadas,
    total_devueltas,
    saldo_pendiente: total_entregadas - total_devueltas,
  }
}

// ─────────────────────────────────────────────
// REGLAS DE NEGOCIO: DESPACHO
// ─────────────────────────────────────────────

/**
 * Valida que el despacho tenga cajas disponibles según clasificaciones
 */
export function validarCajasDespacho(
  totalCajasClasificadas: number,
  cajasADespachar: number
): string | null {
  if (cajasADespachar > totalCajasClasificadas) {
    return `Las cajas a despachar (${cajasADespachar}) superan las clasificadas (${totalCajasClasificadas})`
  }
  return null
}

/**
 * Calcula el valor total de un despacho
 */
export function calcularValorDespacho(despacho: Pick<Despacho, 'peso_neto_kg' | 'precio_venta_kg'>): number {
  return Math.round(despacho.peso_neto_kg * despacho.precio_venta_kg * 100) / 100
}
