import { supabase } from '@/lib/supabase'
import type { Acopiador, AcopiadorInsert, AcopiadorUpdate } from '@/types/models'

const TABLE = 'acopiadores' as const

export async function getAcopiadores(): Promise<Acopiador[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('apellido', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Acopiador[]
}

export async function createAcopiador(input: AcopiadorInsert, userId: string): Promise<Acopiador> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...payload, created_by: userId } as any)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Acopiador
}

export async function updateAcopiador(id: string, input: AcopiadorUpdate): Promise<Acopiador> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Acopiador
}

export async function deleteAcopiador(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
