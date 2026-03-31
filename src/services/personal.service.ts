import { supabase } from '@/lib/supabase'
import type { PersonalCampo, PersonalCampoInsert, PersonalCampoUpdate } from '@/types/models'

const TABLE = 'personal_campo' as const

export async function getPersonalCampo(): Promise<PersonalCampo[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('apellido', { ascending: true })

  if (error) throw new Error(error.message)
  return data as PersonalCampo[]
}

export async function getPersona(id: string): Promise<PersonalCampo> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as PersonalCampo
}

export async function createPersonal(input: PersonalCampoInsert, userId: string): Promise<PersonalCampo> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PersonalCampo
}

export async function updatePersonal(id: string, input: PersonalCampoUpdate): Promise<PersonalCampo> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PersonalCampo
}

export async function deletePersonal(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
