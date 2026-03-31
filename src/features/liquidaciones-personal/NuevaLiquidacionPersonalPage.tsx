import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createLiquidacionPersonal } from '@/services/liquidaciones-personal.service'
import { getActividadesPorPersonal } from '@/services/actividades-personal.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePersonal } from '@/features/personal/hooks/usePersonal'
import { useAuthStore } from '@/store/auth.store'
import { generarCodigoLiquidacionPersonal, formatMoneda, formatFecha } from '@/utils/formatters'
import { calcularTotalActividades } from '@/utils/business-rules'
import type { ActividadPersonal } from '@/types/models'

const nuevaLiqPersonalSchema = z.object({
  codigo:       z.string().min(1),
  personal_id:  z.string().uuid('Seleccione personal'),
  quincena:     z.string().min(1, 'Ingrese la quincena'),
  observaciones: z.string().optional(),
})

type FormData = z.infer<typeof nuevaLiqPersonalSchema>

export default function NuevaLiquidacionPersonalPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { personal } = usePersonal()
  const [actividades, setActividades] = useState<ActividadPersonal[]>([])
  const [actividadesSeleccionadas, setActividadesSeleccionadas] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(false)

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(nuevaLiqPersonalSchema),
    defaultValues: { codigo: generarCodigoLiquidacionPersonal() },
  })

  const personalId = watch('personal_id')
  const personalActivo = personal.filter((p) => p.estado === 'activo')

  useEffect(() => {
    if (!personalId) return
    setCargando(true)
    getActividadesPorPersonal(personalId)
      .then(setActividades)
      .finally(() => setCargando(false))
    setActividadesSeleccionadas(new Set())
  }, [personalId])

  const toggleActividad = (id: string) => {
    setActividadesSeleccionadas((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const actividadesElegidas = actividades.filter((a) => actividadesSeleccionadas.has(a.id))
  const { total_unidades, total_monto } = calcularTotalActividades(actividadesElegidas)

  const onSubmit = async (data: FormData) => {
    if (!user || actividadesElegidas.length === 0) return
    const liq = await createLiquidacionPersonal(
      {
        codigo: data.codigo,
        personal_id: data.personal_id,
        quincena: data.quincena,
        total_unidades,
        total_monto,
        estado: 'borrador',
        observaciones: data.observaciones ?? null,
      },
      user.id
    )
    navigate(`/liquidaciones/personal/${liq.id}`)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Nueva liquidación – Personal" backHref="/liquidaciones/personal" />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Datos generales</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Código" required>
              <Input {...register('codigo')} />
            </FormField>
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
            <FormField label="Quincena" error={errors.quincena?.message} required hint='Ej: "2026-Q1-01" = 1ra quincena de 2026'>
              <Input placeholder="2026-Q1-01" {...register('quincena')} />
            </FormField>
            <FormField label="Observaciones" className="sm:col-span-2">
              <Textarea rows={2} {...register('observaciones')} />
            </FormField>
          </CardContent>
        </Card>

        {/* Actividades del personal */}
        {personalId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actividades disponibles</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {cargando ? (
                <p className="text-sm text-muted-foreground">Cargando actividades...</p>
              ) : actividades.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay actividades registradas para este personal.</p>
              ) : actividades.map((a) => (
                <label key={a.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm ${actividadesSeleccionadas.has(a.id) ? 'bg-muted ring-1 ring-agro-green' : ''}`}>
                  <Checkbox
                    checked={actividadesSeleccionadas.has(a.id)}
                    onCheckedChange={() => toggleActividad(a.id)}
                  />
                  <div className="flex-1">
                    <p className="capitalize">{a.tipo_actividad.replace(/_/g, ' ')} · {formatFecha(a.fecha)}</p>
                    <p className="text-xs text-muted-foreground">{a.cantidad_unidades} uds × S/.{a.tarifa_unitaria}</p>
                  </div>
                  <span className="font-medium">{formatMoneda(a.total)}</span>
                </label>
              ))}

              {actividadesElegidas.length > 0 && (
                <div className="flex justify-between items-center pt-2 border-t text-sm font-medium">
                  <span>{actividadesElegidas.length} actividades · {total_unidades} unidades</span>
                  <span>Total: {formatMoneda(total_monto)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting} disabled={actividadesElegidas.length === 0}>
            Crear liquidación
          </Button>
        </div>
      </form>
    </div>
  )
}
