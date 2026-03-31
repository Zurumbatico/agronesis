import { supabase } from '@/lib/supabase'
import type { Despacho, DespachoInsert } from '@/types/models'

const TABLE = 'despachos' as const

export async function getDespachosPorLote(loteId: string): Promise<Despacho[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('lote_id', loteId)
    .order('fecha_despacho', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Despacho[]
}

export async function getDespacho(id: string): Promise<Despacho> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, lote:lotes(*, agricultor:agricultores(*), producto:productos(*))')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Despacho
}

export async function createDespacho(input: DespachoInsert, userId: string): Promise<Despacho> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Despacho
}

export async function updateDespacho(id: string, input: Partial<DespachoInsert>): Promise<Despacho> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Despacho
}
