import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { loteSchema, type LoteFormData } from '@/utils/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/FormField'
import { generarCodigoLote } from '@/utils/formatters'
import { useAgricultores } from '@/features/agricultores/hooks/useAgricultores'
import { useProductos } from '@/features/productos/hooks/useProductos'
import { useCentrosAcopio } from '@/features/centros-acopio/hooks/useCentrosAcopio'
import { format } from 'date-fns'

type LoteFormInput = z.input<typeof loteSchema>

interface LoteFormProps {
  defaultValues?: Partial<LoteFormData>
  onSubmit: (data: LoteFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}

export function LoteForm({ defaultValues, onSubmit, onCancel, isEditing }: LoteFormProps) {
  const { agricultores } = useAgricultores()
  const { productos } = useProductos()
  const { centros } = useCentrosAcopio()

  const normalizedDefaults: Partial<LoteFormInput> = {
      codigo: generarCodigoLote(),
      fecha_ingreso: format(new Date(), 'yyyy-MM-dd'),
      num_cubetas: 0,
      ...defaultValues,
      observaciones: defaultValues?.observaciones ?? '',
    }

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<LoteFormInput>({
    resolver: zodResolver(loteSchema) as any,
    defaultValues: normalizedDefaults,
  })

  const agricultoresActivos = agricultores.filter((a) => a.estado === 'activo')
  const productosActivos = productos.filter((p) => p.estado === 'activo')
  const centrosActivos = centros.filter((c) => c.estado === 'activo')

  const handleValidSubmit = async (data: LoteFormInput) => {
    await onSubmit(loteSchema.parse(data) as LoteFormData)
  }

  return (
    <form onSubmit={handleSubmit(handleValidSubmit as any)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Código de lote" error={errors.codigo?.message} required>
          <Input {...register('codigo')} />
        </FormField>

        <FormField label="Fecha de ingreso" error={errors.fecha_ingreso?.message} required>
          <Input type="date" {...register('fecha_ingreso')} />
        </FormField>

        <FormField label="Agricultor" error={errors.agricultor_id?.message} required className="sm:col-span-2">
          <Controller name="agricultor_id" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue placeholder="Seleccionar agricultor..." /></SelectTrigger>
              <SelectContent>
                {agricultoresActivos.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.apellido}, {a.nombre} ({a.codigo})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Producto" error={errors.producto_id?.message} required>
          <Controller name="producto_id" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
              <SelectContent>
                {productosActivos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Centro de acopio" error={errors.centro_acopio_id?.message} required>
          <Controller name="centro_acopio_id" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue placeholder="Seleccionar centro..." /></SelectTrigger>
              <SelectContent>
                {centrosActivos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Peso bruto (kg)" error={errors.peso_bruto_kg?.message} required>
          <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...register('peso_bruto_kg', { valueAsNumber: true })} />
        </FormField>

        <FormField label="N° cubetas" error={errors.num_cubetas?.message} required>
          <Input type="number" min="0" step="1" placeholder="0" {...register('num_cubetas', { valueAsNumber: true })} />
        </FormField>
      </div>

      <FormField label="Observaciones" error={errors.observaciones?.message}>
        <Textarea placeholder="Notas del lote..." rows={2} {...register('observaciones')} />
      </FormField>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting}>{isEditing ? 'Guardar cambios' : 'Registrar lote'}</Button>
      </div>
    </form>
  )
}
