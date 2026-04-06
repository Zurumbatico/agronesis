import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createLiquidacionAgri } from '@/services/liquidaciones-agri.service'
import { getClasificacionesPorLote } from '@/services/clasificaciones.service'
import { getConfigPrecios } from '@/services/config-precios.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAgricultores } from '@/features/agricultores/hooks/useAgricultores'
import { useLotes } from '@/features/lotes/hooks/useLotes'
import { useAuthStore } from '@/store/auth.store'
import { generarCodigoLiquidacionAgri } from '@/utils/formatters'
import { calcularTotalesClasificacion, calcularTotalLiquidacionAgri, calcularPesoAgricultor } from '@/utils/business-rules'
import { format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import type { Clasificacion, ConfigPrecio } from '@/types/models'

const detalleSchema = z.object({
  lote_id:             z.string().uuid(),
  categoria:           z.string(),
  peso_kg:             z.number().positive(),
  precio_kg:           z.number().positive(),
  subtotal:            z.number(),
})

const nuevaLiqSchema = z.object({
  codigo:              z.string().min(1),
  agricultor_id:       z.string().uuid('Seleccione un agricultor'),
  fecha_inicio:        z.string().min(1),
  fecha_fin:           z.string().min(1),
  detalles:            z.array(detalleSchema).min(1, 'Agregue al menos un detalle'),
  observaciones:       z.string().optional(),
})

type NuevaLiqFormData = z.infer<typeof nuevaLiqSchema>

export default function NuevaLiquidacionAgriPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { agricultores } = useAgricultores()
  const { lotes } = useLotes()
  const [clasificacionesPorLote, setClasificacionesPorLote] = useState<Record<string, Clasificacion[]>>({})
  const [cargandoClasif, setCargandoClasif] = useState(false)
  const [configPrecios, setConfigPrecios] = useState<ConfigPrecio[]>([])

  useEffect(() => {
    getConfigPrecios().then(setConfigPrecios).catch(() => {/* no bloquear si falla */})
  }, [])

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<NuevaLiqFormData>({
    resolver: zodResolver(nuevaLiqSchema),
    defaultValues: {
      codigo: generarCodigoLiquidacionAgri(),
      fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
      fecha_fin: format(new Date(), 'yyyy-MM-dd'),
      detalles: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'detalles' })
  const agricultorId = watch('agricultor_id')

  const agricultoresActivos = agricultores.filter((a) => a.estado === 'activo')
  // Solo lotes en estado 'despachado' pueden liquidarse (ya salieron del establecimiento)
  const lotesDelAgricultor = agricultorId
    ? lotes.filter((l) => l.agricultor_id === agricultorId && l.estado === 'despachado')
    : []

  const cargarClasificaciones = async () => {
    if (lotesDelAgricultor.length === 0) return
    setCargandoClasif(true)
    try {
      const results = await Promise.all(lotesDelAgricultor.map(async (l) => {
        const cls = await getClasificacionesPorLote(l.id)
        return { loteId: l.id, cls }
      }))
      const mapa: Record<string, Clasificacion[]> = {}
      results.forEach(({ loteId, cls }) => { mapa[loteId] = cls })
      setClasificacionesPorLote(mapa)
    } finally { setCargandoClasif(false) }
  }

  useEffect(() => {
    if (agricultorId) {
      setValue('detalles', [])
      cargarClasificaciones()
    }
  }, [agricultorId])

  const agregarDetalleLote = (loteId: string) => {
    const cls = clasificacionesPorLote[loteId] ?? []
    const totales = calcularTotalesClasificacion(cls)
    const lote = lotes.find((l) => l.id === loteId)

    // Calcular semana/año ISO del lote para buscar precio configurado
    const fechaLote = lote?.fecha_ingreso ? parseISO(lote.fecha_ingreso) : null
    const semanaLote = fechaLote ? getISOWeek(fechaLote) : null
    const anioLote = fechaLote ? getISOWeekYear(fechaLote) : null
    const variedadLote = lote?.producto?.variedad ?? null
    const categoriaLote = lote?.producto?.calidad ?? null

    const precioConf = (semanaLote && anioLote && variedadLote && categoriaLote)
      ? configPrecios.find(
          (c) => c.semana === semanaLote && c.anio === anioLote && c.variedad === variedadLote && c.categoria === categoriaLote
        )
      : undefined

    const categorias = Object.entries(totales) as [string, { peso_kg: number; num_cajas: number }][]
    categorias.forEach(([cat, { peso_kg }]) => {
      if (peso_kg > 0) {
        // Aplicar 97%: descontar el 3% de Alan Melendrez (Módulo 1 PDF)
        const pesoAgricultor = calcularPesoAgricultor(peso_kg)
        const precioKg = precioConf?.precio_kg_sol ?? 0
        append({ lote_id: loteId, categoria: cat, peso_kg: pesoAgricultor, precio_kg: precioKg, subtotal: 0 })
      }
    })
  }

  const onSubmit = async (data: NuevaLiqFormData) => {
    if (!user) return
    // Recalcular subtotales
    const detalles = data.detalles.map((d) => ({ ...d, subtotal: d.peso_kg * d.precio_kg }))
    const { total_kg, total_monto } = calcularTotalLiquidacionAgri(detalles)
    const liq = await createLiquidacionAgri(
      { codigo: data.codigo, agricultor_id: data.agricultor_id, fecha_inicio: data.fecha_inicio, fecha_fin: data.fecha_fin, total_kg, total_monto, estado: 'borrador', observaciones: data.observaciones ?? null },
      detalles as any,
      user.id
    )
    navigate(`/liquidaciones/agricultores/${liq.id}`)
  }

  const totalEstimado = fields.reduce((acc, _field, i) => {
    const precio = watch(`detalles.${i}.precio_kg`) ?? 0
    const peso = watch(`detalles.${i}.peso_kg`) ?? 0
    return acc + (precio * peso)
  }, 0)

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Nueva liquidación – Agricultor" backHref="/liquidaciones/agricultores" />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Datos generales</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Código" required>
              <Input {...register('codigo')} />
            </FormField>
            <FormField label="Agricultor" error={errors.agricultor_id?.message} required>
              <Controller name="agricultor_id" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {agricultoresActivos.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.apellido}, {a.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </FormField>
            <FormField label="Fecha inicio" error={errors.fecha_inicio?.message} required>
              <Input type="date" {...register('fecha_inicio')} />
            </FormField>
            <FormField label="Fecha fin" error={errors.fecha_fin?.message} required>
              <Input type="date" {...register('fecha_fin')} />
            </FormField>
            <FormField label="Observaciones" className="sm:col-span-2">
              <Textarea rows={2} {...register('observaciones')} />
            </FormField>
          </CardContent>
        </Card>

        {/* Lotes disponibles */}
        {agricultorId && lotesDelAgricultor.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Lotes disponibles</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {cargandoClasif ? <p className="text-sm text-muted-foreground">Cargando clasificaciones...</p> :
                lotesDelAgricultor.map((l) => (
                  <Button key={l.id} type="button" variant="outline" size="sm" onClick={() => agregarDetalleLote(l.id)}>
                    {l.codigo}
                  </Button>
                ))
              }
            </CardContent>
          </Card>
        )}

        {/* Detalles */}
        {fields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalles</CardTitle>
              <p className="text-xs text-muted-foreground">El peso ya incluye el descuento del 3% (Alan Melendrez). El precio se pre-carga desde la tabla de configuración si existe para la semana del lote.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {fields.map((field, index) => {
                const lote = lotes.find((l) => l.id === field.lote_id)
                return (
                  <div key={field.id} className="grid grid-cols-3 gap-2 items-end border-b pb-3 last:border-0">
                    <div className="col-span-3 text-xs text-muted-foreground font-medium">
                      Lote: {lote?.codigo ?? field.lote_id} · Categoría: <span className="capitalize">{field.categoria}</span>
                    </div>
                    <FormField label="Peso (kg)">
                      <Input type="number" step="0.01" {...register(`detalles.${index}.peso_kg`, { valueAsNumber: true })} />
                    </FormField>
                    <FormField label="Precio (S/./kg)">
                      <Input type="number" step="0.01" placeholder="0.00" {...register(`detalles.${index}.precio_kg`, { valueAsNumber: true })} />
                    </FormField>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => remove(index)}>
                      Quitar
                    </Button>
                  </div>
                )
              })}
              <p className="text-sm text-right font-medium">Total estimado: <strong>S/. {totalEstimado.toFixed(2)}</strong></p>
              {errors.detalles && <p className="text-sm text-destructive">{(errors.detalles as any).message}</p>}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>Crear liquidación</Button>
        </div>
      </form>
    </div>
  )
}
