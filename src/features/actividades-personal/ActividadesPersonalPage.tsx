import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { actividadPersonalSchema, type ActividadPersonalFormData } from '@/utils/validators'
import { getActividadesPorPersonal, createActividad, deleteActividad } from '@/services/actividades-personal.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePersonal } from '@/features/personal/hooks/usePersonal'
import { useLotes } from '@/features/lotes/hooks/useLotes'
import { useAuthStore } from '@/store/auth.store'
import { formatFecha, formatMoneda } from '@/utils/formatters'
import { calcularTotalActividades } from '@/utils/business-rules'
import { Plus, Trash2, ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import type { ActividadPersonal } from '@/types/models'

export default function ActividadesPersonalPage() {
  const { user } = useAuthStore()
  const { personal } = usePersonal()
  const { lotes } = useLotes()

  const [actividades, setActividades] = useState<ActividadPersonal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [personalFiltro, setPersonalFiltro] = useState<string>('all')

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<ActividadPersonalFormData>({
    resolver: zodResolver(actividadPersonalSchema) as any,
    defaultValues: {
      tipo_actividad: 'clasificacion',
      fecha: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const personalActivo = personal.filter((p) => p.estado === 'activo')
  const lotesActivos = lotes.filter((l) => ['en_clasificacion', 'clasificado', 'en_despacho'].includes(l.estado))

  const cargar = async () => {
    if (personalFiltro === 'all' && personalActivo.length === 0) return
    setLoading(true)
    setError(null)

    try {
      let acts: ActividadPersonal[] = []
      if (personalFiltro !== 'all') {
        acts = await getActividadesPorPersonal(personalFiltro)
      } else {
        const resultados = await Promise.all(personalActivo.map((p) => getActividadesPorPersonal(p.id)))
        acts = resultados.flat()
      }

      acts.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      setActividades(acts)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [personalFiltro, personalActivo.length])

  const onSubmit = async (data: ActividadPersonalFormData) => {
    if (!user) return

    const nueva = await createActividad(data, user.id)
    setActividades((prev) => [nueva, ...prev])
    setDialogOpen(false)
    reset({ tipo_actividad: 'clasificacion', fecha: format(new Date(), 'yyyy-MM-dd') })
  }

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta actividad?')) return
    await deleteActividad(id)
    setActividades((prev) => prev.filter((a) => a.id !== id))
  }

  const actividadesFiltradas =
    personalFiltro !== 'all'
      ? actividades.filter((a) => a.personal_id === personalFiltro)
      : actividades

  const { total_monto: totalGeneral } = calcularTotalActividades(actividadesFiltradas)

  if (error) return <ErrorMessage message={error} onRetry={cargar} />

  return (
    <div>
      <PageHeader
        title="Actividades del Personal"
        description="Control de tareas diarias del personal de campo"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Registrar actividad
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-4 flex flex-col sm:flex-row gap-3 items-end">
          <FormField label="Filtrar por personal" className="flex-1">
            <Select value={personalFiltro} onValueChange={setPersonalFiltro}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {personalActivo.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {actividadesFiltradas.length > 0 && (
            <p className="text-sm text-muted-foreground pb-1">
              Total: <strong className="text-foreground">{formatMoneda(totalGeneral)}</strong> ({actividadesFiltradas.length} registros)
            </p>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <LoadingPage />
      ) : actividadesFiltradas.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin actividades" description="Registra la primera actividad del personal de campo." />
      ) : (
        <div className="flex flex-col gap-2">
          {actividadesFiltradas.map((a) => {
            const persona = personal.find((p) => p.id === a.personal_id)
            return (
              <div key={a.id} className="flex items-center justify-between border rounded-lg px-4 py-2 bg-card text-sm hover:shadow-sm transition-shadow">
                <div>
                  <p className="font-medium">{persona?.apellido ?? '–'}, {persona?.nombre ?? '–'}</p>
                  <p className="text-muted-foreground capitalize">{a.tipo_actividad.replace(/_/g, ' ')} · {formatFecha(a.fecha)}</p>
                  {a.observaciones && <p className="text-xs text-muted-foreground mt-0.5">{a.observaciones}</p>}
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="font-medium">{formatMoneda(a.total)}</p>
                    <p className="text-xs text-muted-foreground">{a.cantidad_unidades} uds · S/.{a.tarifa_unitaria}/ud</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleEliminar(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar actividad</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit as any)} className="flex flex-col gap-4">
            <FormField label="Personal" error={errors.personal_id?.message} required>
              <Controller
                name="personal_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {personalActivo.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Lote" error={errors.lote_id?.message} required>
              <Controller
                name="lote_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar lote..." /></SelectTrigger>
                    <SelectContent>
                      {lotesActivos.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.codigo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Tipo de actividad" error={errors.tipo_actividad?.message} required>
              <Controller
                name="tipo_actividad"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clasificacion">Clasificación</SelectItem>
                      <SelectItem value="cosecha">Cosecha</SelectItem>
                      <SelectItem value="empaque">Empaque</SelectItem>
                      <SelectItem value="carga">Carga</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Fecha" error={errors.fecha?.message} required>
                <Input type="date" {...register('fecha')} />
              </FormField>

              <FormField label="Cantidad" error={errors.cantidad_unidades?.message} required>
                <Input type="number" step="1" min="1" {...register('cantidad_unidades', { valueAsNumber: true })} />
              </FormField>

              <FormField label="Tarifa (S/./ud)" error={errors.tarifa_unitaria?.message} required>
                <Input type="number" step="0.01" min="0" {...register('tarifa_unitaria', { valueAsNumber: true })} />
              </FormField>
            </div>

            <FormField label="Observaciones" error={errors.observaciones?.message}>
              <Textarea rows={2} {...register('observaciones')} />
            </FormField>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={isSubmitting}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
