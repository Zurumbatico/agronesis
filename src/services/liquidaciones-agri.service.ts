import { supabase } from '@/lib/supabase'
import type {
  LiquidacionAgri,
  LiquidacionAgriInsert,
  LiquidacionAgriDetalleInsert,
} from '@/types/models'

const TABLE = 'liquidaciones_agri' as const

export async function getLiquidacionesAgri(): Promise<LiquidacionAgri[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, agricultor:agricultores(*)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as LiquidacionAgri[]
}

export async function getLiquidacionAgri(id: string): Promise<LiquidacionAgri> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      *,
      agricultor:agricultores(*),
      detalles:liquidacion_agri_detalle(*, lote:lotes(codigo, fecha_ingreso))
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as LiquidacionAgri
}

export async function createLiquidacionAgri(
  input: LiquidacionAgriInsert,
  detalles: LiquidacionAgriDetalleInsert[],
  userId: string
): Promise<LiquidacionAgri> {
  const { data: liq, error: liqError } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (liqError) throw new Error(liqError.message)

  const { error: detError } = await supabase
    .from('liquidacion_agri_detalle')
    .insert(detalles.map((d) => ({ ...d, liquidacion_id: liq.id, created_by: userId })))

  if (detError) throw new Error(detError.message)

  return getLiquidacionAgri(liq.id)
}

export async function actualizarEstadoLiquidacionAgri(
  id: string,
  estado: 'borrador' | 'confirmada' | 'pagada'
): Promise<LiquidacionAgri> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, agricultor:agricultores(*)')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as LiquidacionAgri
}
