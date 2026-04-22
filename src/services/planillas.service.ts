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
    if (detError) {
      // Roll back the planilla header to avoid orphan rows on retry
      await supabase.from('planillas_quincenales').delete().eq('id', planData.id)
      throw new Error(detError.message)
    }
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
  kg_bruto_recepcion: number
  pago_recepcion: number
  kg_cat1_seleccion: number
  kg_cat2_seleccion: number
  pago_seleccion: number
}

export async function getResumenColaboradoresPeriodo(
  fechaInicio: string,
  fechaFin: string,
  pagoRecepcionKg = 0.02
): Promise<ResumenColaboradorPeriodo[]> {
  const mapa = new Map<string, ResumenColaboradorPeriodo>()

  // 0. Recepción del período (kg brutos de lotes por recepcionista)
  const { data: lotes, error: errLotes } = await supabase
    .from('lotes')
    .select('recepcionista_id, peso_bruto_kg, recepcionista:colaboradores(nombre, apellido)')
    .not('recepcionista_id', 'is', null)
    .gte('fecha_ingreso', fechaInicio)
    .lte('fecha_ingreso', fechaFin)
  if (errLotes) throw new Error(errLotes.message)

  for (const row of (lotes ?? []) as any[]) {
    const cid = row.recepcionista_id as string | null
    if (!cid) continue

    if (!mapa.has(cid)) {
      mapa.set(cid, {
        colaborador_id: cid,
        nombre: row.recepcionista?.nombre ?? '',
        apellido: row.recepcionista?.apellido ?? '',
        kg_bruto_recepcion: 0,
        pago_recepcion: 0,
        kg_cat1_seleccion: 0,
        kg_cat2_seleccion: 0,
        pago_seleccion: 0,
      })
    }

    const entry = mapa.get(cid)!
    entry.kg_bruto_recepcion += Number(row.peso_bruto_kg ?? 0)
  }

  // 1. Aportes de selección del período
  const { data: sesiones, error: errSes } = await supabase
    .from('clasificaciones')
    .select('id')
    .gte('fecha_clasificacion', fechaInicio)
    .lte('fecha_clasificacion', fechaFin)
  if (errSes) throw new Error(errSes.message)

  if ((sesiones ?? []).length > 0) {
    const clasificacionIds = (sesiones as { id: string }[]).map((s) => s.id)
    const { data: aportes, error: errAp } = await supabase
      .from('clasificacion_aportes')
      .select('colaborador_id, kg_cat1, kg_cat2, colaborador:colaboradores(nombre, apellido)')
      .in('clasificacion_id', clasificacionIds)
    if (errAp) throw new Error(errAp.message)

    for (const row of aportes as any[]) {
      const cid = row.colaborador_id
      if (!mapa.has(cid)) {
        mapa.set(cid, {
          colaborador_id: cid,
          nombre: row.colaborador?.nombre ?? '',
          apellido: row.colaborador?.apellido ?? '',
          kg_bruto_recepcion: 0,
          pago_recepcion: 0,
          kg_cat1_seleccion: 0,
          kg_cat2_seleccion: 0,
          pago_seleccion: 0,
        })
      }
      const entry = mapa.get(cid)!
      entry.kg_cat1_seleccion += row.kg_cat1 ?? 0
      entry.kg_cat2_seleccion += row.kg_cat2 ?? 0
    }
    mapa.forEach((entry) => {
      entry.pago_seleccion = Math.round(
        (entry.kg_cat1_seleccion * 0.20 + entry.kg_cat2_seleccion * 0.28) * 100
      ) / 100
    })
  }

  mapa.forEach((entry) => {
    entry.kg_bruto_recepcion = Math.round(entry.kg_bruto_recepcion * 100) / 100
    entry.pago_recepcion = Math.round(entry.kg_bruto_recepcion * pagoRecepcionKg * 100) / 100
  })

  return Array.from(mapa.values())
}
