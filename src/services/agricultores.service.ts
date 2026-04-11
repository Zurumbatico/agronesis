import { supabase } from '@/lib/supabase'
import type { Agricultor, AgricultorInsert, AgricultorUpdate } from '@/types/models'

const TABLE = 'agricultores' as const
const SELECT_LISTA = `*`
const SELECT_DETALLE = `*`

export async function getAgricultores(): Promise<Agricultor[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_LISTA)
    .order('apellido', { ascending: true })

  if (error) throw new Error(error.message)
  return data as unknown as Agricultor[]
}

export async function getAgricultor(id: string): Promise<Agricultor> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_DETALLE)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Agricultor
}

export async function createAgricultor(
  input: AgricultorInsert,
  userId: string
): Promise<Agricultor> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...payload, created_by: userId } as any)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Agricultor
}

export async function updateAgricultor(
  id: string,
  input: AgricultorUpdate
): Promise<Agricultor> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Agricultor
}

export async function deleteAgricultor(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
