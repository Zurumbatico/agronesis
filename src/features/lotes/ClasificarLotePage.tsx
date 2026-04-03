import { useState, useEffect, useId } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLote, actualizarEstadoLote } from '@/services/lotes.service'
import { getClasificacionesPorLote, guardarClasificacion } from '@/services/clasificaciones.service'
import { getColaboradores } from '@/services/colaboradores.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { ToastContainer, useToast } from '@/components/shared/Toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth.store'
import { formatPeso } from '@/utils/formatters'
import { Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Lote, Colaborador } from '@/types/models'

type Fila = { key: string; colaborador_id: string; peso_bueno_kg: string }
type MesaBloque = { key: string; filas: Fila[] }

const getMesasStorageKey = (loteId: string) => `clasificacion-cuadros-${loteId}`

export default function ClasificarLotePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const uid = useId()

  const [lote, setLote] = useState<Lote | null>(null)
  const [seleccionadores, setSeleccionadores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { toasts, toast, remove } = useToast()

  // Datos de la sesión
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [observaciones, setObservaciones] = useState('')
  const [mesas, setMesas] = useState<MesaBloque[]>([
    { key: `${uid}-mesa-inicial`, filas: [] },
  ])

  const todasFilas = mesas.flatMap((m) => m.filas)
  const totalBuenos = todasFilas.reduce((acc, f) => acc + (parseFloat(f.peso_bueno_kg) || 0), 0)
  const totalMalos = Math.max(0, (lote?.peso_neto_kg ?? 0) - totalBuenos)
  const porcentajeBuenos = lote ? Math.min(100, (totalBuenos / lote.peso_neto_kg) * 100) : 0

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [l, colabs, [sesion]] = await Promise.all([
        getLote(id),
        getColaboradores(),
        getClasificacionesPorLote(id),
      ])
      setLote(l)
      setSeleccionadores(colabs.filter((c) => c.rol === 'seleccionador' && c.estado === 'activo'))

      if (sesion) {
        setFecha(sesion.fecha_clasificacion)
        setObservaciones(sesion.observaciones ?? '')
        const mesasCargadas: MesaBloque[] = [{ key: `${uid}-mesa-default`, filas: [] }]

        const aportesCargados = (sesion.aportes ?? []).map((a, i) => ({
          key: `${uid}-loaded-${i}`,
          colaborador_id: a.colaborador_id,
          peso_bueno_kg: String(a.peso_bueno_kg),
        }))

        if (aportesCargados.length > 0) {
          mesasCargadas[0].filas = aportesCargados
        }

        // Mantener consistencia visual de cuadros al volver a abrir un borrador.
        try {
          const raw = localStorage.getItem(getMesasStorageKey(id))
          if (raw) {
            const parsed = JSON.parse(raw) as Array<{ filas: Array<{ colaborador_id: string; peso_bueno_kg: string }> }>
            if (Array.isArray(parsed) && parsed.length > 0) {
              const mesasDesdeLocal: MesaBloque[] = parsed.map((m, i) => ({
                key: `${uid}-mesa-local-${i}`,
                filas: Array.isArray(m.filas)
                  ? m.filas.map((f, j) => ({
                      key: `${uid}-fila-local-${i}-${j}`,
                      colaborador_id: f.colaborador_id ?? '',
                      peso_bueno_kg: String(f.peso_bueno_kg ?? ''),
                    }))
                  : [],
              }))
              if (mesasDesdeLocal.length > 0) {
                setMesas(mesasDesdeLocal)
                setLoading(false)
                return
              }
            }
          }
        } catch {
          // Si localStorage falla o está corrupto, continuar con reconstrucción estándar.
        }

        setMesas(mesasCargadas)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  useEffect(() => {
    if (!formError) return
    const timeoutId = window.setTimeout(() => {
      setFormError(null)
    }, 4500)
    return () => window.clearTimeout(timeoutId)
  }, [formError])

  const agregarMesa = () => {
    setMesas((prev) => [
      ...prev,
      {
        key: `${uid}-m-${Date.now()}`,
        filas: [{ key: `${uid}-f-${Date.now()}`, colaborador_id: '', peso_bueno_kg: '' }],
      },
    ])
  }

  const eliminarMesa = (mesaKey: string) => {
    setMesas((prev) => prev.filter((m) => m.key !== mesaKey))
  }

  const agregarFilaEnMesa = (mesaKey: string) => {
    setMesas((prev) => prev.map((m) => (
      m.key === mesaKey
        ? {
            ...m,
            filas: [...m.filas, { key: `${uid}-f-${Date.now()}`, colaborador_id: '', peso_bueno_kg: '' }],
          }
        : m
    )))
  }

  const eliminarFilaEnMesa = (mesaKey: string, filaKey: string) => {
    setMesas((prev) => prev.map((m) => (
      m.key === mesaKey ? { ...m, filas: m.filas.filter((f) => f.key !== filaKey) } : m
    )))
  }

  const actualizarFilaEnMesa = (mesaKey: string, filaKey: string, campo: keyof Omit<Fila, 'key'>, valor: string) => {
    setMesas((prev) => prev.map((m) => (
      m.key === mesaKey
        ? {
            ...m,
            filas: m.filas.map((f) => (f.key === filaKey ? { ...f, [campo]: valor } : f)),
          }
        : m
    )))
  }

  const handleGuardar = async (finalizarDespues = false) => {
    if (!lote || !user) return

    setFormError(null)

    const notifyFormError = (message: string) => {
      setFormError(message)
      toast('error', message)
    }

    const filasActuales = mesas.flatMap((m) => m.filas)

    const hayFilaIncompleta = filasActuales.some((f) => {
      const peso = parseFloat(f.peso_bueno_kg)
      return !f.colaborador_id || f.peso_bueno_kg.trim() === '' || Number.isNaN(peso) || peso < 0
    })

    const neto = lote.peso_neto_kg
    const hayFilaMayorAlNeto = filasActuales.some((f) => {
      const peso = parseFloat(f.peso_bueno_kg)
      return !Number.isNaN(peso) && peso > neto
    })

    if (mesas.length === 0) {
      notifyFormError('Debe agregar al menos un cuadro antes de guardar.')
      return
    }

    if (filasActuales.length === 0) {
      notifyFormError('Debe agregar al menos un seleccionador antes de guardar.')
      return
    }

    if (hayFilaIncompleta) {
      notifyFormError('Complete todos los trabajadores: seleccionador y kg buenos (0 o mayor).')
      return
    }

    if (hayFilaMayorAlNeto) {
      notifyFormError(`Un valor de kg buenos no puede ser mayor al neto ingresado (${formatPeso(neto)}).`)
      return
    }

    const filasValidas = filasActuales.map((f) => ({
      colaborador_id: f.colaborador_id,
      peso_bueno_kg: parseFloat(f.peso_bueno_kg),
    }))

    const totalBuenosCalculado = filasValidas.reduce((acc, f) => acc + f.peso_bueno_kg, 0)
    if (totalBuenosCalculado > neto) {
      notifyFormError(`La suma de kg buenos (${formatPeso(totalBuenosCalculado)}) no puede ser mayor al neto (${formatPeso(neto)}).`)
      return
    }

    setSaving(true)
    try {
      await guardarClasificacion(
        lote.id,
        fecha,
        observaciones || null,
        filasValidas,
        user.id
      )

      if (id) {
        try {
          localStorage.setItem(
            getMesasStorageKey(id),
            JSON.stringify(
              mesas.map((m) => ({
                filas: m.filas.map((f) => ({
                  colaborador_id: f.colaborador_id,
                  peso_bueno_kg: f.peso_bueno_kg,
                })),
              }))
            )
          )
        } catch {
          // No bloquear el flujo si el guardado local falla.
        }
      }

      if (lote.estado === 'ingresado') {
        await actualizarEstadoLote(lote.id, 'en_clasificacion')
      }

      if (finalizarDespues) {
        await actualizarEstadoLote(lote.id, 'clasificado')
        navigate(`/lotes/${id}`)
      } else {
        toast('success', 'Borrador guardado')
      }
    } catch (e) {
      notifyFormError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!lote) return null

  const colaboradoresSeleccionados = new Set(mesas.flatMap((m) => m.filas.map((f) => f.colaborador_id)).filter(Boolean))

  return (
    <div className="max-w-3xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={remove} />

      <PageHeader
        title={`Clasificar – ${lote.codigo}`}
        backHref={`/lotes/${id}`}
        actions={
          <Button
            onClick={() => handleGuardar(true)}
            loading={saving}
            disabled={todasFilas.length === 0}
          >
            Finalizar clasificación
          </Button>
        }
      />

      {/* Resumen de pesos – se actualiza en tiempo real */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3 text-sm mb-3">
            <div className="rounded-lg bg-muted/30 border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Neto ingresado</p>
              <p className="font-bold text-base">{formatPeso(lote.peso_neto_kg)}</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
              <p className="text-xs text-green-700 mb-0.5">Buenos</p>
              <p className="font-bold text-base text-green-700">{formatPeso(totalBuenos)}</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
              <p className="text-xs text-red-700 mb-0.5">Pendiente / malos</p>
              <p className="font-bold text-base text-red-700">{formatPeso(totalMalos)}</p>
            </div>
          </div>
          {/* Barra de progreso de lo clasificado como bueno */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Clasificado como bueno</span>
              <span>{porcentajeBuenos.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${porcentajeBuenos}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos de la sesión */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Datos de la sesión</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Fecha</label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium">Observaciones</label>
            <Textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </CardContent>
      </Card>

      {/* Aportes por seleccionador (título único + cuadros duplicables) */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Aportes por seleccionador</h3>
          <Button variant="outline" size="sm" onClick={agregarMesa}>
            <Plus className="w-4 h-4 mr-1" />
            Agregar cuadro
          </Button>
        </div>

        {mesas.map((mesa) => (
          <Card key={mesa.key}>
            <CardContent className="pt-4 space-y-3">
              {mesa.filas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">
                  No hay trabajadores en esta mesa.
                </p>
              )}

              {mesa.filas.map((fila, idx) => (
                <div key={fila.key} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}.</span>
                  <div className="flex-1">
                    <Select
                      value={fila.colaborador_id}
                      onValueChange={(v) => actualizarFilaEnMesa(mesa.key, fila.key, 'colaborador_id', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionador..." />
                      </SelectTrigger>
                      <SelectContent>
                        {seleccionadores.map((s) => (
                          <SelectItem
                            key={s.id}
                            value={s.id}
                            disabled={colaboradoresSeleccionados.has(s.id) && fila.colaborador_id !== s.id}
                          >
                            {s.apellido}, {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00 kg"
                      value={fila.peso_bueno_kg}
                      onChange={(e) => actualizarFilaEnMesa(mesa.key, fila.key, 'peso_bueno_kg', e.target.value)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => eliminarFilaEnMesa(mesa.key, fila.key)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => agregarFilaEnMesa(mesa.key)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar trabajador
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => eliminarMesa(mesa.key)}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar cuadro
                </Button>
              </div>

            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end pt-2 border-t text-sm font-semibold text-green-700">
          Total buenos: {formatPeso(totalBuenos)}
        </div>
      </div>

        {formError && (
          <div className="mb-3 rounded-md border border-red-300 bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
            {formError}
          </div>
        )}

      <div className="flex justify-end gap-2 pb-8">
        <Button variant="outline" onClick={() => handleGuardar(false)} loading={saving}>
          Guardar borrador
        </Button>
        <Button
          onClick={() => handleGuardar(true)}
          loading={saving}
          disabled={todasFilas.length === 0}
        >
          Finalizar clasificación
        </Button>
      </div>
    </div>
  )
}

