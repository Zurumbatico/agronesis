import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  getPlanillasQuincenales,
  createPlanillaQuincenal,
  actualizarEstadoPlanilla,
  pagarPlanilla,
  getPlanillaConDetalles,
  getResumenColaboradoresPeriodo,
  getColaboradoresYaLiquidados,
  updatePlanillaQuincenal,
  deletePlanillaQuincenal,
} from '@/services/planillas.service'
import { logAudit } from '@/services/audit.service'
import { CLAVE_PAGO_RECEPCION_KG, CLAVE_PAGO_EMPAQUETADO_CAJA, getValorNumericoSistema } from '@/services/config-precios.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { FormField } from '@/components/shared/FormField'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RegistrarPagoDialog, type RegistroPagoPayload } from '@/components/shared/RegistrarPagoDialog'
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
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'
import { APP_ROLES } from '@/types/auth'
import { formatFecha, formatMoneda } from '@/utils/formatters'
import { generatePlanillaQuincenalExcel } from '@/utils/planilla-quincenal-excel'
import { format } from 'date-fns'
import { Eye, Download, Pencil, Trash2 } from 'lucide-react'
import type { EstadoPlanilla, PlanillaQuincenal } from '@/types/models'
import { DEFAULT_PAGO_RECEPCION_KG, DEFAULT_PAGO_EMPAQUETADO_CAJA } from '@/utils/business-rules'

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
  const { user, roles } = useAuthStore()
  const [planillas, setPlanillas] = useState<PlanillaQuincenal[]>([])
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [excluidos, setExcluidos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pagoRecepcionKg, setPagoRecepcionKg] = useState(DEFAULT_PAGO_RECEPCION_KG)
  const [pagoEmpaquetadoCaja, setPagoEmpaquetadoCaja] = useState(DEFAULT_PAGO_EMPAQUETADO_CAJA)
  const [detallePlanilla, setDetallePlanilla] = useState<PlanillaQuincenal | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [accionPendiente, setAccionPendiente] = useState<{ id: string; estado: 'confirmada' } | null>(null)
  const [pagoPendienteId, setPagoPendienteId] = useState<string | null>(null)
  const [descargandoId, setDescargandoId] = useState<string | null>(null)
  const [eliminarPendienteId, setEliminarPendienteId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [cargandoEdicion, setCargandoEdicion] = useState(false)
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

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
  const puedePagar = hasPermission(roles, APP_PERMISSIONS.PLANILLAS_PAY)
  const esTesoreria = roles.includes(APP_ROLES.TESORERIA)
  const puedeDescargar = esTesoreria || roles.includes(APP_ROLES.ADMIN) || roles.includes(APP_ROLES.GERENCIA)

  const cargar = () => {
    setLoading(true)
    Promise.all([
      getPlanillasQuincenales(),
      getValorNumericoSistema(CLAVE_PAGO_RECEPCION_KG, DEFAULT_PAGO_RECEPCION_KG),
      getValorNumericoSistema(CLAVE_PAGO_EMPAQUETADO_CAJA, DEFAULT_PAGO_EMPAQUETADO_CAJA),
    ])
      .then(([planillasDb, pagoRecepcion, pagoEmpaquetado]) => {
        setPlanillas(planillasDb)
        setPagoRecepcionKg(pagoRecepcion)
        setPagoEmpaquetadoCaja(pagoEmpaquetado)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const resetFormulario = () => {
    reset({
      periodo_inicio: format(new Date(), 'yyyy-MM-01'),
      periodo_fin: format(new Date(), 'yyyy-MM-15'),
      observaciones: '',
      detalles: [],
    })
    setExcluidos(0)
    setEditandoId(null)
  }

  const handleEditar = async (id: string) => {
    setCargandoEdicion(true)
    setError(null)
    try {
      const full = await getPlanillaConDetalles(id)
      if (full.estado !== 'borrador') {
        throw new Error('Solo se puede editar una planilla en borrador')
      }

      const detallesForm: DetalleForm[] = (full.detalles ?? []).map((d) => ({
        colaborador_id: d.colaborador_id,
        nombre_display: d.colaborador ? `${d.colaborador.apellido}, ${d.colaborador.nombre}` : d.colaborador_id,
        kg_bruto_recepcion: d.kg_bruto_recepcion,
        pago_recepcion: d.pago_recepcion,
        kg_cat1_seleccion: d.kg_cat1_seleccion,
        kg_cat2_seleccion: d.kg_cat2_seleccion,
        pago_seleccion: d.pago_seleccion,
        n_cajas_empaquetado: d.n_cajas_empaquetado,
        otros_montos: d.otros_montos,
      }))

      reset({
        periodo_inicio: full.periodo_inicio,
        periodo_fin: full.periodo_fin,
        observaciones: full.observaciones ?? '',
        detalles: detallesForm,
      })

      setExcluidos(0)
      setEditandoId(id)
      setCreando(true)
      setDetallePlanilla(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargandoEdicion(false)
    }
  }

  const cargarResumen = async () => {
    if (!watchInicio || !watchFin) return
    setCargandoResumen(true)
    setExcluidos(0)
    try {
      const [resumen, yaLiquidados] = await Promise.all([
        getResumenColaboradoresPeriodo(watchInicio, watchFin, pagoRecepcionKg, pagoEmpaquetadoCaja),
        getColaboradoresYaLiquidados(watchInicio, watchFin),
      ])
      const filtrado = resumen.filter((r) => !yaLiquidados.has(r.colaborador_id))
      setExcluidos(resumen.length - filtrado.length)
      replace(filtrado.map((r) => ({
        colaborador_id: r.colaborador_id,
        nombre_display: `${r.apellido}, ${r.nombre}`,
        kg_bruto_recepcion: r.kg_bruto_recepcion,
        pago_recepcion: r.pago_recepcion,
        kg_cat1_seleccion: r.kg_cat1_seleccion,
        kg_cat2_seleccion: r.kg_cat2_seleccion,
        pago_seleccion: r.pago_seleccion,
        n_cajas_empaquetado: r.n_cajas_empaquetado,
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
      const monto_empaquetado = d.n_cajas_empaquetado * pagoEmpaquetadoCaja
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

    if (editandoId) {
      const previa = planillas.find((p) => p.id === editandoId)
      const actualizada = await updatePlanillaQuincenal(
        editandoId,
        {
          periodo_inicio: data.periodo_inicio,
          periodo_fin: data.periodo_fin,
          total_monto,
          observaciones: data.observaciones || null,
        },
        detalles,
        user.id
      )

      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'planillas_quincenales',
        registroId: actualizada.id,
        descripcion: `Planilla editada: ${formatFecha(actualizada.periodo_inicio)} - ${formatFecha(actualizada.periodo_fin)}`,
        datosAnteriores: {
          periodo_inicio: previa?.periodo_inicio,
          periodo_fin: previa?.periodo_fin,
          total_monto: previa?.total_monto,
        },
        datosNuevos: {
          periodo_inicio: actualizada.periodo_inicio,
          periodo_fin: actualizada.periodo_fin,
          total_monto: actualizada.total_monto,
        },
      })
    } else {
      const creada = await createPlanillaQuincenal(
        {
          periodo_inicio: data.periodo_inicio,
          periodo_fin: data.periodo_fin,
          total_monto,
          estado: 'borrador',
          observaciones: data.observaciones || null,
        },
        detalles,
        user.id
      )
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'crear',
        modulo: 'planillas_quincenales',
        registroId: creada.id,
        descripcion: `Planilla creada: ${formatFecha(creada.periodo_inicio)} - ${formatFecha(creada.periodo_fin)}`,
        datosAnteriores: null,
        datosNuevos: { periodo_inicio: creada.periodo_inicio, periodo_fin: creada.periodo_fin, total_monto: creada.total_monto },
      })
    }

    resetFormulario()
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

  const handleCambiarEstado = async () => {
    if (!accionPendiente || !user) return

    const planilla = planillas.find((p) => p.id === accionPendiente.id)

    await actualizarEstadoPlanilla(accionPendiente.id, accionPendiente.estado)
    void logAudit({
      userId: user.id,
      userEmail: user.email ?? '',
      accion: 'actualizar',
      modulo: 'planillas_quincenales',
      registroId: accionPendiente.id,
      descripcion: `Planilla confirmada: ${planilla ? `${formatFecha(planilla.periodo_inicio)} - ${formatFecha(planilla.periodo_fin)}` : accionPendiente.id}`,
      datosAnteriores: { estado: 'borrador' },
      datosNuevos: { estado: accionPendiente.estado },
    })

    if (detallePlanilla?.id === accionPendiente.id) {
      const full = await getPlanillaConDetalles(accionPendiente.id)
      setDetallePlanilla(full)
    }

    setAccionPendiente(null)
    cargar()
  }

  const handleRegistrarPago = async (payload: RegistroPagoPayload) => {
    if (!pagoPendienteId || !user) return
    if (!puedePagar) return

    const planilla = planillas.find((p) => p.id === pagoPendienteId)

    await pagarPlanilla(pagoPendienteId, payload)
    void logAudit({
      userId: user.id,
      userEmail: user.email ?? '',
      accion: 'actualizar',
      modulo: 'planillas_quincenales',
      registroId: pagoPendienteId,
      descripcion: `Planilla liquidada: ${planilla ? `${formatFecha(planilla.periodo_inicio)} - ${formatFecha(planilla.periodo_fin)}` : pagoPendienteId}`,
      datosAnteriores: { estado: 'confirmada' },
      datosNuevos: { estado: 'pagada', fecha_pago: payload.fecha_pago },
    })

    if (detallePlanilla?.id === pagoPendienteId) {
      const full = await getPlanillaConDetalles(pagoPendienteId)
      setDetallePlanilla(full)
    }

    setPagoPendienteId(null)
    cargar()
  }

  const handleDescargar = async (planillaId: string) => {
    setDescargandoId(planillaId)
    try {
      const full = await getPlanillaConDetalles(planillaId)
      generatePlanillaQuincenalExcel(full)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDescargandoId(null)
    }
  }

  const handleEliminar = async (id: string) => {
    if (!user) return
    try {
      const planilla = planillas.find(p => p.id === id)
      await deletePlanillaQuincenal(id)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'eliminar',
        modulo: 'planillas_quincenales',
        registroId: id,
        descripcion: `Planilla eliminada: ${formatFecha(planilla?.periodo_inicio)} - ${formatFecha(planilla?.periodo_fin)}`,
        datosAnteriores: { periodo_inicio: planilla?.periodo_inicio, total_monto: planilla?.total_monto },
        datosNuevos: null,
      })
      cargar()
      setEliminarPendienteId(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Live calculation
  const totalEstimado = fields.reduce((acc, _, i) => {
    const pago_sel = watch(`detalles.${i}.pago_seleccion`) ?? 0
    const pago_recep = watch(`detalles.${i}.pago_recepcion`) ?? 0
    const n_cajas = watch(`detalles.${i}.n_cajas_empaquetado`) ?? 0
    const otros = watch(`detalles.${i}.otros_montos`) ?? 0
    return acc + pago_recep + pago_sel + (n_cajas * pagoEmpaquetadoCaja) + otros
  }, 0)

  const planillasFiltradas = planillas
    .filter((p) => !esTesoreria || ['confirmada', 'pagada'].includes(p.estado))
    .filter((p) => {
      if (!filtroDesde && !filtroHasta) return true

      const inicio = p.periodo_inicio
      const fin = p.periodo_fin

      if (filtroDesde && fin < filtroDesde) return false
      if (filtroHasta && inicio > filtroHasta) return false
      return true
    })

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Planilla Quincenal"
        description="Liquidación de trabajadores por selección y empaquetado"
        actions={
          !creando ? (
            <Button onClick={() => { resetFormulario(); setCreando(true) }}>Nueva planilla</Button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <FormField label="Desde">
              <Input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
            </FormField>
            <FormField label="Hasta">
              <Input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
            </FormField>
            <div className="md:col-span-2 flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setFiltroDesde(''); setFiltroHasta('') }}>
                Limpiar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulario nueva planilla */}
      {creando && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{editandoId ? 'Editar planilla quincenal' : 'Nueva planilla quincenal'}</CardTitle>
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
                  {fields.length > 0 && (
                  <p className="text-xs text-muted-foreground">{fields.length} operario(s) cargados</p>
                )}
                {excluidos > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    {excluidos} trabajador{excluidos > 1 ? 'es' : ''} excluido{excluidos > 1 ? 's' : ''} — ya están en una planilla del período
                  </p>
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
                    const pago_empaque = nCajas * pagoEmpaquetadoCaja
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
                          {/* Empaquetado — solo lectura */}
                          <div className="px-4 py-3 bg-amber-50/40">
                            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Empaquetado (Tareo D)</p>
                            <p className="text-lg font-bold text-amber-700">{formatMoneda(pago_empaque)}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {nCajas > 0
                                ? <>{nCajas} cajas × S/{pagoEmpaquetadoCaja.toFixed(2)}</>
                                : <>0 cajas</>
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
                <Button type="button" variant="outline" onClick={() => { setCreando(false); resetFormulario() }}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || fields.length === 0}>
                  {isSubmitting ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar borrador'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Listado */}
      {planillasFiltradas.length === 0 && !creando ? (
        <p className="text-center text-muted-foreground py-12">No hay planillas registradas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {planillasFiltradas.map((p) => (
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
                    {esTesoreria && p.estado === 'pagada' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Pago: {p.fecha_pago ? formatFecha(p.fecha_pago) : '-'}
                        {' · '}Operacion: {p.numero_operacion || '-'}
                        {' · '}Modalidad: {p.modalidad_pago === 'transferencia'
                          ? 'Transferencia'
                          : p.modalidad_pago === 'yape_plin'
                            ? 'Yape/Plin'
                            : p.modalidad_pago === 'efectivo'
                              ? 'Efectivo'
                              : '-'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold text-sm">{formatMoneda(p.total_monto)}</p>
                    <Badge className={getPlanillaBadgeClassName(p.estado)}>
                      {getPlanillaEstadoLabel(p.estado)}
                    </Badge>
                    {puedeDescargar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={descargandoId === p.id}
                        onClick={() => { void handleDescargar(p.id) }}
                        title="Descargar reporte"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleVerDetalle(p)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {p.estado === 'borrador' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={creando || cargandoEdicion}
                          onClick={() => { void handleEditar(p.id) }}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={creando}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setEliminarPendienteId(p.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAccionPendiente({ id: p.id, estado: 'confirmada' })}>
                          Confirmar
                        </Button>
                      </>
                    )}
                    {p.estado === 'confirmada' && (
                      puedePagar ? (
                        <Button size="sm" variant="outline" onClick={() => setPagoPendienteId(p.id)}>
                          Marcar liquidada
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled>
                          Pago solo admin
                        </Button>
                      )
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
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
                <Badge className={getPlanillaBadgeClassName(detallePlanilla.estado)}>
                  {getPlanillaEstadoLabel(detallePlanilla.estado)}
                </Badge>
                <div className="flex items-center gap-2">
                  {detallePlanilla.estado === 'borrador' && (
                    <Button size="sm" variant="outline" onClick={() => setAccionPendiente({ id: detallePlanilla.id, estado: 'confirmada' })}>
                      Confirmar
                    </Button>
                  )}
                  {detallePlanilla.estado === 'confirmada' && (
                    puedePagar ? (
                      <Button size="sm" variant="outline" onClick={() => setPagoPendienteId(detallePlanilla.id)}>
                        Marcar pagada
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled>
                        Pago solo admin
                      </Button>
                    )
                  )}
                </div>
              </div>
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
                              <p className="text-xs text-muted-foreground mt-1">{d.n_cajas_empaquetado} cajas × S/{pagoEmpaquetadoCaja.toFixed(2)}</p>
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

      {/* Confirmar acción */}
      <ConfirmDialog
        open={!!eliminarPendienteId}
        title="¿Eliminar planilla?"
        description="Se eliminará la planilla. Esta acción es irreversible."
        confirmLabel="Sí, eliminar"
        variant="destructive"
        loading={false}
        onConfirm={() => {
          if (eliminarPendienteId) void handleEliminar(eliminarPendienteId)
        }}
        onCancel={() => setEliminarPendienteId(null)}
      />

      <ConfirmDialog
        open={!!accionPendiente}
        title="¿Confirmar planilla?"
        description="La planilla saldrá de borrador y quedará confirmada."
        confirmLabel="Sí, confirmar"
        onConfirm={() => { void handleCambiarEstado() }}
        onCancel={() => setAccionPendiente(null)}
      />

      <RegistrarPagoDialog
        open={!!pagoPendienteId}
        title="Registrar pago de planilla"
        description="Ingresa los datos del pago para marcar la planilla como liquidada."
        onConfirm={(payload) => handleRegistrarPago(payload)}
        onCancel={() => setPagoPendienteId(null)}
      />
    </div>
  )
}

function getPlanillaEstadoLabel(estado: EstadoPlanilla): string {
  if (estado === 'borrador') return 'Borrador'
  if (estado === 'confirmada') return 'Confirmada'
  return 'Liquidado'
}

function getPlanillaBadgeClassName(estado: EstadoPlanilla): string {
  if (estado === 'borrador') return 'bg-gray-100 text-gray-700'
  if (estado === 'confirmada') return 'bg-amber-100 text-amber-800'
  return 'bg-green-100 text-green-800'
}
