import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { getLote, actualizarEstadoLote } from '@/services/lotes.service'
import {
  getTareoHidroculizadoPorLote,
  createTareoHidroculizado,
  deleteTareoHidroculizado,
} from '@/services/tareo-hidroculizado.service'
import { getColaboradores } from '@/services/colaboradores.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ColaboradorPicker } from '@/components/shared/ColaboradorPicker'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth.store'
import { formatFecha } from '@/utils/formatters'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Lote, TareoHidroculizado, Colaborador } from '@/types/models'

type FormData = {
  colaborador_id: string
  fecha: string
  n_jabas: number
  observaciones: string
}

export default function HidroculizarPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [lote, setLote] = useState<Lote | null>(null)
  const [tareos, setTareos] = useState<TareoHidroculizado[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finalizando, setFinalizando] = useState(false)
  const [confirmarFinalizar, setConfirmarFinalizar] = useState(false)

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      colaborador_id: '',
      fecha: format(new Date(), 'yyyy-MM-dd'),
      n_jabas: undefined as any,
      observaciones: '',
    },
  })

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [l, t, cols] = await Promise.all([
        getLote(id),
        getTareoHidroculizadoPorLote(id),
        getColaboradores(),
      ])
      setLote(l)
      setTareos(t)
      setColaboradores(cols.filter((c) => c.estado === 'activo'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  const onAddTareo = async (data: FormData) => {
    if (!id || !user) return
    const nuevo = await createTareoHidroculizado(
      {
        lote_id: id,
        colaborador_id: data.colaborador_id,
        fecha: data.fecha,
        n_jabas: data.n_jabas,
        observaciones: data.observaciones || null,
      },
      user.id
    )
    setTareos((prev) => [...prev, nuevo])
    reset({ colaborador_id: '', fecha: format(new Date(), 'yyyy-MM-dd'), n_jabas: undefined as any, observaciones: '' })
  }

  const onDelete = async (tareoId: string) => {
    await deleteTareoHidroculizado(tareoId)
    setTareos((prev) => prev.filter((t) => t.id !== tareoId))
  }

  const onFinalizar = async () => {
    if (!id || !lote) return
    setFinalizando(true)
    try {
      await actualizarEstadoLote(id, 'en_despacho')
      navigate(`/lotes/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setFinalizando(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!lote) return null

  const totalJabas = tareos.reduce((acc, t) => acc + t.n_jabas, 0)
  const totalJabasExcedido = lote.num_cubetas > 0 && totalJabas > lote.num_cubetas

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={`Hidroculizado — ${lote.codigo}`}
        description="Tareo B: registro de operarios en el proceso de lavado y desinfección"
        backHref={`/lotes/${id}`}
      />

      {/* Resumen */}
      {tareos.length > 0 && (
        <Card className={`mb-4 ${totalJabasExcedido ? 'border-destructive' : ''}`}>
          <CardContent className="pt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{tareos.length} operario{tareos.length !== 1 ? 's' : ''} registrado{tareos.length !== 1 ? 's' : ''}</p>
            <div className="flex flex-col items-end gap-0.5">
              <p className={`font-semibold ${totalJabasExcedido ? 'text-destructive' : ''}`}>
                {totalJabas} / {lote.num_cubetas} jabas
              </p>
              {totalJabasExcedido && (
                <p className="text-xs text-destructive">Excede las {lote.num_cubetas} jabas del lote</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registros existentes */}
      {tareos.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Registros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {tareos.map((t) => (
              <div key={t.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">
                    {t.colaborador
                      ? `${t.colaborador.apellido}, ${t.colaborador.nombre}`
                      : t.colaborador_id}
                  </span>
                  <span className="text-muted-foreground ml-2">· {formatFecha(t.fecha)} · {t.n_jabas} jabas</span>
                  {t.observaciones && <p className="text-xs text-muted-foreground">{t.observaciones}</p>}
                </div>
                {lote.estado === 'clasificado' && (
                  <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => onDelete(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Formulario agregar */}
      {lote.estado === 'clasificado' && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Agregar operario</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onAddTareo)} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Operario" error={errors.colaborador_id?.message} required>
                  <Controller name="colaborador_id" control={control} rules={{ required: true }} render={({ field }) => (
                    <ColaboradorPicker
                      value={field.value}
                      onChange={field.onChange}
                      colaboradores={colaboradores}
                      placeholder="Buscar operario..."
                    />
                  )} />
                </FormField>
                <FormField label="Fecha" error={errors.fecha?.message} required>
                  <Input type="date" {...register('fecha', { required: true })} />
                </FormField>
                <FormField label="N° jabas" error={errors.n_jabas?.message} required>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="0"
                    {...register('n_jabas', { required: true, valueAsNumber: true, min: 1 })}
                  />
                </FormField>
                <FormField label="Observaciones">
                  <Textarea rows={1} {...register('observaciones')} />
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={isSubmitting}>Agregar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Finalizar */}
      {lote.estado === 'clasificado' && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(`/lotes/${id}`)}>Cancelar</Button>
          <Button
            disabled={tareos.length === 0 || finalizando}
            onClick={() => setConfirmarFinalizar(true)}
          >
            {finalizando ? 'Procesando...' : 'Confirmar hidroculizado → Despachar'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmarFinalizar}
        title="¿Confirmar hidroculizado?"
        description="Se marcará el proceso como completo y el lote avanzará a la etapa de despacho."
        confirmLabel="Sí, confirmar"
        variant="default"
        loading={finalizando}
        onConfirm={() => { setConfirmarFinalizar(false); onFinalizar() }}
        onCancel={() => setConfirmarFinalizar(false)}
      />
    </div>
  )
}
