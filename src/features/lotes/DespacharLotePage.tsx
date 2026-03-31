import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { despachoSchema, type DespachoFormData } from '@/utils/validators'
import { getLote, actualizarEstadoLote } from '@/services/lotes.service'
import { getClasificacionesPorLote } from '@/services/clasificaciones.service'
import { getDespachosPorLote, createDespacho } from '@/services/despachos.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth.store'
import { formatFecha, formatPeso, formatMoneda } from '@/utils/formatters'
import { calcularTotalesClasificacion, validarCajasDespacho, calcularValorDespacho } from '@/utils/business-rules'
import { format } from 'date-fns'
import type { Lote, Clasificacion, Despacho } from '@/types/models'

export default function DespacharLotePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [lote, setLote] = useState<Lote | null>(null)
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([])
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCajas, setErrorCajas] = useState<string | null>(null)

  const { register, handleSubmit, control, reset, watch, formState: { errors, isSubmitting } } = useForm<DespachoFormData>({
    resolver: zodResolver(despachoSchema) as any,
    defaultValues: {
      lote_id: id ?? '',
      fecha_despacho: format(new Date(), 'yyyy-MM-dd'),
      destino: 'exportacion',
    },
  })

  const precioVenta = watch('precio_venta_kg')
  const pesoNeto = watch('peso_neto_kg')
  const subtotal = precioVenta && pesoNeto ? calcularValorDespacho({ peso_neto_kg: pesoNeto, precio_venta_kg: precioVenta }) : 0

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [l, cls, desp] = await Promise.all([getLote(id), getClasificacionesPorLote(id), getDespachosPorLote(id)])
      setLote(l); setClasificaciones(cls); setDespachos(desp)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [id])

  const onSubmit = async (data: DespachoFormData) => {
    if (!lote || !user) return
    const totales = calcularTotalesClasificacion(clasificaciones)
    const totalCajasClasificadas = Object.values(totales).reduce((acc, t) => acc + t.num_cajas, 0)
    const totalCajasYaDespachadas = despachos.reduce((acc, d) => acc + d.num_cajas_despachadas, 0)

    const cajasDisponibles = totalCajasClasificadas - totalCajasYaDespachadas
    const errCajas = validarCajasDespacho(cajasDisponibles, data.num_cajas_despachadas)
    if (errCajas) { setErrorCajas(errCajas); return }

    setErrorCajas(null)
    const nuevo = await createDespacho(data, user.id)

    if (lote.estado === 'clasificado') {
      await actualizarEstadoLote(lote.id, 'en_despacho')
    }

    setDespachos((prev) => [...prev, nuevo])
    reset({ lote_id: id ?? '', fecha_despacho: format(new Date(), 'yyyy-MM-dd'), destino: 'exportacion' })
  }

  const handleFinalizar = async () => {
    if (!lote) return
    if (!confirm('¿Marcar el lote como despachado?')) return
    await actualizarEstadoLote(lote.id, 'despachado')
    navigate(`/lotes/${id}`)
  }

  const totalesClasificacion = calcularTotalesClasificacion(clasificaciones)
  const totalCajasClasificadas = Object.values(totalesClasificacion).reduce((acc, t) => acc + t.num_cajas, 0)
  const totalCajasDespachadas = despachos.reduce((acc, d) => acc + d.num_cajas_despachadas, 0)

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!lote) return null

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={`Despachar – ${lote.codigo}`}
        backHref={`/lotes/${id}`}
        actions={
          despachos.length > 0 && (
            <Button onClick={handleFinalizar}>Fin de despacho</Button>
          )
        }
      />

      {/* Resumen cajas */}
      <Card className="mb-4">
        <CardContent className="pt-4 grid grid-cols-3 gap-2 text-sm">
          <div><p className="text-muted-foreground text-xs">Cajas clasificadas</p><p className="font-bold">{totalCajasClasificadas}</p></div>
          <div><p className="text-muted-foreground text-xs">Despachadas</p><p className="font-bold text-agro-green">{totalCajasDespachadas}</p></div>
          <div><p className="text-muted-foreground text-xs">Pendiente</p><p className="font-bold">{totalCajasClasificadas - totalCajasDespachadas}</p></div>
        </CardContent>
      </Card>

      {/* Formulario */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Registrar despacho</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit as any)} className="flex flex-col gap-4">
            <Input type="hidden" {...register('lote_id')} value={id} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Fecha despacho" error={errors.fecha_despacho?.message} required>
                <Input type="date" {...register('fecha_despacho')} />
              </FormField>

              <FormField label="Destino" error={errors.destino?.message} required>
                <Controller name="destino" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exportacion">Exportación</SelectItem>
                      <SelectItem value="mercado_local">Mercado local</SelectItem>
                      <SelectItem value="proceso">Proceso</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </FormField>

              <FormField label="Transportista" error={errors.transportista?.message}>
                <Input placeholder="Nombre del transportista" {...register('transportista')} />
              </FormField>

              <FormField label="Placa" error={errors.placa_vehiculo?.message}>
                <Input placeholder="ABC-123" {...register('placa_vehiculo')} />
              </FormField>

              <FormField label="N° cajas a despachar" error={errors.num_cajas_despachadas?.message} required>
                <Input type="number" min="1" step="1" {...register('num_cajas_despachadas', { valueAsNumber: true })} />
              </FormField>

              <FormField label="Peso neto (kg)" error={errors.peso_neto_kg?.message} required>
                <Input type="number" step="0.01" min="0.01" {...register('peso_neto_kg', { valueAsNumber: true })} />
              </FormField>

              <FormField label="Precio venta (S/./kg)" error={errors.precio_venta_kg?.message} required>
                <Input type="number" step="0.01" min="0.01" {...register('precio_venta_kg', { valueAsNumber: true })} />
              </FormField>

              {subtotal > 0 && (
                <div className="flex items-center">
                  <p className="text-sm text-muted-foreground">Valor estimado: <strong className="text-foreground">{formatMoneda(subtotal)}</strong></p>
                </div>
              )}
            </div>

            <FormField label="Observaciones" error={errors.observaciones?.message}>
              <Textarea rows={2} {...register('observaciones')} />
            </FormField>

            {errorCajas && <p className="text-sm text-destructive">{errorCajas}</p>}

            <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto sm:self-end">
              Registrar despacho
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista despachos */}
      {despachos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Despachos registrados</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {despachos.map((d) => (
              <div key={d.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-medium uppercase">{d.destino.replace('_', ' ')}</span>
                  <span className="text-muted-foreground ml-2">{formatFecha(d.fecha_despacho)}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{d.num_cajas_despachadas} cjs · {formatPeso(d.peso_neto_kg)}</p>
                <p className="text-muted-foreground text-xs">{formatMoneda(d.precio_venta_kg ?? 0)}/kg · Total: {formatMoneda(calcularValorDespacho({ peso_neto_kg: d.peso_neto_kg ?? 0, precio_venta_kg: d.precio_venta_kg ?? 0 }))}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
