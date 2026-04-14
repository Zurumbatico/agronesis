import { TRANSICIONES_LOTE } from '@/constants'
import type { EstadoLote } from '@/types/models'
import type { CategoriaClasificacion, Clasificacion, Despacho } from '@/types/models'

// ─────────────────────────────────────────────
// CONSTANTES DE PROCESO (Módulos 6 y 7 del PDF)
// Hardcodeadas por ahora; en el futuro vendrán de tabla config_sistema en DB
// ─────────────────────────────────────────────
export const PESO_CAJA_EXPORTACION_KG = 4.65
export const PCT_DESHIDRATACION = 0.05
export const CAJAS_POR_PALLET = 172
/** 3% del peso neto que corresponde al socio Alan Melendrez (Módulo 1 PDF) */
export const PCT_ALAN_MELENDREZ = 0.03
/** Tarifa de pago al seleccionador por kg procesado Cat 1 (S/ 0.20/kg) */
export const PRECIO_SELECCION_CAT1 = 0.20
/** Tarifa de pago al seleccionador por kg procesado Cat 2 (S/ 0.28/kg) */
export const PRECIO_SELECCION_CAT2 = 0.28
/** Tarifa de pago al empacador por caja completada (S/ 0.32/caja) */
export const PRECIO_EMPAQUE_CAJA = 0.32

/**
 * Calcula el peso neto promedio por jaba de un lote.
 * Si no hay jabas registradas, retorna 0 para evitar divisiones inválidas.
 */
export function calcularPesoPorJaba(pesoNetoKg: number, numJabas: number): number {
  if (!Number.isFinite(pesoNetoKg) || !Number.isFinite(numJabas) || numJabas <= 0) return 0
  return Math.round((pesoNetoKg / numJabas) * 100) / 100
}

/**
 * Calcula el peso neto que corresponde al agricultor: descuenta 3% de Alan Melendrez.
 * Resultado redondeado a 2 decimales.
 */
export function calcularPesoAgricultor(pesoKgBuenos: number): number {
  return Math.round(pesoKgBuenos * (1 - PCT_ALAN_MELENDREZ) * 100) / 100
}

/**
 * Calcula el pago a un seleccionador dado los kg buenos y la calidad del lote.
 * Cat1: S/ 0.20/kg, Cat2: S/ 0.28/kg
 */
export function calcularPagoSeleccionador(kgBueno: number, calidad: 'cat1' | 'cat2'): number {
  const precio = calidad === 'cat1' ? PRECIO_SELECCION_CAT1 : PRECIO_SELECCION_CAT2
  return Math.round(kgBueno * precio * 100) / 100
}

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
 * Calcula el número de cajas exportables a partir de los kg buenos clasificados.
 * Aplica ajuste por deshidratación (5%) y divide por el peso objetivo por caja (4.65 kg).
 * Siempre redondeado hacia abajo — no se puede empacar media caja.
 */
export function calcularCajasExportables(pesoKgBuenos: number): number {
  const exportableFinal = pesoKgBuenos * (1 - PCT_DESHIDRATACION)
  return Math.floor(exportableFinal / PESO_CAJA_EXPORTACION_KG)
}

/**
 * Calcula pallets completos y cajas restantes a partir del total de cajas.
 */
export function calcularPallets(nCajas: number): { completos: number; restantes: number } {
  return {
    completos: Math.floor(nCajas / CAJAS_POR_PALLET),
    restantes: nCajas % CAJAS_POR_PALLET,
  }
}

/**
 * Retorna totales por "categoría" compatibles con el módulo de liquidaciones.
 * Con el nuevo modelo, "primera" = kg buenos totales de la sesión.
 * num_cajas se calcula aplicando ajuste por deshidratación y dividiendo por peso/caja.
 */
export function calcularTotalesClasificacion(
  clasificaciones: Clasificacion[]
): Record<CategoriaClasificacion, { peso_kg: number; num_cajas: number }> {
  const totalBuenos = clasificaciones.reduce((acc, c) => acc + c.peso_bueno_kg, 0)
  return {
    primera:  { peso_kg: totalBuenos, num_cajas: calcularCajasExportables(totalBuenos) },
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
 * Valida que el despacho no supere las cajas exportables disponibles (ya descontando despachos anteriores).
 */
export function validarCajasDespacho(
  cajasDisponibles: number,
  cajasADespachar: number
): string | null {
  if (cajasADespachar > cajasDisponibles) {
    return `Las cajas a despachar (${cajasADespachar}) superan las disponibles (${cajasDisponibles})`
  }
  return null
}

/**
 * Calcula el valor total de un despacho
 */
export function calcularValorDespacho(despacho: Pick<Despacho, 'peso_neto_kg' | 'precio_venta_kg'>): number {
  return Math.round(despacho.peso_neto_kg * despacho.precio_venta_kg * 100) / 100
}
