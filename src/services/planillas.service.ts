import { supabase } from '@/lib/supabase'
import type {
  PlanillaQuincenal, PlanillaQuincenalInsert,
  PlanillaDetalleInsert,
} from '@/types/models'

// ─── Planillas ───────────────────────────────────────────────────────────────

export async function getPlanillasQuincenales(): Promise<PlanillaQuincenal[]> {
  const { data, error } = await supabase
    .from('planillas_quincenales')
    .select('*')
    .order('periodo_inicio', { ascending: false })

  if (error) throw new Error(error.message)
  return data as PlanillaQuincenal[]
}

export async function getPlanillaConDetalles(id: string): Promise<PlanillaQuincenal> {
  const { data, error } = await supabase
    .from('planillas_quincenales')
    .select('*, detalles:planilla_detalles(*, colaborador:colaboradores(id, nombre, apellido))')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as PlanillaQuincenal
}

export async function createPlanillaQuincenal(
  planilla: PlanillaQuincenalInsert,
  detalles: PlanillaDetalleInsert[],
  userId: string
): Promise<PlanillaQuincenal> {
  const { data: planData, error: planError } = await supabase
    .from('planillas_quincenales')
    .insert({ ...planilla, created_by: userId })
    .select()
    .single()

  if (planError) throw new Error(planError.message)

  if (detalles.length > 0) {
    const rows = detalles.map((d) => ({ ...d, planilla_id: planData.id, created_by: userId }))
    const { error: detError } = await supabase.from('planilla_detalles').insert(rows)
    if (detError) throw new Error(detError.message)
  }

  return planData as PlanillaQuincenal
}

export async function pagarPlanilla(id: string): Promise<void> {
  const { error } = await supabase
    .from('planillas_quincenales')
    .update({ estado: 'pagada', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Resumen por colaborador para pre-llenar planilla ─────────────────────────

export interface ResumenColaboradorPeriodo {
  colaborador_id: string
  nombre: string
  apellido: string
  n_jabas_hidroculizado: number
}

export async function getResumenHidroculizadoPeriodo(
  fechaInicio: string,
  fechaFin: string
): Promise<ResumenColaboradorPeriodo[]> {
  const { data, error } = await supabase
    .from('tareo_hidroculizado')
    .select('colaborador_id, n_jabas, colaborador:colaboradores(nombre, apellido)')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  if (error) throw new Error(error.message)

  // Agrupar por colaborador
  const mapa = new Map<string, ResumenColaboradorPeriodo>()
  for (const row of data as any[]) {
    const cid = row.colaborador_id
    if (!mapa.has(cid)) {
      mapa.set(cid, {
        colaborador_id: cid,
        nombre: row.colaborador?.nombre ?? '',
        apellido: row.colaborador?.apellido ?? '',
        n_jabas_hidroculizado: 0,
      })
    }
    mapa.get(cid)!.n_jabas_hidroculizado += row.n_jabas
  }
  return Array.from(mapa.values())
}
