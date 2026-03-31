import { supabase } from '@/lib/supabase'
import type { AgricultorHectarea } from '@/types/models'

const TABLE = 'agricultor_producto_hectareas' as const
const SELECT_DETALLE = `
  *,
  producto:productos(*)
`

export type AgricultorHectareaInput = Pick<AgricultorHectarea, 'producto_id' | 'hectareas'>

export async function getAgricultorHectareas(agricultorId: string): Promise<AgricultorHectarea[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_DETALLE)
    .eq('agricultor_id', agricultorId)

  if (error) throw new Error(error.message)
  return data as unknown as AgricultorHectarea[]
}

export async function syncAgricultorHectareas(
  agricultorId: string,
  items: AgricultorHectareaInput[],
  userId: string
): Promise<AgricultorHectarea[]> {
  const payload = items
    .filter((item) => item.producto_id && Number.isFinite(item.hectareas) && item.hectareas > 0)
    .map((item) => ({
      producto_id: item.producto_id,
      hectareas: Number(item.hectareas),
    }))

  const { error } = await supabase.rpc('replace_agricultor_hectareas', {
    p_agricultor_id: agricultorId,
    p_created_by: userId,
    p_items: payload,
  })

  if (error) throw new Error(error.message)
  return getAgricultorHectareas(agricultorId)
}