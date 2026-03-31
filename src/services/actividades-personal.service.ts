import { supabase } from '@/lib/supabase'
import type { ActividadPersonal, ActividadPersonalInsert } from '@/types/models'

const TABLE = 'actividades_personal' as const

export async function getActividadesPorPersonal(personalId: string): Promise<ActividadPersonal[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, lote:lotes(codigo, fecha_ingreso)')
    .eq('personal_id', personalId)
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as ActividadPersonal[]
}

export async function getActividadesPorLote(loteId: string): Promise<ActividadPersonal[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, personal:personal_campo(*)')
    .eq('lote_id', loteId)
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as ActividadPersonal[]
}

export async function createActividad(
  input: Omit<ActividadPersonalInsert, 'total'>,
  userId: string
): Promise<ActividadPersonal> {
  const total = input.cantidad_unidades * input.tarifa_unitaria

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, total, created_by: userId })
    .select('*, personal:personal_campo(*), lote:lotes(codigo)')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as ActividadPersonal
}

export async function deleteActividad(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
