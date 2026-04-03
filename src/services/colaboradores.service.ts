import { supabase } from '@/lib/supabase'
import type { Colaborador, ColaboradorInsert, ColaboradorUpdate } from '@/types/models'

const TABLE = 'colaboradores' as const

export async function getColaboradores(): Promise<Colaborador[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('apellido', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Colaborador[]
}

export async function createColaborador(input: ColaboradorInsert, userId: string): Promise<Colaborador> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...payload, created_by: userId } as any)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Colaborador
}

export async function updateColaborador(id: string, input: ColaboradorUpdate): Promise<Colaborador> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Colaborador
}

export async function deleteColaborador(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}