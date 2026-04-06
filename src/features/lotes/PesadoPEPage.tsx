import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { getLote, actualizarEstadoLote } from '@/services/lotes.service'
import { getClasificacionesPorLote } from '@/services/clasificaciones.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPeso } from '@/utils/formatters'
import { PESO_CAJA_EXPORTACION_KG, PCT_DESHIDRATACION } from '@/utils/business-rules'
import { format } from 'date-fns'
import type { Lote, Clasificacion } from '@/types/models'

type PesadoPE = {
  fecha_pesado_pe: string
  peso_bruto_pe_kg: number
  n_jabas_pe: number
  tipo_jaba_pe: 'grande' | 'pequena'
}

const getPesadoPEKey = (loteId: string) => `pesado-pe-${loteId}`

export default function PesadoPEPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lote, setLote] = useState<Lote | null>(null)
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const existente: PesadoPE | null = (() => {
    if (!id) return null
    try {
      const raw = localStorage.getItem(getPesadoPEKey(id))
      return raw ? (JSON.parse(raw) as PesadoPE) : null
    } catch { return null }
  })()

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<PesadoPE>({
    defaultValues: existente ?? {
      fecha_pesado_pe: format(new Date(), 'yyyy-MM-dd'),
      peso_bruto_pe_kg: undefined as any,
      n_jabas_pe: undefined as any,
      tipo_jaba_pe: 'grande',
    },
  })

  const watchBruto = watch('peso_bruto_pe_kg')
  const watchJabas = watch('n_jabas_pe')
  const watchTipo = watch('tipo_jaba_pe')
  const taraJaba = watchTipo === 'grande' ? 1.80 : 1.25
  const taraPE = (watchJabas || 0) * taraJaba
  const pesoNetoPE = Math.max(0, (watchBruto || 0) - taraPE)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([getLote(id), getClasificacionesPorLote(id)])
      .then(([l, cls]) => { setLote(l); setClasificaciones(cls) })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [id])

  const onSubmit = async (data: PesadoPE) => {
    if (!id || !lote) return
    setGuardando(true)
    try {
      localStorage.setItem(getPesadoPEKey(id), JSON.stringify(data))
      if (lote.estado === 'clasificado') {
        await actualizarEstadoLote(id, 'pesado_pe')
      }
      navigate(`/lotes/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setGuardando(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />
  if (!lote) return null

  const totalesBuenos = clasificaciones.reduce((acc, c) => acc + c.peso_bueno_kg, 0)
  const cajasTeoricas = Math.floor(pesoNetoPE * (1 - PCT_DESHIDRATACION) / PESO_CAJA_EXPORTACION_KG)
  const pctDif = totalesBuenos > 0 && pesoNetoPE > 0
    ? Math.abs(pesoNetoPE - totalesBuenos) / totalesBuenos
    : 0
  const hayAlerta = pesoNetoPE > 0 && pctDif > 0.05

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Pesado PE — ${lote.codigo}`}
        description="Registra el pesado post-selección antes del despacho"
        backHref={`/lotes/${id}`}
      />

      {/* Resumen de clasificación */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Referencia — Clasificación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
              <p className="text-xs text-green-700 mb-0.5">Kg buenos</p>
              <p className="font-bold text-green-700">{formatPeso(totalesBuenos)}</p>
            </div>
            <div className="rounded-lg bg-muted/30 border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Neto ingreso</p>
              <p className="font-bold">{formatPeso(lote.peso_neto_kg)}</p>
            </div>
            <div className="rounded-lg bg-muted/30 border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">N° Jabas ingr.</p>
              <p className="font-bold">{lote.num_cubetas}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulario */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Datos del pesado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Fecha pesado" error={errors.fecha_pesado_pe?.message} required>
                <Input type="date" {...register('fecha_pesado_pe', { required: true })} />
              </FormField>
              <FormField label="Tipo de jaba" required>
                <Controller name="tipo_jaba_pe" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grande">Grande (tara 1.80 kg)</SelectItem>
                      <SelectItem value="pequena">Pequeña (tara 1.25 kg)</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </FormField>
              <FormField label="Peso bruto (kg)" error={errors.peso_bruto_pe_kg?.message} required>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...register('peso_bruto_pe_kg', { required: true, valueAsNumber: true, min: 0.01 })}
                />
              </FormField>
              <FormField label="N° jabas" error={errors.n_jabas_pe?.message} required>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  {...register('n_jabas_pe', { required: true, valueAsNumber: true, min: 1 })}
                />
              </FormField>
            </div>

            {/* Cálculo en vivo */}
            {watchBruto > 0 && watchJabas > 0 && (
              <div className="rounded-lg bg-muted/30 border p-3 text-sm grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Tara jabas</p>
                  <p className="font-medium">{formatPeso(taraPE)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peso neto PE</p>
                  <p className="font-semibold text-primary">{formatPeso(pesoNetoPE)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cajas teóricas</p>
                  <p className="font-medium">{cajasTeoricas}</p>
                </div>
              </div>
            )}

            {/* Alerta V-06: diferencia > 5% vs clasificación */}
            {hayAlerta && (
              <div className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-amber-800">
                ⚠️ Diferencia de <strong>{(pctDif * 100).toFixed(1)}%</strong> entre el peso PE ({formatPeso(pesoNetoPE)}) y la clasificación ({formatPeso(totalesBuenos)}). Revisar con Jefe de Planta.
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(`/lotes/${id}`)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Confirmar pesado PE'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
