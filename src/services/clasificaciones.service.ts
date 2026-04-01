import { supabase } from '@/lib/supabase'
import type { Clasificacion, ClasificacionInsert } from '@/types/models'

const TABLE = 'clasificaciones' as const

export async function getClasificacionesPorLote(loteId: string): Promise<Clasificacion[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('lote_id', loteId)
    .order('fecha_clasificacion', { ascending: true })

  if (error) throw new Error(error.message)
  return data as unknown as Clasificacion[]
}

export async function createClasificacion(
  input: ClasificacionInsert,
  userId: string
): Promise<Clasificacion> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Clasificacion
}

export async function deleteClasificacion(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
