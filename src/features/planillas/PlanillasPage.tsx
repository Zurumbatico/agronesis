import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  getPlanillasQuincenales,
  createPlanillaQuincenal,
  pagarPlanilla,
  getPlanillaConDetalles,
  getResumenColaboradoresPeriodo,
  type ResumenColaboradorPeriodo,
} from '@/services/planillas.service'
import { CLAVE_PAGO_RECEPCION_KG, getValorNumericoSistema } from '@/services/config-precios.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { FormField } from '@/components/shared/FormField'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/auth.store'
import { formatFecha, formatMoneda } from '@/utils/formatters'
import { format } from 'date-fns'
import { Eye } from 'lucide-react'
import type { PlanillaQuincenal } from '@/types/models'
import { DEFAULT_PAGO_RECEPCION_KG } from '@/utils/business-rules'

const PAGO_POR_CAJA = 0.32   // S/ 0.32 por caja empaquetada (Módulo D PDF)

type DetalleForm = {
  colaborador_id: string
  nombre_display: string
  kg_bruto_recepcion: number
  pago_recepcion: number
  kg_cat1_seleccion: number
  kg_cat2_seleccion: number
  pago_seleccion: number
  n_cajas_empaquetado: number
  otros_montos: number
}

type PlanillaForm = {
  periodo_inicio: string
  periodo_fin: string
  observaciones: string
  detalles: DetalleForm[]
}

