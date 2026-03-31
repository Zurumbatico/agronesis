import { useEffect, useMemo } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { agricultorSchema, type AgricultorFormData } from '@/utils/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/FormField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProductos } from '@/features/productos/hooks/useProductos'
import { Plus, Trash2 } from 'lucide-react'

type AgricultorFormInput = z.input<typeof agricultorSchema>

interface AgricultorFormProps {
  defaultValues?: Partial<AgricultorFormData>
  onSubmit: (data: AgricultorFormData) => Promise<void>
  onCancel: () => void
  isEditing?: boolean
}

export function AgricultorForm({ defaultValues, onSubmit, onCancel, isEditing }: AgricultorFormProps) {
  const { productos, loading: productosLoading } = useProductos()
  const productosActivos = productos.filter((producto) => producto.estado === 'activo')
  const normalizedDefaults = useMemo<Partial<AgricultorFormInput>>(() => ({
    estado: 'activo',
    codigo: defaultValues?.codigo ?? 'AUTO',
    ...defaultValues,
    dni: defaultValues?.dni ?? '',
    telefono: defaultValues?.telefono ?? '',
    ubicacion: defaultValues?.ubicacion ?? '',
    hectareas: defaultValues?.hectareas ?? [],
  }), [defaultValues])

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AgricultorFormInput>({
    resolver: zodResolver(agricultorSchema) as any,
    defaultValues: normalizedDefaults,
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'hectareas',
  })

  const hectareasRows = watch('hectareas') ?? []

  useEffect(() => {
    reset(normalizedDefaults)
  }, [normalizedDefaults, reset])

  const handleValidSubmit = async (data: AgricultorFormInput) => {
    await onSubmit(agricultorSchema.parse(data) as AgricultorFormData)
  }

  return (
    <form onSubmit={handleSubmit(handleValidSubmit as any)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Código" error={errors.codigo?.message} required>
          {isEditing ? (
            <>
              <Input
                value={defaultValues?.codigo ?? ''}
                disabled
                placeholder="AGRI-000001"
                className="cursor-not-allowed border-dashed bg-muted text-muted-foreground disabled:opacity-100"
              />
              <Input type="hidden" {...register('codigo')} />
            </>
          ) : (
            <>
              <Input
                readOnly
                aria-disabled="true"
                value=""
                placeholder="Se asigna automáticamente al guardar"
                className="cursor-not-allowed border-dashed bg-muted text-muted-foreground placeholder:text-muted-foreground/90"
              />
              <Input type="hidden" {...register('codigo')} />
            </>
          )}
        </FormField>

        <FormField label="Estado" error={errors.estado?.message} required>
          <Controller
            name="estado"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField label="Nombre" error={errors.nombre?.message} required>
          <Input placeholder="Juan" {...register('nombre')} />
        </FormField>

        <FormField label="Apellido" error={errors.apellido?.message} required>
          <Input placeholder="Quispe" {...register('apellido')} />
        </FormField>

        <FormField label="DNI" error={errors.dni?.message}>
          <Input placeholder="12345678" maxLength={8} {...register('dni')} />
        </FormField>

        <FormField label="Teléfono" error={errors.telefono?.message}>
          <Input placeholder="987 654 321" {...register('telefono')} />
        </FormField>

      </div>

      <FormField label="Ubicación" error={errors.ubicacion?.message}>
        <Textarea placeholder="Sector, dirección o referencia..." rows={2} {...register('ubicacion')} />
      </FormField>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Hectáreas</CardTitle>
              <CardDescription>Registra cuántas hectáreas trabaja este agricultor por producto.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ producto_id: '', hectareas: 1 })}
              disabled={productosLoading || productosActivos.length === 0}
            >
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
              {productosLoading ? 'Cargando productos...' : 'Sin registros de hectáreas. Agrega solo los productos que realmente maneja este agricultor.'}
            </div>
          ) : (
            fields.map((field, index) => {
              const productoSeleccionado = hectareasRows[index]?.producto_id
              const productosDisponibles = productosActivos.filter((producto) => (
                producto.id === productoSeleccionado ||
                !hectareasRows.some((row, rowIndex) => rowIndex !== index && row.producto_id === producto.id)
              ))

              return (
                <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)_auto] sm:items-end">
                  <FormField label="Producto" error={errors.hectareas?.[index]?.producto_id?.message} required>
                    <Controller
                      name={`hectareas.${index}.producto_id`}
                      control={control}
                      render={({ field: productoField }) => (
                        <Select onValueChange={productoField.onChange} value={productoField.value ?? ''}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar producto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {productosDisponibles.map((producto) => (
                              <SelectItem key={producto.id} value={producto.id}>
                                {producto.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>

                  <FormField label="Hectáreas" error={errors.hectareas?.[index]?.hectareas?.message} required>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...register(`hectareas.${index}.hectareas`, { valueAsNumber: true })}
                    />
                  </FormField>

                  <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEditing ? 'Guardar cambios' : 'Registrar agricultor'}
        </Button>
      </div>
    </form>
  )
}
