import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clasificacionSchema, type ClasificacionFormData } from '@/utils/validators'
import { getLote, actualizarEstadoLote } from '@/services/lotes.service'
import { getClasificacionesPorLote, createClasificacion, deleteClasificacion } from '@/services/clasificaciones.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { CategoriaClasificacionBadge } from '@/components/shared/StatusBadge'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePersonal } from '@/features/personal/hooks/usePersonal'
import { useAuthStore } from '@/store/auth.store'
import { formatPeso } from '@/utils/formatters'
import { calcularPesoTotalClasificado, validarPesoClasificacion } from '@/utils/business-rules'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Lote, Clasificacion } from '@/types/models'

export default function ClasificarLotePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { personal } = usePersonal()
  const [lote, setLote] = useState<Lote | null>(null)
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorPeso, setErrorPeso] = useState<string | null>(null)

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<ClasificacionFormData>({
    resolver: zodResolver(clasificacionSchema) as any,
    defaultValues: {
      lote_id: id ?? '',
      categoria: 'primera',
      fecha_clasificacion: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [l, cls] = await Promise.all([getLote(id), getClasificacionesPorLote(id)])
      setLote(l); setClasificaciones(cls)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [id])

  const onSubmit = async (data: ClasificacionFormData) => {
    if (!lote || !user) return

    const pesoYa = calcularPesoTotalClasificado(clasificaciones)
    const errPeso = validarPesoClasificacion(lote.peso_bruto_kg, pesoYa, data.peso_kg)
    if (errPeso) { setErrorPeso(errPeso); return }

    setErrorPeso(null)
    const nueva = await createClasificacion(data, user.id)

    // Cambiar estado del lote a en_clasificacion si aún está ingresado
    if (lote.estado === 'ingresado') {
      await actualizarEstadoLote(lote.id, 'en_clasificacion')
    }

    setClasificaciones((prev) => [...prev, nueva])
    reset({ lote_id: id ?? '', categoria: 'primera', fecha_clasificacion: format(new Date(), 'yyyy-MM-dd') })
  }

  const handleEliminar = async (clasificacionId: string) => {
    await deleteClasificacion(clasificacionId)
    setClasificaciones((prev) => prev.filter((c) => c.id !== clasificacionId))
  }

  const handleFinalizar = async () => {
    if (!lote) return
    if (!confirm('¿Marcar la clasificación como completada?')) return
    await actualizarEstadoLote(lote.id, 'clasificado')
    navigate(`/lotes/${id}`)
  }

  const personalActivo = personal.filter((p) => p.estado === 'activo')
  const pesoClasificado = calcularPesoTotalClasificado(clasificaciones)

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!lote) return null

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={`Clasificar – ${lote.codigo}`}
        backHref={`/lotes/${id}`}
        actions={
          clasificaciones.length > 0 && (
            <Button onClick={handleFinalizar}>Finalizar clasificación</Button>
          )
        }
      />

      {/* Resumen del lote */}
      <Card className="mb-4">
        <CardContent className="pt-4 grid grid-cols-3 gap-2 text-sm">
          <div><p className="text-muted-foreground text-xs">Peso bruto</p><p className="font-bold">{formatPeso(lote.peso_bruto_kg)}</p></div>
          <div><p className="text-muted-foreground text-xs">Clasificado</p><p className="font-bold text-agro-green">{formatPeso(pesoClasificado)}</p></div>
          <div><p className="text-muted-foreground text-xs">Saldo</p><p className="font-bold">{formatPeso(lote.peso_bruto_kg - pesoClasificado)}</p></div>
        </CardContent>
      </Card>

      {/* Formulario */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Registrar clasificación</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit as any)} className="flex flex-col gap-4">
            <Input type="hidden" {...register('lote_id')} value={id} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Personal" error={errors.personal_id?.message} required>
                <Controller name="personal_id" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {personalActivo.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </FormField>

              <FormField label="Categoría" error={errors.categoria?.message} required>
                <Controller name="categoria" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primera">Primera</SelectItem>
                      <SelectItem value="segunda">Segunda</SelectItem>
                      <SelectItem value="descarte">Descarte</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </FormField>

              <FormField label="Peso (kg)" error={errors.peso_kg?.message} required>
                <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...register('peso_kg', { valueAsNumber: true })} />
              </FormField>

              <FormField label="N° cajas" error={errors.num_cajas?.message} required>
                <Input type="number" min="0" step="1" placeholder="0" {...register('num_cajas', { valueAsNumber: true })} />
              </FormField>

              <FormField label="Fecha" error={errors.fecha_clasificacion?.message} required>
                <Input type="date" {...register('fecha_clasificacion')} />
              </FormField>
            </div>

            <FormField label="Observaciones" error={errors.observaciones?.message}>
              <Textarea rows={2} {...register('observaciones')} />
            </FormField>

            {errorPeso && <p className="text-sm text-destructive">{errorPeso}</p>}

            <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto sm:self-end">
              Registrar clasificación
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista de clasificaciones */}
      {clasificaciones.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Clasificaciones registradas</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {clasificaciones.map((c) => (
              <div key={c.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{c.personal?.nombre} {c.personal?.apellido}</span>
                  <span className="text-muted-foreground mx-2">·</span>
                  <CategoriaClasificacionBadge categoria={c.categoria} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatPeso(c.peso_kg)} · {c.num_cajas} cjs</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleEliminar(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
