import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getConfigPrecios,
  createConfigPrecio,
  updateConfigPrecio,
  deleteConfigPrecio,
  getConfigSistemaPorClave,
  upsertConfigSistemaNumerico,
  CLAVE_PESO_CAJA_EXPORTACION,
  CLAVE_PESO_CAJA_DESPACHO,
  CLAVE_PAGO_RECEPCION_KG,
} from '@/services/config-precios.service'
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
import { DEFAULT_PAGO_RECEPCION_KG, DEFAULT_PESO_CAJA_DESPACHO_KG, DEFAULT_PESO_CAJA_EXPORTACION_KG } from '@/utils/business-rules'
import { Plus, Settings, Pencil, Trash2 } from 'lucide-react'
import { endOfISOWeek, format, getISOWeek, getYear, setISOWeek, setISOWeekYear, startOfISOWeek } from 'date-fns'
import type { ConfigPrecio } from '@/types/models'

const configPrecioSchema = z.object({
  semana: z.number({ message: 'Ingrese un número' }).int().min(1).max(53),
  anio: z.number({ message: 'Ingrese un número' }).int().min(2024),
  variedad: z.enum(['snow_peas', 'sugar']),
  categoria: z.enum(['cat1', 'cat2']),
  precio_kg_sol: z.number({ message: 'Ingrese un número' }).nonnegative().max(9999),
})

type FormData = z.infer<typeof configPrecioSchema>

const parametroCajaSchema = z.object({
  peso_caja_exportacion_kg: z.number({ message: 'Ingrese un número' }).positive().max(100),
  peso_caja_despacho_kg: z.number({ message: 'Ingrese un número' }).positive().max(100),
  pago_recepcion_kg: z.number({ message: 'Ingrese un número' }).nonnegative().max(100),
})

type ParametroCajaFormData = z.infer<typeof parametroCajaSchema>
type ParametroKey = keyof ParametroCajaFormData

const PARAMETRO_CAJA_CONFIG: Record<ParametroKey, {
  clave: string
  nombre: string
  descripcion: string
  label: string
  helper: string
  min: number
  step: string
  placeholder: string
}> = {
  peso_caja_exportacion_kg: {
    clave: CLAVE_PESO_CAJA_EXPORTACION,
    nombre: 'Peso por caja de exportación',
    descripcion: 'Peso objetivo en kg usado para convertir kg buenos clasificados a cajas exportables.',
    label: 'Peso por caja (kg)',
    helper: 'Afecta cálculo de cajas exportables.',
    min: 0.01,
    step: '0.01',
    placeholder: '4.65',
  },
  peso_caja_despacho_kg: {
    clave: CLAVE_PESO_CAJA_DESPACHO,
    nombre: 'Peso por caja de despacho',
    descripcion: 'Peso en kg por caja usado para calcular el peso neto total de los despachos.',
    label: 'Peso caja despacho (kg)',
    helper: 'Afecta cálculo del peso neto en despacho.',
    min: 0.01,
    step: '0.01',
    placeholder: '4.50',
  },
  pago_recepcion_kg: {
    clave: CLAVE_PAGO_RECEPCION_KG,
    nombre: 'Pago recepción por kg bruto',
    descripcion: 'Tarifa por kg bruto recepcionado usada en la planilla quincenal.',
    label: 'Pago recepción (S/./kg)',
    helper: 'Tarifa usada para planilla de recepción.',
    min: 0,
    step: '0.01',
    placeholder: '0.02',
  },
}

