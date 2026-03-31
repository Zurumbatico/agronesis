import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productoSchema, type ProductoFormData } from '@/utils/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/FormField'

interface ProductoFormProps {
  defaultValues?: Partial<ProductoFormData>
  onSubmit: (data: ProductoFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}

export function ProductoForm({ defaultValues, onSubmit, onCancel, isEditing }: ProductoFormProps) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ProductoFormData>({
    resolver: zodResolver(productoSchema),
    defaultValues: { estado: 'activo', unidad_medida: 'kg', tipo: 'holantao', ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Código" error={errors.codigo?.message} required>
          <Input placeholder="PROD-001" {...register('codigo')} />
        </FormField>

        <FormField label="Estado" error={errors.estado?.message} required>
          <Controller name="estado" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Nombre" error={errors.nombre?.message} required className="sm:col-span-2">
          <Input placeholder="Nombre del producto" {...register('nombre')} />
        </FormField>

        <FormField label="Tipo" error={errors.tipo?.message} required>
          <Controller name="tipo" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="holantao">Holantao</SelectItem>
                <SelectItem value="snow_peas">Snow Peas</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Unidad de medida" error={errors.unidad_medida?.message} required>
          <Controller name="unidad_medida" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                <SelectItem value="caja">Caja</SelectItem>
                <SelectItem value="cubeta">Cubeta</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </FormField>

        <FormField label="Precio base (S/. / kg)" error={errors.precio_base_kg?.message} required className="sm:col-span-2">
          <Input type="number" step="0.01" min="0" placeholder="0.00" {...register('precio_base_kg', { valueAsNumber: true })} />
        </FormField>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting}>{isEditing ? 'Guardar cambios' : 'Registrar producto'}</Button>
      </div>
    </form>
  )
}
