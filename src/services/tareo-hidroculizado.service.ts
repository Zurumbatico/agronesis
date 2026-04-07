import { supabase } from '@/lib/supabase'
import type { TareoHidroculizado, TareoHidroculizadoInsert } from '@/types/models'

const TABLE = 'tareo_hidroculizado' as const

export async function getTareoHidroculizadoPorLote(loteId: string): Promise<TareoHidroculizado[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, colaborador:colaboradores(id, nombre, apellido)')
    .eq('lote_id', loteId)
    .order('fecha', { ascending: true })

  if (error) throw new Error(error.message)
  return data as unknown as TareoHidroculizado[]
}

export async function createTareoHidroculizado(
  input: TareoHidroculizadoInsert,
  userId: string
): Promise<TareoHidroculizado> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select('*, colaborador:colaboradores(id, nombre, apellido)')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as TareoHidroculizado
}

export async function deleteTareoHidroculizado(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
