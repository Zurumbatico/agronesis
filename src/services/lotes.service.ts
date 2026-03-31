import { supabase } from '@/lib/supabase'
import type { Lote, LoteInsert, LoteUpdate } from '@/types/models'

const TABLE = 'lotes' as const
const SELECT_COMPLETO = `
  *,
  agricultor:agricultores(*),
  producto:productos(*),
  centro_acopio:centros_acopio(*)
`

export async function getLotes(): Promise<Lote[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COMPLETO)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as Lote[]
}

export async function getLote(id: string): Promise<Lote> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COMPLETO)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Lote
}

export async function createLote(input: LoteInsert, userId: string): Promise<Lote> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select(SELECT_COMPLETO)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Lote
}

export async function updateLote(id: string, input: LoteUpdate): Promise<Lote> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT_COMPLETO)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Lote
}

export async function actualizarEstadoLote(id: string, estado: Lote['estado']): Promise<Lote> {
  return updateLote(id, { estado })
}
