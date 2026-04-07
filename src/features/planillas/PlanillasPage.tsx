import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  getPlanillasQuincenales,
  createPlanillaQuincenal,
  pagarPlanilla,
  getResumenHidroculizadoPeriodo,
  type ResumenColaboradorPeriodo,
} from '@/services/planillas.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth.store'
import { formatFecha, formatMoneda } from '@/utils/formatters'
import { format } from 'date-fns'
import type { PlanillaQuincenal } from '@/types/models'

const PAGO_POR_CAJA = 0.32   // S/ 0.32 por caja empaquetada (Módulo D PDF)

type DetalleForm = {
  colaborador_id: string
  nombre_display: string
  n_jabas_hidroculizado: number
  n_cajas_empaquetado: number
  otros_montos: number
  observaciones: string
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
    getPlanillasQuincenales()
      .then(setPlanillas)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const cargarResumen = async () => {
    if (!watchInicio || !watchFin) return
    setCargandoResumen(true)
    try {
      const resumen: ResumenColaboradorPeriodo[] = await getResumenHidroculizadoPeriodo(watchInicio, watchFin)
      replace(resumen.map((r) => ({
        colaborador_id: r.colaborador_id,
        nombre_display: `${r.apellido}, ${r.nombre}`,
        n_jabas_hidroculizado: r.n_jabas_hidroculizado,
        n_cajas_empaquetado: 0,
        otros_montos: 0,
        observaciones: '',
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
      const total = monto_empaquetado + (d.otros_montos ?? 0)
      return {
        colaborador_id: d.colaborador_id,
        planilla_id: '',   // se reemplaza en el service
        n_jabas_hidroculizado: d.n_jabas_hidroculizado,
        n_cajas_empaquetado: d.n_cajas_empaquetado,
        monto_empaquetado,
        otros_montos: d.otros_montos ?? 0,
        total,
        observaciones: d.observaciones || null,
      }
    })
    const total_monto = detalles.reduce((acc, d) => acc + d.total, 0)
    await createPlanillaQuincenal(
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
    reset()
    setCreando(false)
    cargar()
  }

  const handlePagar = async (planillaId: string) => {
    if (!confirm('¿Marcar planilla como PAGADA? Esta acción no se puede deshacer.')) return
    await pagarPlanilla(planillaId)
    cargar()
  }

  // Live calculation
  const totalEstimado = fields.reduce((acc, _, i) => {
    const n_cajas = watch(`detalles.${i}.n_cajas_empaquetado`) ?? 0
    const otros = watch(`detalles.${i}.otros_montos`) ?? 0
    return acc + (n_cajas * PAGO_POR_CAJA) + otros
  }, 0)

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Planilla Quincenal"
        description="Liquidación de trabajadores — Tareo B (Hidroculizado) + Tareo D (Empaquetado)"
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

              {/* Pre-cargar desde tareos */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cargandoResumen}
                  onClick={cargarResumen}
                >
                  {cargandoResumen ? 'Cargando...' : 'Cargar operarios desde tareos del período'}
                </Button>
                {fields.length > 0 && (
                  <p className="text-xs text-muted-foreground">{fields.length} operario(s) cargados</p>
                )}
              </div>

              {/* Detalle por operario */}
              {fields.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Operario</th>
                        <th className="text-left px-3 py-2 font-medium">Jabas Hidroc.</th>
                        <th className="text-left px-3 py-2 font-medium">Cajas Empaq.</th>
                        <th className="text-left px-3 py-2 font-medium">Otros (S/.)</th>
                        <th className="text-right px-3 py-2 font-medium">Total</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, i) => {
                        const nCajas = watch(`detalles.${i}.n_cajas_empaquetado`) ?? 0
                        const otros = watch(`detalles.${i}.otros_montos`) ?? 0
                        const total = nCajas * PAGO_POR_CAJA + otros
                        return (
                          <tr key={field.id} className="border-t">
                            <td className="px-3 py-2">{field.nombre_display}</td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min="0"
                                className="h-7 w-20"
                                {...register(`detalles.${i}.n_jabas_hidroculizado`, { valueAsNumber: true })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min="0"
                                className="h-7 w-20"
                                placeholder="0"
                                {...register(`detalles.${i}.n_cajas_empaquetado`, { valueAsNumber: true })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="h-7 w-24"
                                placeholder="0.00"
                                {...register(`detalles.${i}.otros_montos`, { valueAsNumber: true })}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{formatMoneda(total)}</td>
                            <td className="px-2 py-2">
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(i)}>✕</Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total planilla:</td>
                        <td className="px-3 py-2 text-right font-bold">{formatMoneda(totalEstimado)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                  <p className="text-xs text-muted-foreground px-3 pb-2">
                    Empaquetado: S/ {PAGO_POR_CAJA} × cajas. Los demás conceptos (jornal, adelantos, descuentos) van en "Otros".
                  </p>
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
                      {p.estado === 'pagada' ? 'Pagada' : 'Borrador'}
                    </Badge>
                    {p.estado === 'borrador' && (
                      <Button size="sm" variant="outline" onClick={() => handlePagar(p.id)}>
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
    </div>
  )
}
