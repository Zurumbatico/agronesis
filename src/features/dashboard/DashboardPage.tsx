import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { endOfMonth, format, parseISO, startOfMonth, subDays } from 'date-fns'
import { Boxes, CalendarRange, Package, Trash2, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingPage } from '@/components/shared/Spinner'
import { formatPeso } from '@/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { supabase } from '@/lib/supabase'
import { getLotes } from '@/services/lotes.service'
import type { Lote, VariedadProducto } from '@/types/models'

type FiltroModo = 'dia' | 'rango'
type FiltroVariedad = 'all' | VariedadProducto

type DashboardClasificacionAporteRow = {
  kg_neto_descartable: number | null
}

type DashboardClasificacionRow = {
  lote_id: string
  peso_bueno_kg: number | null
  aportes?: DashboardClasificacionAporteRow[] | null
}

type DashboardMetricRow = {
  id: string
  fecha: string
  variedad: VariedadProducto
  ingresado: number
  exportable: number
  descarte: number
  merma: number
}

interface StatCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
}

function StatCard({ title, value, sub, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-agro-green/10 flex items-center justify-center text-agro-green">
          {icon}
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{title}</p>
          <p className="font-bold text-xl">{value}</p>
          {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

const roundTo2 = (value: number) => Math.round(value * 100) / 100
const toNumber = (value: number | null | undefined) => Number.isFinite(value) ? Number(value) : 0
const today = format(new Date(), 'yyyy-MM-dd')
const initialStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
const initialEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

function buildMetricRow(lote: Lote, clasificaciones: DashboardClasificacionRow[]): DashboardMetricRow | null {
  const variedad = lote.producto?.variedad
  if (!variedad || !lote.fecha_ingreso) return null

  const exportable = roundTo2(clasificaciones.reduce((acc, clasificacion) => acc + toNumber(clasificacion.peso_bueno_kg), 0))
  const descarte = roundTo2(clasificaciones.reduce(
    (acc, clasificacion) => acc + (clasificacion.aportes ?? []).reduce((sum, aporte) => sum + toNumber(aporte.kg_neto_descartable), 0),
    0
  ))
  const ingresado = roundTo2(toNumber(lote.peso_neto_kg))
  const merma = roundTo2(Math.max(0, ingresado - (exportable + descarte)))

  return {
    id: lote.id,
    fecha: lote.fecha_ingreso.slice(0, 10),
    variedad,
    ingresado,
    exportable,
    descarte,
    merma,
  }
}

function formatShortDate(isoDate: string) {
  return format(parseISO(isoDate), 'dd/MM')
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DashboardMetricRow[]>([])
  const [filterMode, setFilterMode] = useState<FiltroModo>('rango')
  const [selectedDay, setSelectedDay] = useState(today)
  const [fechaInicio, setFechaInicio] = useState(initialStart)
  const [fechaFin, setFechaFin] = useState(initialEnd)
  const [variedadFiltro, setVariedadFiltro] = useState<FiltroVariedad>('all')

  useEffect(() => {
    const cargar = async () => {
      try {
        const [lotes, clasificacionesResult] = await Promise.all([
          getLotes(),
          supabase
            .from('clasificaciones')
            .select(`
              lote_id,
              peso_bueno_kg,
              aportes:clasificacion_aportes(kg_neto_descartable)
            `)
            .order('created_at', { ascending: true }),
        ])

        if (clasificacionesResult.error) throw clasificacionesResult.error

        const clasificacionesRows = (clasificacionesResult.data ?? []) as DashboardClasificacionRow[]

        const clasificacionesPorLote = clasificacionesRows.reduce<Record<string, DashboardClasificacionRow[]>>((acc, row) => {
          const loteId = row.lote_id
          if (!loteId) return acc
          if (!acc[loteId]) acc[loteId] = []
          acc[loteId].push(row)
          return acc
        }, {})

        const metricRows = lotes
          .map((lote) => buildMetricRow(lote, clasificacionesPorLote[lote.id] ?? []))
          .filter((row): row is DashboardMetricRow => Boolean(row))

        setRows(metricRows)
      } catch (e) {
        console.error('Dashboard error:', e)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [])

  if (loading) return <LoadingPage />

  const rangoInicio = filterMode === 'dia' ? selectedDay : fechaInicio
  const rangoFin = filterMode === 'dia' ? selectedDay : fechaFin
  const hasValidRange = rangoInicio <= rangoFin

  const filteredRows = hasValidRange
    ? rows.filter((row) => {
        const matchesVariedad = variedadFiltro === 'all' || row.variedad === variedadFiltro
        const matchesFecha = row.fecha >= rangoInicio && row.fecha <= rangoFin
        return matchesVariedad && matchesFecha
      })
    : []

  const resumenPorVariedad = (['snow_peas', 'sugar'] as const)
    .map((variedad) => {
      const items = filteredRows.filter((row) => row.variedad === variedad)
      return {
        variedad,
        label: VARIEDAD_PRODUCTO_CONFIG[variedad].label,
        lotes: items.length,
        ingresado: roundTo2(items.reduce((acc, row) => acc + row.ingresado, 0)),
        exportable: roundTo2(items.reduce((acc, row) => acc + row.exportable, 0)),
        descarte: roundTo2(items.reduce((acc, row) => acc + row.descarte, 0)),
        merma: roundTo2(items.reduce((acc, row) => acc + row.merma, 0)),
      }
    })
    .filter((item) => variedadFiltro === 'all' || item.variedad === variedadFiltro)

  const totals = filteredRows.reduce((acc, row) => ({
    lotes: acc.lotes + 1,
    ingresado: roundTo2(acc.ingresado + row.ingresado),
    exportable: roundTo2(acc.exportable + row.exportable),
    descarte: roundTo2(acc.descarte + row.descarte),
    merma: roundTo2(acc.merma + row.merma),
  }), {
    lotes: 0,
    ingresado: 0,
    exportable: 0,
    descarte: 0,
    merma: 0,
  })

  const serieDiaria = Array.from(filteredRows.reduce((acc, row) => {
    const current = acc.get(row.fecha) ?? {
      fecha: row.fecha,
      label: formatShortDate(row.fecha),
      ingresado: 0,
      exportable: 0,
      descarte: 0,
      merma: 0,
    }

    current.ingresado = roundTo2(current.ingresado + row.ingresado)
    current.exportable = roundTo2(current.exportable + row.exportable)
    current.descarte = roundTo2(current.descarte + row.descarte)
    current.merma = roundTo2(current.merma + row.merma)
    acc.set(row.fecha, current)
    return acc
  }, new Map<string, {
    fecha: string
    label: string
    ingresado: number
    exportable: number
    descarte: number
    merma: number
  }>()).values()).sort((a, b) => a.fecha.localeCompare(b.fecha))

  const comparativoVariedad = resumenPorVariedad.map((item) => ({
    variedad: item.label,
    ingresado: item.ingresado,
    exportable: item.exportable,
    descarte: item.descarte,
    merma: item.merma,
  }))

  const aplicarHoy = () => {
    setFilterMode('dia')
    setSelectedDay(today)
  }

  const aplicarUltimos7 = () => {
    setFilterMode('rango')
    setFechaInicio(format(subDays(new Date(), 6), 'yyyy-MM-dd'))
    setFechaFin(today)
  }

  const aplicarMesActual = () => {
    setFilterMode('rango')
    setFechaInicio(initialStart)
    setFechaFin(initialEnd)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Indicadores de ingreso, clasificación y merma por variedad sobre la fecha de ingreso del lote.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Consulta un día puntual o un rango de fechas y segmenta por variedad.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={aplicarHoy}>Hoy</Button>
            <Button type="button" variant="outline" size="sm" onClick={aplicarUltimos7}>Últimos 7 días</Button>
            <Button type="button" variant="outline" size="sm" onClick={aplicarMesActual}>Mes actual</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField label="Modo de consulta">
              <Select value={filterMode} onValueChange={(value) => setFilterMode(value as FiltroModo)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Por día</SelectItem>
                  <SelectItem value="rango">Rango de fechas</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {filterMode === 'dia' ? (
              <FormField label="Día">
                <Input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
              </FormField>
            ) : (
              <>
                <FormField label="Desde">
                  <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </FormField>
                <FormField label="Hasta">
                  <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                </FormField>
              </>
            )}

            <FormField label="Variedad">
              <Select value={variedadFiltro} onValueChange={(value) => setVariedadFiltro(value as FiltroVariedad)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las variedades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las variedades</SelectItem>
                  <SelectItem value="snow_peas">Snow Peas</SelectItem>
                  <SelectItem value="sugar">Sugar</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {!hasValidRange && (
            <p className="text-sm text-destructive">La fecha inicial no puede ser mayor que la fecha final.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard title="Lotes en filtro" value={String(totals.lotes)} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Kg netos ingresados" value={formatPeso(totals.ingresado)} icon={<CalendarRange className="h-5 w-5" />} />
        <StatCard title="Kg exportables" value={formatPeso(totals.exportable)} icon={<Boxes className="h-5 w-5" />} />
        <StatCard title="Kg de descarte" value={formatPeso(totals.descarte)} icon={<Trash2 className="h-5 w-5" />} />
        <StatCard title="Merma" value={formatPeso(totals.merma)} sub="Ingresado - (exportable + descarte)" icon={<TrendingDown className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen por variedad</CardTitle>
          <CardDescription>Totales acumulados en el filtro actual para Snow Peas y Sugar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {resumenPorVariedad.map((item) => (
              <div key={item.variedad} className="rounded-xl border p-4 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{item.label}</h3>
                    <p className="text-xs text-muted-foreground">{item.lotes} lote(s) en el rango seleccionado</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/20 border p-3">
                    <p className="text-xs text-muted-foreground">Kg netos ingresados</p>
                    <p className="font-bold mt-1">{formatPeso(item.ingresado)}</p>
                  </div>
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <p className="text-xs text-green-700">Kg exportables</p>
                    <p className="font-bold mt-1 text-green-700">{formatPeso(item.exportable)}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-xs text-red-700">Kg de descarte</p>
                    <p className="font-bold mt-1 text-red-700">{formatPeso(item.descarte)}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs text-amber-700">Merma</p>
                    <p className="font-bold mt-1 text-amber-700">{formatPeso(item.merma)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {serieDiaria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comportamiento diario</CardTitle>
            <CardDescription>Serie diaria del rango filtrado. La línea representa kg netos ingresados.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={serieDiaria} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={((value: unknown) => `${Number(value ?? 0).toFixed(2)} kg`) as never} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="exportable" name="Exportables" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="descarte" name="Descarte" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="merma" name="Merma" fill="#d97706" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="ingresado" name="Netos ingresados" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {comparativoVariedad.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparativo por variedad</CardTitle>
            <CardDescription>Comparación consolidada de ingreso, exportable, descarte y merma.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={comparativoVariedad} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="variedad" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={((value: unknown) => `${Number(value ?? 0).toFixed(2)} kg`) as never} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ingresado" name="Netos ingresados" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="exportable" name="Exportables" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="descarte" name="Descarte" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="merma" name="Merma" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {filteredRows.length === 0 && (
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
            No hay lotes dentro del filtro actual para calcular ingreso, exportable, descarte y merma.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
