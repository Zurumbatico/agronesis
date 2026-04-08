import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getConfigPrecios, createConfigPrecio, updateConfigPrecio, deleteConfigPrecio } from '@/services/config-precios.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormField } from '@/components/shared/FormField'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthStore } from '@/store/auth.store'
import { VARIEDAD_PRODUCTO_CONFIG, CALIDAD_PRODUCTO_CONFIG } from '@/constants'
import { Plus, Settings, Pencil, Trash2 } from 'lucide-react'
import { getISOWeek, getYear } from 'date-fns'
import type { ConfigPrecio } from '@/types/models'

const configPrecioSchema = z.object({
  semana: z.number({ message: 'Ingrese un número' }).int().min(1).max(53),
  anio: z.number({ message: 'Ingrese un número' }).int().min(2024),
  variedad: z.enum(['snow_peas', 'sugar']),
  categoria: z.enum(['cat1', 'cat2']),
  precio_kg_sol: z.number({ message: 'Ingrese un número' }).nonnegative().max(9999),
})

type FormData = z.infer<typeof configPrecioSchema>

export default function ConfigPreciosPage() {
  const { user } = useAuthStore()
  const [precios, setPrecios] = useState<ConfigPrecio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<ConfigPrecio | null>(null)
  const [precioAEliminar, setPrecioAEliminar] = useState<ConfigPrecio | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const semanaActual = getISOWeek(new Date())
  const anioActual = getYear(new Date())

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(configPrecioSchema),
    defaultValues: { semana: semanaActual, anio: anioActual, variedad: 'snow_peas', categoria: 'cat1', precio_kg_sol: undefined },
  })

  const cargar = async () => {
    setLoading(true); setError(null)
    try { setPrecios(await getConfigPrecios()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const abrirNuevo = () => {
    setEditando(null)
    reset({ semana: semanaActual, anio: anioActual, variedad: 'snow_peas', categoria: 'cat1', precio_kg_sol: undefined })
    setDialogOpen(true)
  }

  const abrirEditar = (p: ConfigPrecio) => {
    setEditando(p)
    reset({ semana: p.semana, anio: p.anio, variedad: p.variedad, categoria: p.categoria, precio_kg_sol: p.precio_kg_sol })
    setDialogOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    if (!user) return
    try {
      if (editando) {
        const updated = await updateConfigPrecio(editando.id, data)
        setPrecios((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      } else {
        const nuevo = await createConfigPrecio(data, user.id)
        setPrecios((prev) => [nuevo, ...prev])
      }
      setDialogOpen(false)
    } catch (e) {
      setFormError((e as Error).message)
    }
  }

  const eliminar = async (p: ConfigPrecio) => {
    try {
      await deleteConfigPrecio(p.id)
      setPrecios((prev) => prev.filter((x) => x.id !== p.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />

  // Agrupar por año para mostrar separadores
  const preciosPorAnio = precios.reduce<Record<number, ConfigPrecio[]>>((acc, p) => {
    if (!acc[p.anio]) acc[p.anio] = []
    acc[p.anio].push(p)
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Configuración de Precios"
        description="Precio S/./kg por semana, variedad y categoría. Se usa como referencia para liquidaciones."
        actions={
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo precio
          </Button>
        }
      />

      {precios.length === 0 ? (
        <EmptyState
          icon={<Settings className="h-8 w-8" />}
          title="Sin configuración de precios"
          description="Agrega el precio S/./kg para la semana actual antes de crear liquidaciones."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {Object.keys(preciosPorAnio)
            .map(Number)
            .sort((a, b) => b - a)
            .map((anio) => (
              <div key={anio}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Año {anio}</p>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Semana</TableHead>
                          <TableHead>Variedad</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Precio S/./kg</TableHead>
                          <TableHead className="w-20" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preciosPorAnio[anio]
                          .sort((a, b) => b.semana - a.semana)
                          .map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">Sem. {p.semana}</TableCell>
                              <TableCell>{VARIEDAD_PRODUCTO_CONFIG[p.variedad].label}</TableCell>
                              <TableCell>{CALIDAD_PRODUTO_CONFIG_SAFE(p.categoria)}</TableCell>
                              <TableCell className="text-right font-semibold">S/. {Number(p.precio_kg_sol).toFixed(4)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 justify-end">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditar(p)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setPrecioAEliminar(p)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            ))}
        </div>
      )}

      <ConfirmDialog
        open={!!precioAEliminar}
        title="¿Eliminar precio?"
        description={precioAEliminar ? `Sem ${precioAEliminar.semana}/${precioAEliminar.anio} — ${VARIEDAD_PRODUCTO_CONFIG[precioAEliminar.variedad].label} ${CALIDAD_PRODUCTO_CONFIG[precioAEliminar.categoria].label}` : ''}
        confirmLabel="Eliminar"
        onConfirm={() => { eliminar(precioAEliminar!); setPrecioAEliminar(null) }}
        onCancel={() => setPrecioAEliminar(null)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar precio' : 'Nuevo precio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
            {formError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{formError}</p>}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Año" error={errors.anio?.message} required>
                <Input type="number" min="2024" {...register('anio', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Semana (1–53)" error={errors.semana?.message} required>
                <Input type="number" min="1" max="53" {...register('semana', { valueAsNumber: true })} />
              </FormField>
            </div>

            <FormField label="Variedad" error={errors.variedad?.message} required>
              <Controller name="variedad" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="snow_peas">Snow Peas</SelectItem>
                    <SelectItem value="sugar">Sugar Snap</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </FormField>

            <FormField label="Categoría" error={errors.categoria?.message} required>
              <Controller name="categoria" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cat1">CAT 1</SelectItem>
                    <SelectItem value="cat2">CAT 2</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </FormField>

            <FormField label="Precio S/./kg" error={errors.precio_kg_sol?.message} required>
              <Input
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0000"
                {...register('precio_kg_sol', { valueAsNumber: true })}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={isSubmitting}>{editando ? 'Guardar' : 'Crear'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CALIDAD_PRODUTO_CONFIG_SAFE(cat: string): string {
  return CALIDAD_PRODUCTO_CONFIG[cat as keyof typeof CALIDAD_PRODUCTO_CONFIG]?.label ?? cat
}