export default function PlanillasPage() {
  const { user } = useAuthStore()
  const [planillas, setPlanillas] = useState<PlanillaQuincenal[]>([])
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagoRecepcionKg, setPagoRecepcionKg] = useState(DEFAULT_PAGO_RECEPCION_KG)
  const [detallePlanilla, setDetallePlanilla] = useState<PlanillaQuincenal | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [planillaAConfirmar, setPlanillaAConfirmar] = useState<string | null>(null)

  const { register, handleSubmit, watch, reset, control, formState: { errors, isSubmitting } } = useForm<PlanillaForm>({
    defaultValues: {
      periodo_inicio: format(new Date(), 'yyyy-MM-01'),
      periodo_fin: format(new Date(), 'yyyy-MM-15'),
      observaciones: '',
      detalles: [],
    },
  })

  const { fields, remove, replace } = useFieldArray({ control, name: 'detalles' })
  const watchInicio = watch('periodo_inicio')
  const watchFin = watch('periodo_fin')

  const cargar = () => {
    setLoading(true)
    Promise.all([
      getPlanillasQuincenales(),
      getValorNumericoSistema(CLAVE_PAGO_RECEPCION_KG, DEFAULT_PAGO_RECEPCION_KG),
    ])
      .then(([planillasDb, pagoRecepcion]) => {
        setPlanillas(planillasDb)
        setPagoRecepcionKg(pagoRecepcion)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const cargarResumen = async () => {
    if (!watchInicio || !watchFin) return
    setCargandoResumen(true)
    try {
      const resumen: ResumenColaboradorPeriodo[] = await getResumenColaboradoresPeriodo(watchInicio, watchFin, pagoRecepcionKg)
      replace(resumen.map((r) => ({
        colaborador_id: r.colaborador_id,
        nombre_display: `${r.apellido}, ${r.nombre}`,
        kg_bruto_recepcion: r.kg_bruto_recepcion,
        pago_recepcion: r.pago_recepcion,
        kg_cat1_seleccion: r.kg_cat1_seleccion,
        kg_cat2_seleccion: r.kg_cat2_seleccion,
        pago_seleccion: r.pago_seleccion,
        n_cajas_empaquetado: 0,
        otros_montos: 0,
      })))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargandoResumen(false)
    }
  }

  const onSubmit = async (data: PlanillaForm) => {
    if (!user) return
    const detalles = data.detalles.map((d) => {
      const monto_empaquetado = d.n_cajas_empaquetado * PAGO_POR_CAJA
      const total = d.pago_recepcion + d.pago_seleccion + monto_empaquetado + (d.otros_montos ?? 0)
      return {
        colaborador_id: d.colaborador_id,
        planilla_id: '',   // se reemplaza en el service
        kg_bruto_recepcion: d.kg_bruto_recepcion,
        pago_recepcion: d.pago_recepcion,
        kg_cat1_seleccion: d.kg_cat1_seleccion,
        kg_cat2_seleccion: d.kg_cat2_seleccion,
        pago_seleccion: d.pago_seleccion,
        n_cajas_empaquetado: d.n_cajas_empaquetado,
        monto_empaquetado,
        otros_montos: d.otros_montos ?? 0,
        total,
      }
    })
    const total_monto = detalles.reduce((acc, d) => acc + d.total, 0)
    await createPlanillaQuincenal(
      {
        periodo_inicio: data.periodo_inicio,
        periodo_fin: data.periodo_fin,
        total_monto,
        estado: 'pendiente',
        observaciones: data.observaciones || null,
      },
      detalles,
      user.id
    )
    reset()
    setCreando(false)
    cargar()
  }

  const handleVerDetalle = async (planilla: PlanillaQuincenal) => {
    setCargandoDetalle(true)
    setDetallePlanilla(planilla)
    try {
      const full = await getPlanillaConDetalles(planilla.id)
      setDetallePlanilla(full)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargandoDetalle(false)
    }
  }

  const handlePagar = async () => {
    if (!planillaAConfirmar) return
    await pagarPlanilla(planillaAConfirmar)
    setPlanillaAConfirmar(null)
    cargar()
  }

  // Live calculation
  const totalEstimado = fields.reduce((acc, _, i) => {
    const pago_sel = watch(`detalles.${i}.pago_seleccion`) ?? 0
    const pago_recep = watch(`detalles.${i}.pago_recepcion`) ?? 0
    const n_cajas = watch(`detalles.${i}.n_cajas_empaquetado`) ?? 0
    const otros = watch(`detalles.${i}.otros_montos`) ?? 0
    return acc + pago_recep + pago_sel + (n_cajas * PAGO_POR_CAJA) + otros
  }, 0)

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Planilla Quincenal"
        description="Liquidación de trabajadores por selección y empaquetado"
        actions={
          !creando ? (
            <Button onClick={() => setCreando(true)}>Nueva planilla</Button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* Formulario nueva planilla */}
      {creando && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nueva planilla quincenal</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Período inicio" error={errors.periodo_inicio?.message} required>
                  <Input type="date" {...register('periodo_inicio', { required: true })} />
                </FormField>
                <FormField label="Período fin" error={errors.periodo_fin?.message} required>
                  <Input type="date" {...register('periodo_fin', { required: true })} />
                </FormField>
                <FormField label="Observaciones" className="col-span-2">
                  <Textarea rows={2} {...register('observaciones')} />
                </FormField>
              </div>

              {/* Pre-cargar desde clasificación */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cargandoResumen}
                  onClick={cargarResumen}
                >
                  {cargandoResumen ? 'Cargando...' : 'Cargar colaboradores del período'}
                </Button>
                <p className="text-xs text-muted-foreground">Recepción: S/{pagoRecepcionKg.toFixed(2)}/kg bruto</p>
                {fields.length > 0 && (
                  <p className="text-xs text-muted-foreground">{fields.length} operario(s) cargados</p>
                )}
              </div>

              {/* Detalle por operario */}
              {fields.length > 0 && (
                <div className="flex flex-col gap-3">
                  {fields.map((field, i) => {
                    const pago_sel = watch(`detalles.${i}.pago_seleccion`) ?? 0
                    const pago_recep = watch(`detalles.${i}.pago_recepcion`) ?? 0
                    const kg_bruto_recep = watch(`detalles.${i}.kg_bruto_recepcion`) ?? 0
                    const nCajas = watch(`detalles.${i}.n_cajas_empaquetado`) ?? 0
                    const otros = watch(`detalles.${i}.otros_montos`) ?? 0
                    const pago_empaque = nCajas * PAGO_POR_CAJA
                    const total = pago_recep + pago_sel + pago_empaque + otros
                    return (
                      <div key={field.id} className="border rounded-lg overflow-hidden">
                        {/* Header del operario */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
                          <span className="font-semibold text-sm">{field.nombre_display}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-base">{formatMoneda(total)}</span>
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(i)}>✕</Button>
                          </div>
                        </div>
                        {/* Cuerpo: 3 secciones */}
                        <div className="grid grid-cols-4 divide-x text-sm">
                          {/* Recepción — solo lectura */}
                          <div className="px-4 py-3 bg-blue-50/40">
                            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Recepción</p>
                            <p className="text-lg font-bold text-blue-700">{formatMoneda(pago_recep)}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{kg_bruto_recep.toFixed(2)} kg × S/{pagoRecepcionKg.toFixed(2)}</p>
                          </div>
                          {/* Selección — solo lectura */}
                          <div className="px-4 py-3 bg-green-50/40">
                            <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">Selección (Tareo A)</p>
                            <p className="text-lg font-bold text-green-700">{formatMoneda(pago_sel)}</p>
                            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                              <div className="flex justify-between gap-4">
                                <span>Cat1: {field.kg_cat1_seleccion.toFixed(2)} kg × S/0.20</span>
                                <span className="text-foreground">{formatMoneda(field.kg_cat1_seleccion * 0.20)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>Cat2: {field.kg_cat2_seleccion.toFixed(2)} kg × S/0.28</span>
                                <span className="text-foreground">{formatMoneda(field.kg_cat2_seleccion * 0.28)}</span>
                              </div>
                            </div>
                          </div>
                          {/* Empaquetado — editable */}
                          <div className="px-4 py-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Empaquetado (Tareo D)</p>
                            <div className="flex items-center gap-2 mb-1">
                              <Input
                                type="number"
                                min="0"
                                className="h-8 w-24"
                                placeholder="0"
                                {...register(`detalles.${i}.n_cajas_empaquetado`, { valueAsNumber: true })}
                              />
                              <span className="text-xs text-muted-foreground">cajas</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {nCajas > 0
                                ? <>{nCajas} × S/{PAGO_POR_CAJA} = <span className="font-semibold text-foreground">{formatMoneda(pago_empaque)}</span></>
                                : <>S/{PAGO_POR_CAJA}/caja</>
                              }
                            </p>
                          </div>
                          {/* Otros — editable */}
                          <div className="px-4 py-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Otros conceptos</p>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-8 w-28"
                              placeholder="0.00"
                              {...register(`detalles.${i}.otros_montos`, { valueAsNumber: true })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">jornal, adelantos, descuentos…</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {/* Total general */}
                  <div className="flex justify-end items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg border">
                    <span className="font-semibold text-sm">Total planilla:</span>
                    <span className="font-bold text-lg">{formatMoneda(totalEstimado)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setCreando(false); reset() }}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || fields.length === 0}>
                  {isSubmitting ? 'Guardando...' : 'Crear planilla'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Listado */}
      {planillas.length === 0 && !creando ? (
        <p className="text-center text-muted-foreground py-12">No hay planillas registradas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {planillas.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm">
                      {formatFecha(p.periodo_inicio)} → {formatFecha(p.periodo_fin)}
                    </p>
                    {p.observaciones && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.observaciones}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold text-sm">{formatMoneda(p.total_monto)}</p>
                    <Badge className={p.estado === 'pagada' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>
                      {p.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => handleVerDetalle(p)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {p.estado === 'pendiente' && (
                      <Button size="sm" variant="outline" onClick={() => setPlanillaAConfirmar(p.id)}>
                        Marcar pagada
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Detail Dialog */}
      <Dialog open={!!detallePlanilla} onOpenChange={(o) => { if (!o) setDetallePlanilla(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detallePlanilla && (
            <>
              <DialogHeader>
                <DialogTitle>Planilla Quincenal</DialogTitle>
                <DialogDescription>
                  {formatFecha(detallePlanilla.periodo_inicio)} → {formatFecha(detallePlanilla.periodo_fin)}
                  {detallePlanilla.observaciones && ` · ${detallePlanilla.observaciones}`}
                </DialogDescription>
              </DialogHeader>
              {cargandoDetalle ? (
                <p className="text-center text-muted-foreground py-8">Cargando detalle...</p>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {detallePlanilla.detalles && detallePlanilla.detalles.length > 0 ? (
                    detallePlanilla.detalles.map((d) => {
                      const colName = d.colaborador
                        ? `${d.colaborador.apellido}, ${d.colaborador.nombre}`
                        : d.colaborador_id
                      return (
                        <div key={d.id} className="border rounded-lg overflow-hidden text-sm">
                          <div className="flex justify-between items-center px-4 py-2 bg-muted/40 border-b">
                            <span className="font-semibold">{colName}</span>
                            <span className="font-bold">{formatMoneda(d.total)}</span>
                          </div>
                          <div className="grid grid-cols-4 divide-x">
                            <div className="px-3 py-2 bg-blue-50/40">
                              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Recepción</p>
                              <p className="font-bold text-blue-700">{formatMoneda(d.pago_recepcion)}</p>
                              <p className="text-xs text-muted-foreground mt-1">{d.kg_bruto_recepcion.toFixed(2)} kg</p>
                            </div>
                            <div className="px-3 py-2 bg-green-50/40">
                              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">Selección</p>
                              <p className="font-bold text-green-700">{formatMoneda(d.pago_seleccion)}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Cat1: {d.kg_cat1_seleccion.toFixed(2)} kg<br />
                                Cat2: {d.kg_cat2_seleccion.toFixed(2)} kg
                              </p>
                            </div>
                            <div className="px-3 py-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Empaquetado</p>
                              <p className="font-bold">{formatMoneda(d.monto_empaquetado)}</p>
                              <p className="text-xs text-muted-foreground mt-1">{d.n_cajas_empaquetado} cajas × S/{PAGO_POR_CAJA.toFixed(2)}</p>
                            </div>
                            <div className="px-3 py-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Otros</p>
                              <p className="font-bold">{formatMoneda(d.otros_montos)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">Sin detalles cargados.</p>
                  )}
                  <div className="flex justify-between items-center px-4 py-3 bg-muted/30 rounded-lg border">
                    <span className="text-sm font-semibold">Total planilla</span>
                    <span className="font-bold text-base">{formatMoneda(detallePlanilla.total_monto)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm pagar */}
      <ConfirmDialog
        open={!!planillaAConfirmar}
        title="¿Marcar como pagada?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Sí, marcar pagada"
        onConfirm={handlePagar}
        onCancel={() => setPlanillaAConfirmar(null)}
      />
    </div>
  )
}
