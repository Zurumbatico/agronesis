import { supabase } from '@/lib/supabase'
import { normalizarNumeroPallet } from '@/utils/business-rules'
import type { Despacho, DespachoInsert, DespachoPallet, VariedadProducto, CalidadProducto } from '@/types/models'
import type { PackingListData, PackingListRow } from '@/utils/packing-list-excel'
import type { Anexo41Data, Anexo41Row } from '@/utils/anexo41-excel'

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

export async function deleteDespacho(id: string): Promise<void> {
  const { error: palletsError } = await supabase
    .from(TABLE_PALLETS)
    .delete()
    .eq('despacho_id', id)

  if (palletsError) throw new Error(palletsError.message)

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────────
// Packing List — datos para generar Excel
// ─────────────────────────────────────────────

type EmpaquetadoRow = {
  lote_id: string
  numero_pallet: string
  codigo_trazabilidad: string
  num_cajas: number
  destino: string
}

type LoteConRelaciones = {
  id: string
  codigo: string
  agricultor_id: string
  producto: { id: string; nombre: string; variedad: VariedadProducto; calidad: CalidadProducto } | null
}

type AgricultorGGN = {
  id: string
  ggn: string | null
}

const DESTINO_GEO: Record<string, string> = {
  europa: 'EUROPA',
  usa: 'USA',
}

export async function getPackingListData(despachoId: string): Promise<PackingListData> {
  // 1. Despacho con pallets + lote + producto (sin agricultor para evitar FK ambigua)
  const { data: despachoData, error: despErr } = await supabase
    .from(TABLE)
    .select(`
      *,
      pallets:despacho_pallets(
        *,
        lote:lotes(id, codigo, agricultor_id, producto:productos(id, nombre, variedad, calidad))
      )
    `)
    .eq('id', despachoId)
    .single()

  if (despErr) throw new Error(despErr.message)

  const despacho = despachoData as unknown as Despacho & {
    pallets: (DespachoPallet & { lote: LoteConRelaciones | null })[]
  }
  const pallets = despacho.pallets ?? []

  if (pallets.length === 0) {
    return { despacho: despacho as unknown as Despacho, rows: [], destinoGeografico: '' }
  }

  const loteIds = [...new Set(pallets.map(p => p.lote_id))]

  // 2. Obtener agricultores (con GGN) de los lotes involucrados
  const agricultorIds = [...new Set(
    pallets.map(p => p.lote?.agricultor_id).filter((id): id is string => !!id)
  )]

  const [empResult, agriResult] = await Promise.all([
    supabase
      .from('empaquetados')
      .select('lote_id, numero_pallet, codigo_trazabilidad, num_cajas, destino')
      .in('lote_id', loteIds),
    agricultorIds.length > 0
      ? supabase.from('agricultores').select('id, ggn').in('id', agricultorIds)
      : Promise.resolve({ data: [] as AgricultorGGN[], error: null }),
  ])

  if (empResult.error) throw new Error(empResult.error.message)
  if (agriResult.error) throw new Error(agriResult.error.message)

  const ggnMap = new Map<string, string>(
    ((agriResult.data ?? []) as AgricultorGGN[])
      .filter(a => a.ggn)
      .map(a => [a.id, a.ggn!])
  )

  const palletMap = new Map(
    pallets.map(p => [
      `${p.lote_id}::${normalizarNumeroPallet(p.numero_pallet)}`,
      p,
    ])
  )

  const rows: PackingListRow[] = ((empResult.data ?? []) as EmpaquetadoRow[])
    .filter(e => palletMap.has(`${e.lote_id}::${normalizarNumeroPallet(e.numero_pallet)}`))
    .map(e => {
      const pallet = palletMap.get(`${e.lote_id}::${normalizarNumeroPallet(e.numero_pallet)}`)!
      const agricultorId = pallet.lote?.agricultor_id ?? ''
      return {
        numero_pallet: normalizarNumeroPallet(e.numero_pallet),
        codigo_trazabilidad: e.codigo_trazabilidad,
        ggn: ggnMap.get(agricultorId) || '4069453556065',
        variedad: (pallet.lote?.producto?.variedad ?? 'snow_peas') as VariedadProducto,
        calidad: (pallet.lote?.producto?.calidad ?? 'cat1') as CalidadProducto,
        num_cajas: e.num_cajas,
      }
    })
    .sort((a, b) => {
      const pa = parseInt(a.numero_pallet, 10) || 0
      const pb = parseInt(b.numero_pallet, 10) || 0
      if (pa !== pb) return pa - pb
      return a.codigo_trazabilidad.localeCompare(b.codigo_trazabilidad)
    })

  // Destino geográfico desde los empaquetados (mayoría)
  const destinos = ((empResult.data ?? []) as EmpaquetadoRow[])
    .filter(e => palletMap.has(`${e.lote_id}::${normalizarNumeroPallet(e.numero_pallet)}`))
    .map(e => e.destino)
  const destinoFreq: Record<string, number> = {}
  for (const d of destinos) destinoFreq[d] = (destinoFreq[d] ?? 0) + 1
  const destinoMayoritario = Object.entries(destinoFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'europa'
  const destinoGeografico = DESTINO_GEO[destinoMayoritario] ?? destinoMayoritario.toUpperCase()

  return { despacho: despacho as unknown as Despacho, rows, destinoGeografico }
}

// ─────────────────────────────────────────────
// Anexo 4.1B — datos para generar Excel
// ─────────────────────────────────────────────

type LoteAnexo41 = {
  id: string
  codigo: string
  num_cubetas: number
  codigo_lote_agricultor: string | null
  agricultor: { id: string; codigo: string } | null
  producto: { id: string; nombre: string; variedad: VariedadProducto } | null
}

export async function getAnexo41Data(despachoId: string): Promise<Anexo41Data> {
  const { data: despachoData, error: despErr } = await supabase
    .from(TABLE)
    .select(`
      *,
      pallets:despacho_pallets(
        *,
        lote:lotes(
          id, codigo, num_cubetas, codigo_lote_agricultor,
          agricultor:agricultores!lotes_agricultor_id_fkey(id, codigo),
          producto:productos(id, nombre, variedad)
        )
      )
    `)
    .eq('id', despachoId)
    .single()

  if (despErr) throw new Error(despErr.message)

  const despacho = despachoData as unknown as Despacho & {
    pallets: (DespachoPallet & { lote: LoteAnexo41 | null })[]
  }

  const pallets = despacho.pallets ?? []

  if (pallets.length === 0) {
    return { despacho: despacho as unknown as Despacho, rows: [] }
  }

  // Agrupar cajas por código de lote
  const grouped: Record<string, number> = {}

  for (const p of pallets) {
    const codigo = p.lote?.codigo_lote_agricultor || p.lote?.codigo || 'SIN_CODIGO'
    grouped[codigo] = (grouped[codigo] ?? 0) + p.num_cajas
  }

  const rows: Anexo41Row[] = Object.entries(grouped)
    .map(([codigoLote, numCajas]) => ({ codigoLote, numCajas }))
    .sort((a, b) => {
      const numA = parseInt(a.codigoLote, 10)
      const numB = parseInt(b.codigoLote, 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      if (!isNaN(numA)) return -1
      if (!isNaN(numB)) return 1
      return a.codigoLote.localeCompare(b.codigoLote)
    })

  return { despacho: despacho as unknown as Despacho, rows }
}
