import { supabase } from '@/lib/supabase'
import type { LiquidacionPersonal, LiquidacionPersonalInsert } from '@/types/models'

const TABLE = 'liquidaciones_personal' as const

export async function getLiquidacionesPersonal(): Promise<LiquidacionPersonal[]> {
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select('*, personal:personal_campo(*)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as LiquidacionPersonal[]
}

export async function getLiquidacionPersonal(id: string): Promise<LiquidacionPersonal> {
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select('*, personal:personal_campo(*), actividades:actividades_personal(*, lote:lotes(codigo))')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as LiquidacionPersonal
}

export async function createLiquidacionPersonal(
  input: LiquidacionPersonalInsert,
  userId: string
): Promise<LiquidacionPersonal> {
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select('*, personal:personal_campo(*)')
    .single()

  if (error) throw new Error(error.message)
  return data as LiquidacionPersonal
}

export async function actualizarEstadoLiquidacionPersonal(
  id: string,
  estado: 'borrador' | 'confirmada' | 'pagada'
): Promise<LiquidacionPersonal> {
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, personal:personal_campo(*)')
    .single()

  if (error) throw new Error(error.message)
  return data as LiquidacionPersonal
}
