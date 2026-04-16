import { supabase } from '@/lib/supabase'
import { normalizarNumeroPallet } from '@/utils/business-rules'
import type { Despacho, DespachoInsert, DespachoPallet, VariedadProducto } from '@/types/models'

const TABLE = 'despachos' as const
const TABLE_PALLETS = 'despacho_pallets' as const

const SELECT_DESPACHO_COMPLETO = `
  *,
  pallets:despacho_pallets(
    *,
    lote:lotes(
      id,
      codigo,
      producto:productos(id, nombre, variedad)
    )
  )
`

export type PalletDisponibleDespacho = {
  key: string
  lote_id: string
  lote_codigo: string
  numero_pallet: string
  num_cajas: number
  variedad: VariedadProducto
  producto_nombre: string
}

type EmpaquetadoPalletRow = {
  lote_id: string
  numero_pallet: string
  num_cajas: number
  lote: {
    id: string
    codigo: string
    producto: {
      nombre: string
      variedad: VariedadProducto
    } | null
  } | null
}

type DespachoPalletUsageRow = {
  despacho_id: string
  lote_id: string
  numero_pallet: string
}

export async function getDespachosPorLote(loteId: string): Promise<Despacho[]> {
  const despachos = await getDespachos()
  return despachos.filter((item) => (item.pallets ?? []).some((pallet) => pallet.lote_id === loteId))
}

export async function getDespachos(): Promise<Despacho[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_DESPACHO_COMPLETO)
    .order('fecha_despacho', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as Despacho[]
}

export async function getDespacho(id: string): Promise<Despacho> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_DESPACHO_COMPLETO)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Despacho
}

export async function getPalletsDisponiblesParaDespacho(despachoId?: string): Promise<PalletDisponibleDespacho[]> {
  const [empaquetadosResult, usadosResult] = await Promise.all([
    supabase
      .from('empaquetados')
      .select('lote_id, numero_pallet, num_cajas, lote:lotes(id, codigo, producto:productos(nombre, variedad))'),
    supabase
      .from(TABLE_PALLETS)
      .select('despacho_id, lote_id, numero_pallet'),
  ])

  if (empaquetadosResult.error) throw new Error(empaquetadosResult.error.message)
  if (usadosResult.error) throw new Error(usadosResult.error.message)

  const usados = new Set(
    ((usadosResult.data ?? []) as DespachoPalletUsageRow[])
      .filter((item) => !despachoId || item.despacho_id !== despachoId)
      .map((item) => `${item.lote_id}::${normalizarNumeroPallet(item.numero_pallet)}`)
  )

  const agregados = ((empaquetadosResult.data ?? []) as EmpaquetadoPalletRow[]).reduce<Record<string, PalletDisponibleDespacho>>((acc, row) => {
    const pallet = normalizarNumeroPallet(row.numero_pallet ?? '')
    if (!pallet || !row.lote_id || !row.lote?.producto?.variedad) return acc
    const key = `${row.lote_id}::${pallet}`
    if (usados.has(key)) return acc

    if (!acc[key]) {
      acc[key] = {
        key,
        lote_id: row.lote_id,
        lote_codigo: row.lote.codigo,
        numero_pallet: pallet,
        num_cajas: 0,
        variedad: row.lote.producto.variedad,
        producto_nombre: row.lote.producto.nombre,
      }
    }

    acc[key].num_cajas += row.num_cajas ?? 0
    return acc
  }, {})

  return Object.values(agregados).sort((a, b) => {
    if (a.variedad !== b.variedad) return a.variedad.localeCompare(b.variedad)
    if (a.lote_codigo !== b.lote_codigo) return a.lote_codigo.localeCompare(b.lote_codigo)
    return a.numero_pallet.localeCompare(b.numero_pallet)
  })
}

export async function createDespacho(
  input: DespachoInsert,
  pallets: Array<Pick<DespachoPallet, 'lote_id' | 'numero_pallet' | 'num_cajas'>>,
  userId: string
): Promise<Despacho> {
  const lotes = Array.from(new Set(pallets.map((item) => item.lote_id)))
  const loteId = lotes.length === 1 ? lotes[0] : null

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, lote_id: loteId, precio_venta_kg: 0, created_by: userId })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  const despachoId = (data as { id: string }).id

  if (pallets.length > 0) {
    const { error: palletsError } = await supabase
      .from(TABLE_PALLETS)
      .insert(pallets.map((item) => ({
        despacho_id: despachoId,
        lote_id: item.lote_id,
        numero_pallet: normalizarNumeroPallet(item.numero_pallet),
        num_cajas: item.num_cajas,
        created_by: userId,
      })))

    if (palletsError) throw new Error(palletsError.message)
  }

  return getDespacho(despachoId)
}

export async function updateDespacho(id: string, input: Partial<DespachoInsert>): Promise<Despacho> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Despacho
}

export async function updateDespachoCompleto(
  id: string,
  input: DespachoInsert,
  pallets: Array<Pick<DespachoPallet, 'lote_id' | 'numero_pallet' | 'num_cajas'>>,
  userId: string
): Promise<Despacho> {
  const lotes = Array.from(new Set(pallets.map((item) => item.lote_id)))
  const loteId = lotes.length === 1 ? lotes[0] : null

  const { error: despachoError } = await supabase
    .from(TABLE)
    .update({ ...input, lote_id: loteId, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (despachoError) throw new Error(despachoError.message)

  const { error: deleteError } = await supabase
    .from(TABLE_PALLETS)
    .delete()
    .eq('despacho_id', id)

  if (deleteError) throw new Error(deleteError.message)

  const { error: palletsError } = await supabase
    .from(TABLE_PALLETS)
    .insert(pallets.map((item) => ({
      despacho_id: id,
      lote_id: item.lote_id,
      numero_pallet: normalizarNumeroPallet(item.numero_pallet),
      num_cajas: item.num_cajas,
      created_by: userId,
    })))

  if (palletsError) throw new Error(palletsError.message)

  return getDespacho(id)
}
