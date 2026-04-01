import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { personalCampoSchema, type PersonalCampoFormData } from '@/utils/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/FormField'

type PersonalFormInput = z.input<typeof personalCampoSchema>

interface PersonalFormProps {
  defaultValues?: Partial<PersonalCampoFormData>
  onSubmit: (data: PersonalCampoFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}

export function PersonalForm({ defaultValues, onSubmit, onCancel, isEditing }: PersonalFormProps) {
  const normalizedDefaults: Partial<PersonalFormInput> = {
    estado: 'activo',
    tipo: 'clasificador',
    fecha_alta: new Date().toISOString().slice(0, 10),
    ...defaultValues,
    dni: defaultValues?.dni ?? '',
    telefono: defaultValues?.telefono ?? '',
    numero_cuenta: defaultValues?.numero_cuenta ?? '',
    fecha_alta: defaultValues?.fecha_alta ?? new Date().toISOString().slice(0, 10),
  }

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<PersonalFormInput>({
    resolver: zodResolver(personalCampoSchema) as any,
    defaultValues: normalizedDefaults,
  })

  const handleValidSubmit = async (data: PersonalFormInput) => {
    await onSubmit(personalCampoSchema.parse(data) as PersonalCampoFormData)
  }

  return (
    <form onSubmit={handleSubmit(handleValidSubmit as any)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Código" error={errors.codigo?.message} required>
          <Input placeholder="PER-001" {...register('codigo')} />
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
        <FormField label="Nombre" error={errors.nombre?.message} required>
          <Input placeholder="Juan" {...register('nombre')} />
        </FormField>
        <FormField label="Apellido" error={errors.apellido?.message} required>
          <Input placeholder="Flores" {...register('apellido')} />
        </FormField>
        <FormField label="DNI" error={errors.dni?.message}>
          <Input placeholder="12345678" maxLength={8} {...register('dni')} />
        </FormField>
        <FormField label="Teléfono" error={errors.telefono?.message}>
          <Input placeholder="987 654 321" {...register('telefono')} />
        </FormField>
        <FormField label="N° cuenta" error={errors.numero_cuenta?.message}>
          <Input placeholder="0011-0234-0001234567" {...register('numero_cuenta')} />
        </FormField>
        <FormField label="Fecha de alta" error={errors.fecha_alta?.message} required>
          <Input type="date" {...register('fecha_alta')} />
        </FormField>
        <FormField label="Tipo" error={errors.tipo?.message} required>
          <Controller name="tipo" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clasificador">Clasificador</SelectItem>
                <SelectItem value="cosechador">Cosechador</SelectItem>
                <SelectItem value="empacador">Empacador</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
              </SelectContent>
            </Select>
          )} />
        </FormField>
        <FormField label="Tarifa destajo (S/. / unidad)" error={errors.tarifa_destajo?.message} required>
          <Input type="number" step="0.01" min="0" placeholder="0.00" {...register('tarifa_destajo', { valueAsNumber: true })} />
        </FormField>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting}>{isEditing ? 'Guardar cambios' : 'Registrar personal'}</Button>
      </div>
    </form>
  )
}