export default function ConfigPreciosPage() {
  const { user } = useAuthStore()
  const [precios, setPrecios] = useState<ConfigPrecio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<ConfigPrecio | null>(null)
  const [precioAEliminar, setPrecioAEliminar] = useState<ConfigPrecio | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [parametroError, setParametroError] = useState<string | null>(null)
  const [parametroSuccess, setParametroSuccess] = useState<string | null>(null)
  const [guardandoParametro, setGuardandoParametro] = useState<ParametroKey | null>(null)
  const [parametros, setParametros] = useState<ParametroCajaFormData>({
    peso_caja_exportacion_kg: DEFAULT_PESO_CAJA_EXPORTACION_KG,
    peso_caja_despacho_kg: DEFAULT_PESO_CAJA_DESPACHO_KG,
    pago_recepcion_kg: DEFAULT_PAGO_RECEPCION_KG,
  })
  const [parametroFieldErrors, setParametroFieldErrors] = useState<Partial<Record<ParametroKey, string>>>({})
  const [parametroPendienteConfirmacion, setParametroPendienteConfirmacion] = useState<ParametroKey | null>(null)
  const [precioPendienteConfirmacion, setPrecioPendienteConfirmacion] = useState<FormData | null>(null)
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)

  const semanaActual = getISOWeek(new Date())
  const anioActual = getYear(new Date())

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(configPrecioSchema),
    defaultValues: { semana: semanaActual, anio: anioActual, variedad: 'snow_peas', categoria: 'cat1', precio_kg_sol: undefined },
  })

  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const [preciosDb, pesoCajaConfig] = await Promise.all([
        getConfigPrecios(),
        Promise.all([
          getConfigSistemaPorClave(CLAVE_PESO_CAJA_EXPORTACION),
          getConfigSistemaPorClave(CLAVE_PESO_CAJA_DESPACHO),
          getConfigSistemaPorClave(CLAVE_PAGO_RECEPCION_KG),
        ]),
      ])
      setPrecios(preciosDb)
        setParametros({
        peso_caja_exportacion_kg: Number(pesoCajaConfig[0]?.valor_numerico ?? DEFAULT_PESO_CAJA_EXPORTACION_KG),
        peso_caja_despacho_kg: Number(pesoCajaConfig[1]?.valor_numerico ?? DEFAULT_PESO_CAJA_DESPACHO_KG),
        pago_recepcion_kg: Number(pesoCajaConfig[2]?.valor_numerico ?? DEFAULT_PAGO_RECEPCION_KG),
      })
    }
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

  const onSubmit = (data: FormData) => {
    setFormError(null)
    setPrecioPendienteConfirmacion(data)
  }

  const confirmarGuardadoPrecio = async () => {
    if (!user) return
    if (!precioPendienteConfirmacion) return

    try {
      setGuardandoPrecio(true)
      setFormError(null)
      if (editando) {
        const updated = await updateConfigPrecio(editando.id, precioPendienteConfirmacion)
        setPrecios((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      } else {
        const nuevo = await createConfigPrecio(precioPendienteConfirmacion, user.id)
        setPrecios((prev) => [nuevo, ...prev])
      }
      setPrecioPendienteConfirmacion(null)
      setDialogOpen(false)
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setGuardandoPrecio(false)
    }
  }

  const guardarParametro = async (key: ParametroKey) => {
    if (!user) return

    const parsed = parametroCajaSchema.safeParse(parametros)
    if (!parsed.success) {
      const nextErrors: Partial<Record<ParametroKey, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ParametroKey | undefined
        if (field) nextErrors[field] = issue.message
      }
      setParametroFieldErrors(nextErrors)
      return
    }

    try {
      setGuardandoParametro(key)
      setParametroError(null)
      setParametroSuccess(null)
      setParametroFieldErrors((prev) => ({ ...prev, [key]: undefined }))

      const config = PARAMETRO_CAJA_CONFIG[key]
      const saved = await upsertConfigSistemaNumerico({
        clave: config.clave,
        nombre: config.nombre,
        descripcion: config.descripcion,
        valor_numerico: parametros[key],
      }, user.id)

      const savedValue = Number(saved.valor_numerico ?? parametros[key])
      setParametros((prev) => ({ ...prev, [key]: savedValue }))
      setParametroSuccess(`Guardado: ${config.label}`)
    } catch (e) {
      setParametroError((e as Error).message)
    } finally {
      setGuardandoParametro(null)
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
        description="Precio S/./kg por semana, variedad y categoría, además de parámetros globales de empaque."
      />

      <Card className="mb-6">
        <CardContent className="pt-5">
          <div>
            <p className="text-sm font-semibold">Parámetros de empaquetado</p>
            <p className="text-sm text-muted-foreground">Cada parámetro se guarda de forma independiente para evitar errores en bloque.</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {(Object.keys(PARAMETRO_CAJA_CONFIG) as ParametroKey[]).map((key) => {
              const config = PARAMETRO_CAJA_CONFIG[key]
              return (
                <div key={key} className="rounded-lg border p-3">
                  <FormField label={config.label} error={parametroFieldErrors[key]} required>
                    <Input
                      type="number"
                      step={config.step}
                      min={config.min}
                      placeholder={config.placeholder}
                      value={parametros[key]}
                      onChange={(e) => {
                        const value = Number(e.target.value)
                        setParametros((prev) => ({ ...prev, [key]: Number.isNaN(value) ? 0 : value }))
                        setParametroFieldErrors((prev) => ({ ...prev, [key]: undefined }))
                      }}
                    />
                  </FormField>
                  <p className="text-xs text-muted-foreground mt-1">{config.helper}</p>
                  <Button
                    type="button"
                    className="mt-3"
                    loading={guardandoParametro === key}
                    onClick={() => setParametroPendienteConfirmacion(key)}
                  >
                    Guardar
                  </Button>
                </div>
              )
            })}
          </div>
          {parametroError && <p className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{parametroError}</p>}
          {parametroSuccess && <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{parametroSuccess}</p>}
        </CardContent>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Precios configurados por semana</p>
        <Button onClick={abrirNuevo}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo precio
        </Button>
      </div>

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
                          <TableHead>Rango semana</TableHead>
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
                              <TableCell>{FORMATEAR_RANGO_SEMANA_ISO(p.anio, p.semana)}</TableCell>
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
        open={!!parametroPendienteConfirmacion}
        title="¿Confirmar guardado de parámetro?"
        description={parametroPendienteConfirmacion ? `Se guardará: ${PARAMETRO_CAJA_CONFIG[parametroPendienteConfirmacion].label}` : ''}
        confirmLabel="Sí, guardar"
        variant="default"
        loading={!!parametroPendienteConfirmacion && guardandoParametro === parametroPendienteConfirmacion}
        onConfirm={() => {
          if (parametroPendienteConfirmacion) void guardarParametro(parametroPendienteConfirmacion)
          setParametroPendienteConfirmacion(null)
        }}
        onCancel={() => setParametroPendienteConfirmacion(null)}
      />

      <ConfirmDialog
        open={!!precioAEliminar}
        title="¿Eliminar precio?"
        description={precioAEliminar ? `Sem ${precioAEliminar.semana}/${precioAEliminar.anio} — ${VARIEDAD_PRODUCTO_CONFIG[precioAEliminar.variedad].label} ${CALIDAD_PRODUCTO_CONFIG[precioAEliminar.categoria].label}` : ''}
        confirmLabel="Eliminar"
        onConfirm={() => { eliminar(precioAEliminar!); setPrecioAEliminar(null) }}
        onCancel={() => setPrecioAEliminar(null)}
      />

      <ConfirmDialog
        open={!!precioPendienteConfirmacion}
        title={editando ? '¿Confirmar actualización de precio?' : '¿Confirmar creación de precio?'}
        description={precioPendienteConfirmacion
          ? `Sem ${precioPendienteConfirmacion.semana}/${precioPendienteConfirmacion.anio} · ${VARIEDAD_PRODUCTO_CONFIG[precioPendienteConfirmacion.variedad].label} · ${CALIDAD_PRODUCTO_CONFIG[precioPendienteConfirmacion.categoria].label} · S/. ${Number(precioPendienteConfirmacion.precio_kg_sol).toFixed(4)}`
          : ''}
        confirmLabel={editando ? 'Sí, actualizar' : 'Sí, crear'}
        variant="default"
        loading={guardandoPrecio}
        onConfirm={() => { void confirmarGuardadoPrecio() }}
        onCancel={() => setPrecioPendienteConfirmacion(null)}
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
              <Button type="submit" loading={isSubmitting || guardandoPrecio}>{editando ? 'Guardar' : 'Crear'}</Button>
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

function FORMATEAR_RANGO_SEMANA_ISO(anio: number, semana: number): string {
  const referencia = setISOWeek(setISOWeekYear(new Date(), anio), semana)
  const inicio = startOfISOWeek(referencia)
  const fin = endOfISOWeek(referencia)

  return `${format(inicio, 'dd/MM/yyyy')} - ${format(fin, 'dd/MM/yyyy')}`
}
