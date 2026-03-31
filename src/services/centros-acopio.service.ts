import { supabase } from '@/lib/supabase'
import type { CentroAcopio, CentroAcopioInsert, CentroAcopioUpdate } from '@/types/models'

const TABLE = 'centros_acopio' as const

export async function getCentrosAcopio(): Promise<CentroAcopio[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)
  return data as CentroAcopio[]
}

export async function getCentroAcopio(id: string): Promise<CentroAcopio> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as CentroAcopio
}

export async function createCentroAcopio(input: CentroAcopioInsert, userId: string): Promise<CentroAcopio> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CentroAcopio
}

export async function updateCentroAcopio(id: string, input: CentroAcopioUpdate): Promise<CentroAcopio> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CentroAcopio
}

export async function deleteCentroAcopio(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
