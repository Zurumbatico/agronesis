import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLote } from '@/services/lotes.service'
import { getClasificacionesPorLote } from '@/services/clasificaciones.service'
import { getDespachosPorLote } from '@/services/despachos.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EstadoLoteBadge, CategoriaClasificacionBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoteTimeline } from './LoteTimeline'
import { ROUTES, DESTINO_DESPACHO_CONFIG } from '@/constants'
import { formatFecha, formatPeso, formatMoneda } from '@/utils/formatters'
import { calcularTotalesClasificacion } from '@/utils/business-rules'
import { siguienteEstadoLote } from '@/utils/business-rules'
import { actualizarEstadoLote } from '@/services/lotes.service'
import type { Lote, Clasificacion, Despacho } from '@/types/models'

export default function LoteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lote, setLote] = useState<Lote | null>(null)
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([])
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

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
      setLoading(false) }
  }

  useEffect(() => { cargar() }, [id])

  const handleAvanzarEstado = async () => {
    if (!lote) return
    const siguiente = siguienteEstadoLote(lote.estado)
    if (!siguiente) return
    if (!confirm(`¿Pasar el lote a "${siguiente.replace('_', ' ')}"?`)) return
    setCambiandoEstado(true)
    try {
      const actualizado = await actualizarEstadoLote(lote.id, siguiente)
      setLote(actualizado)
    } finally { setCambiandoEstado(false) }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!lote) return null

  const totalesClasif = calcularTotalesClasificacion(clasificaciones)
  const siguienteEstado = siguienteEstadoLote(lote.estado)

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={`Lote ${lote.codigo}`}
        backHref={ROUTES.LOTES}
        actions={
          <div className="flex gap-2">
            {(lote.estado === 'ingresado' || lote.estado === 'en_clasificacion') && (
              <Button variant="outline" onClick={() => navigate(`/lotes/${id}/clasificar`)}>
                Clasificar
              </Button>
            )}
            {(lote.estado === 'clasificado' || lote.estado === 'en_despacho') && (
              <Button variant="outline" onClick={() => navigate(`/lotes/${id}/despachar`)}>
                Despachar
              </Button>
            )}
            {siguienteEstado && (
              <Button onClick={handleAvanzarEstado} loading={cambiandoEstado}>
                Avanzar estado
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
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Agricultor</p><p className="font-medium">{lote.agricultor?.apellido}, {lote.agricultor?.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Producto</p><p className="font-medium">{lote.producto?.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Centro de acopio</p><p className="font-medium">{lote.centro_acopio?.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Fecha ingreso</p><p className="font-medium">{formatFecha(lote.fecha_ingreso)}</p></div>
                <div><p className="text-muted-foreground text-xs">Peso bruto</p><p className="font-medium">{formatPeso(lote.peso_bruto_kg)}</p></div>
                <div><p className="text-muted-foreground text-xs">Tara</p><p className="font-medium">{formatPeso(lote.peso_tara_kg)}</p></div>
                <div><p className="text-muted-foreground text-xs">Peso neto</p><p className="font-medium">{formatPeso(lote.peso_neto_kg)}</p></div>
                <div><p className="text-muted-foreground text-xs">Cubetas</p><p className="font-medium">{lote.num_cubetas}</p></div>
                <div className="col-span-2"><p className="text-muted-foreground text-xs">Estado</p><div className="mt-0.5"><EstadoLoteBadge estado={lote.estado} /></div></div>
                {lote.observaciones && <div className="col-span-2"><p className="text-muted-foreground text-xs">Observaciones</p><p>{lote.observaciones}</p></div>}
              </div>
            </CardContent>
          </Card>

          {/* Clasificaciones */}
          {clasificaciones.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Clasificación ({clasificaciones.length} registros)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {(['primera', 'segunda', 'descarte'] as const).map((cat) => (
                    <div key={cat} className="bg-muted rounded-lg p-3 text-center">
                      <CategoriaClasificacionBadge categoria={cat} />
                      <p className="font-bold mt-1">{formatPeso(totalesClasif[cat].peso_kg)}</p>
                      <p className="text-xs text-muted-foreground">{totalesClasif[cat].num_cajas} cajas</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  {clasificaciones.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 ml-auto">
                        <CategoriaClasificacionBadge categoria={c.categoria} />
                        <span className="font-medium">{formatPeso(c.peso_kg)} · {c.num_cajas} cjs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
