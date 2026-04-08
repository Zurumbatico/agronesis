import { supabase } from '@/lib/supabase'
import type { Clasificacion, ClasificacionAporteInsert } from '@/types/models'

const TABLE = 'clasificaciones' as const
const TABLE_APORTES = 'clasificacion_aportes' as const

/**
 * Devuelve la sesión de clasificación de un lote junto con sus aportes.
 * Retorna un array de 0 ó 1 elemento (para compatibilidad con liquidaciones).
 */
export async function getClasificacionesPorLote(loteId: string): Promise<Clasificacion[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      *,
      aportes:clasificacion_aportes(*, colaborador:colaboradores(id, nombre, apellido, codigo))
    `)
    .eq('lote_id', loteId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data as unknown as Clasificacion[]
}

/**
 * Guarda (upsert) la sesión de clasificación de un lote y reemplaza todos sus aportes.
 */
export async function guardarClasificacion(
  loteId: string,
  fecha: string,
  observaciones: string | null,
  aportes: Array<{ colaborador_id: string; kg_cat1: number; kg_cat2: number }>,
  userId: string
): Promise<Clasificacion> {
  const totalBuenos = aportes.reduce((acc, a) => acc + a.kg_cat1 + a.kg_cat2, 0)

  const payloadBase: Record<string, unknown> = {
    lote_id: loteId,
    fecha_clasificacion: fecha,
    peso_bueno_kg: totalBuenos,
    observaciones,
    created_by: userId,
  }

  const upsertSesion = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(payload as never, { onConflict: 'lote_id' })
      .select('id')
      .single()
    return { data, error }
  }

  let { data: sesion, error: errSesion } = await upsertSesion(payloadBase)

  // Compatibilidad con esquemas antiguos de producción que todavía exigen columnas legacy.
  if (errSesion?.message.includes('peso_kg') && errSesion?.message.toLowerCase().includes('not-null')) {
    ;({ data: sesion, error: errSesion } = await upsertSesion({ ...payloadBase, peso_kg: totalBuenos }))
  }
  if (errSesion?.message.includes('categoria') && errSesion?.message.toLowerCase().includes('not-null')) {
    ;({ data: sesion, error: errSesion } = await upsertSesion({ ...payloadBase, peso_kg: totalBuenos, categoria: 'primera' }))
  }
  if (errSesion?.message.includes('num_cajas') && errSesion?.message.toLowerCase().includes('not-null')) {
    ;({ data: sesion, error: errSesion } = await upsertSesion({
      ...payloadBase,
      peso_kg: totalBuenos,
      categoria: 'primera',
      num_cajas: 0,
    }))
  }

  if (errSesion) throw new Error(errSesion.message)
  const clasificacionId = (sesion as { id: string }).id

  // Reemplazar aportes
  const { error: errDelAportes } = await supabase
    .from(TABLE_APORTES)
    .delete()
    .eq('clasificacion_id', clasificacionId)
  if (errDelAportes) throw new Error(errDelAportes.message)

  if (aportes.length > 0) {
    const rowsAportes: Array<ClasificacionAporteInsert & { created_by: string }> = aportes.map((a) => ({
      clasificacion_id: clasificacionId,
      colaborador_id: a.colaborador_id,
      peso_bueno_kg: a.kg_cat1 + a.kg_cat2,
      kg_cat1: a.kg_cat1,
      kg_cat2: a.kg_cat2,
      created_by: userId,
    }))
    const { error: errInsAportes } = await supabase.from(TABLE_APORTES).insert(rowsAportes)
    if (errInsAportes) throw new Error(errInsAportes.message)
  }

  // Devolver sesión completa
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      *,
      aportes:clasificacion_aportes(*, colaborador:colaboradores(id, nombre, apellido, codigo))
    `)
    .eq('id', clasificacionId)
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as Clasificacion
}

export async function deleteClasificacion(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
