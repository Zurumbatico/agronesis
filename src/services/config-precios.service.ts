import { supabase } from '@/lib/supabase'
import type { ConfigPrecio, ConfigPrecioInsert, ConfigPrecioUpdate } from '@/types/models'

const TABLE = 'config_precios' as const

export async function getConfigPrecios(): Promise<ConfigPrecio[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('anio', { ascending: false })
    .order('semana', { ascending: false })

  if (error) throw new Error(error.message)
  return data as ConfigPrecio[]
}

export async function createConfigPrecio(input: ConfigPrecioInsert, userId: string): Promise<ConfigPrecio> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ConfigPrecio
}

export async function updateConfigPrecio(id: string, input: ConfigPrecioUpdate): Promise<ConfigPrecio> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ConfigPrecio
}

export async function deleteConfigPrecio(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
