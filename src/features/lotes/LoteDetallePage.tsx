import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLote } from '@/services/lotes.service'
import { getClasificacionesPorLote } from '@/services/clasificaciones.service'
import { getDespachosPorLote } from '@/services/despachos.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EstadoLoteBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoteTimeline } from './LoteTimeline'
import {
  ROUTES,
  DESTINO_DESPACHO_CONFIG,
  VARIEDAD_PRODUCTO_CONFIG,
  CALIDAD_PRODUCTO_CONFIG,
  TIPO_PRODUCCION_CONFIG,
} from '@/constants'
import { formatFecha, formatPeso, formatMoneda } from '@/utils/formatters'
import type { Lote, Clasificacion, Despacho } from '@/types/models'

type CuadroLocal = {
  filas: Array<{ colaborador_id: string; peso_bueno_kg: string }>
}

type PesadoPE = {
  fecha_pesado_pe: string
  peso_bruto_pe_kg: number
  n_jabas_pe: number
  tipo_jaba_pe: 'grande' | 'pequena'
}

const getMesasStorageKey = (loteId: string) => `clasificacion-cuadros-${loteId}`
const getPesadoPEKey = (loteId: string) => `pesado-pe-${loteId}`

export default function LoteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lote, setLote] = useState<Lote | null>(null)
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([])
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [cuadrosLocales, setCuadrosLocales] = useState<CuadroLocal[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pesadoPE, setPesadoPE] = useState<PesadoPE | null>(null)

  const cargar = async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const [l, cls, des] = await Promise.all([
        getLote(id),
        getClasificacionesPorLote(id),
        getDespachosPorLote(id),
      ])
      setLote(l); setClasificaciones(cls); setDespachos(des)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  useEffect(() => {
    if (!id) return
    try {
      const raw = localStorage.getItem(getMesasStorageKey(id))
      if (!raw) { setCuadrosLocales(null); return }
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) { setCuadrosLocales(null); return }
      setCuadrosLocales(parsed.filter((item) => item && typeof item === 'object') as CuadroLocal[])
    } catch { setCuadrosLocales(null) }
  }, [id])

  useEffect(() => {
    if (!id) return
    try {
      const raw = localStorage.getItem(getPesadoPEKey(id))
      if (raw) setPesadoPE(JSON.parse(raw) as PesadoPE)
    } catch { /* ignorar */ }
  }, [id])


  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!lote) return null

  const totalesBuenos = clasificaciones.reduce((acc, c) => acc + c.peso_bueno_kg, 0)
  const totalesMalos = Math.max(0, lote.peso_neto_kg - totalesBuenos)
  const acopiadorNombre = lote.acopiador
    ? `${lote.acopiador.apellido}, ${lote.acopiador.nombre}`
    : lote.acopiador_agricultor
      ? `${lote.acopiador_agricultor.apellido}, ${lote.acopiador_agricultor.nombre}`
      : '-'

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={`Lote ${lote.codigo}`}
        description={`${lote.centro_acopio?.nombre ?? '-'} · ${formatFecha(lote.fecha_ingreso)}${lote.codigo_lote_agricultor ? ` · Cod. agricultor: ${lote.codigo_lote_agricultor}` : ''} · N° JABAS INGRESADAS: ${lote.num_cubetas} · Bruto: ${formatPeso(lote.peso_bruto_kg)} · Tara: ${formatPeso(lote.peso_tara_kg)} · Neto: ${formatPeso(lote.peso_neto_kg)}`}
        backHref={ROUTES.LOTES}
        actions={
          <div className="flex gap-2">
            {(lote.estado === 'ingresado' || lote.estado === 'en_clasificacion') && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                onClick={() => navigate(`/lotes/${id}/clasificar`)}
              >
                Clasificar
              </Button>
            )}
            {lote.estado === 'clasificado' && (
              <Button
                className="bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-sm"
                onClick={() => navigate(`/lotes/${id}/pesado-pe`)}
              >
                Pesar PE
              </Button>
            )}
            {(lote.estado === 'pesado_pe' || lote.estado === 'en_despacho') && (
              <Button
                className="bg-agro-green hover:bg-agro-green/90 text-white font-semibold shadow-sm"
                onClick={() => navigate(`/lotes/${id}/despachar`)}
              >
                Despachar
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle className="text-base">Estado del lote</CardTitle></CardHeader>
            <CardContent>
              <LoteTimeline estadoActual={lote.estado} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Info general */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Información general</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <section className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Personas</p>
                    <EstadoLoteBadge estado={lote.estado} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Agricultor</p>
                    <p className="font-medium">{lote.agricultor?.apellido}, {lote.agricultor?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Acopiador</p>
                    <p className="font-medium">{acopiadorNombre}</p>
                  </div>
                </section>

                <section className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Producto</p>
                  {lote.producto ? (
                    <div className="space-y-1">
                      <p className="font-semibold leading-tight">{lote.producto.nombre}</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                        <p className="text-muted-foreground">Código</p>
                        <p>{lote.producto.codigo}</p>
                        <p className="text-muted-foreground">Variedad</p>
                        <p>{VARIEDAD_PRODUCTO_CONFIG[lote.producto.variedad].label}</p>
                        <p className="text-muted-foreground">Calidad</p>
                        <p>{CALIDAD_PRODUCTO_CONFIG[lote.producto.calidad].label}</p>
                        <p className="text-muted-foreground">Tipo</p>
                        <p>{TIPO_PRODUCCION_CONFIG[lote.producto.tipo_produccion].label}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="font-medium">-</p>
                  )}
                </section>

                <section className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Logística</p>
                  {lote.codigo_lote_agricultor && (
                    <div>
                      <p className="text-xs text-muted-foreground">Código de lote por agricultor</p>
                      <p className="font-medium">{lote.codigo_lote_agricultor}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Centro de acopio</p>
                    <p className="font-medium">{lote.centro_acopio?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha ingreso</p>
                    <p className="font-medium">{formatFecha(lote.fecha_ingreso)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">N° Jabas ingresadas</p>
                    <p className="font-medium">{lote.num_cubetas}</p>
                  </div>
                </section>

                <section className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Pesos</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-background p-2 border">
                      <p className="text-[11px] text-muted-foreground">Bruto</p>
                      <p className="font-semibold">{formatPeso(lote.peso_bruto_kg)}</p>
                    </div>
                    <div className="rounded-md bg-background p-2 border">
                      <p className="text-[11px] text-muted-foreground">Tara</p>
                      <p className="font-semibold">{formatPeso(lote.peso_tara_kg)}</p>
                    </div>
                    <div className="rounded-md bg-background p-2 border">
                      <p className="text-[11px] text-muted-foreground">Neto</p>
                      <p className="font-semibold text-primary">{formatPeso(lote.peso_neto_kg)}</p>
                    </div>
                  </div>
                </section>

                {pesadoPE && (() => {
                  const taraGuardada = pesadoPE.n_jabas_pe * (pesadoPE.tipo_jaba_pe === 'grande' ? 1.80 : 1.25)
                  const netoGuardado = Math.max(0, pesadoPE.peso_bruto_pe_kg - taraGuardada)
                  const cajasTeoricas = Math.floor(netoGuardado * 0.95 / 4.65)
                  const pctDif = totalesBuenos > 0 ? Math.abs(netoGuardado - totalesBuenos) / totalesBuenos : 0
                  const hayAlerta = pctDif > 0.05
                  return (
                    <section className="md:col-span-2 rounded-lg border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Pesado PE</p>
                        {lote.estado === 'pesado_pe' && (
                          <button className="text-xs text-sky-600 hover:underline" onClick={() => navigate(`/lotes/${id}/pesado-pe`)}>
                            Editar
                          </button>
                        )}
                      </div>
                      {hayAlerta && (
                        <div className="rounded-md bg-amber-50 border border-amber-300 px-2 py-1.5 text-xs text-amber-800">
                          ⚠️ Dif. {(pctDif * 100).toFixed(1)}% vs clasificación — revisar con Jefe de Planta
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Fecha</p>
                          <p className="font-medium">{formatFecha(pesadoPE.fecha_pesado_pe)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Bruto</p>
                          <p className="font-medium">{formatPeso(pesadoPE.peso_bruto_pe_kg)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Neto PE</p>
                          <p className={`font-semibold ${hayAlerta ? 'text-amber-700' : 'text-primary'}`}>{formatPeso(netoGuardado)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Cajas teo.</p>
                          <p className="font-medium">{cajasTeoricas}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {pesadoPE.n_jabas_pe} jabas {pesadoPE.tipo_jaba_pe === 'grande' ? 'grandes' : 'pequeñas'} · tara {formatPeso(taraGuardada)}
                      </p>
                    </section>
                  )
                })()}
                {lote.observaciones && (
                  <section className="md:col-span-2 rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Observaciones</p>
                    <p className="mt-1">{lote.observaciones}</p>
                  </section>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Clasificación */}
          {clasificaciones.length > 0 && (() => {
            const sesion = clasificaciones[0]
            const aportes = sesion.aportes ?? []
            const aportesPorColaborador = new Map(aportes.map((a) => [a.colaborador_id, a]))
            const aportesAgrupadosPorMesa = (cuadrosLocales ?? [])
              .map((cuadro, index) => ({
                index,
                aportes: (cuadro.filas ?? [])
                  .map((f) => aportesPorColaborador.get(f.colaborador_id))
                  .filter((a): a is NonNullable<typeof a> => Boolean(a)),
              }))
              .filter((mesa) => mesa.aportes.length > 0)

            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Clasificación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                      <p className="text-xs text-green-700 mb-0.5">Buenos</p>
                      <p className="font-bold text-lg text-green-700">{formatPeso(totalesBuenos)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                      <p className="text-xs text-red-700 mb-0.5">Malos / descarte</p>
                      <p className="font-bold text-lg text-red-700">{formatPeso(totalesMalos)}</p>
                    </div>
                  </div>
                  {aportes.length > 0 && aportesAgrupadosPorMesa.length === 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Por seleccionador</p>
                      {aportes.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                          <span className="text-muted-foreground">
                            {a.colaborador
                              ? `${a.colaborador.apellido}, ${a.colaborador.nombre}`
                              : a.colaborador_id}
                          </span>
                          <span className="font-medium text-green-700">{formatPeso(a.peso_bueno_kg)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {aportesAgrupadosPorMesa.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por mesa</p>
                      {aportesAgrupadosPorMesa.map((mesa) => (
                        <div key={mesa.index} className="flex flex-col gap-1.5">
                          <p className="text-xs text-muted-foreground">Mesa {mesa.index + 1}</p>
                          {mesa.aportes.map((a) => (
                            <div key={a.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                              <span className="text-muted-foreground">
                                {a.colaborador
                                  ? `${a.colaborador.apellido}, ${a.colaborador.nombre}`
                                  : a.colaborador_id}
                              </span>
                              <span className="font-medium text-green-700">{formatPeso(a.peso_bueno_kg)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* Despachos */}
          {despachos.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Despacho{despachos.length > 1 ? 's' : ''}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                {despachos.map((d) => (
                  <div key={d.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{DESTINO_DESPACHO_CONFIG[d.destino].label}</span>
                      <span className="text-muted-foreground">{formatFecha(d.fecha_despacho)}</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-muted-foreground">
                      <span>{d.num_cajas_despachadas} cajas · {formatPeso(d.peso_neto_kg)}</span>
                      <span className="text-foreground font-medium">{formatMoneda(d.peso_neto_kg * d.precio_venta_kg)}</span>
                    </div>
                    {d.transportista && <p className="text-muted-foreground text-xs mt-0.5">Transportista: {d.transportista}{d.placa_vehiculo ? ` · ${d.placa_vehiculo}` : ''}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
