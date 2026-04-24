import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLiquidacionesAgri, getLiquidacionAgri, actualizarEstadoLiquidacionAgri, pagarLiquidacionAgri, deleteLiquidacionAgri } from '@/services/liquidaciones-agri.service'
import { logAudit } from '@/services/audit.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EmptyState } from '@/components/shared/EmptyState'
import { EstadoLiquidacionBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RegistrarPagoDialog, type RegistroPagoPayload } from '@/components/shared/RegistrarPagoDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatFecha, formatMoneda } from '@/utils/formatters'
import { generateLiquidacionAgriExcel } from '@/utils/liquidacion-agri-excel'
import { Plus, FileText, Search, Download, Pencil, Trash2 } from 'lucide-react'
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'
import { useAuthStore } from '@/store/auth.store'
import { APP_ROLES } from '@/types/auth'
import type { LiquidacionAgri } from '@/types/models'

export default function LiquidacionesAgriPage() {
  const navigate = useNavigate()
  const { roles, user } = useAuthStore()
  const puedePagar = hasPermission(roles, APP_PERMISSIONS.LIQUIDACIONES_AGRI_PAY)
  const esTesoreria = roles.includes(APP_ROLES.TESORERIA)
  
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionAgri[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [accionPendiente, setAccionPendiente] = useState<{ id: string; estado: 'confirmada' } | null>(null)
  const [pagoPendienteId, setPagoPendienteId] = useState<string | null>(null)
  const [descargandoId, setDescargandoId] = useState<string | null>(null)
  const [eliminarPendienteId, setEliminarPendienteId] = useState<string | null>(null)
  const [cambiando, setCambiando] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await getLiquidacionesAgri()
      setLiquidaciones(data)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  const handleCambiarEstado = async () => {
    if (!accionPendiente || !user) return
    setCambiando(true)
    try {
      const liq = liquidaciones.find(l => l.id === accionPendiente.id)
      await actualizarEstadoLiquidacionAgri(accionPendiente.id, accionPendiente.estado)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'liquidaciones_agri',
        registroId: accionPendiente.id,
        descripcion: `Liquidación confirmada: ${liq?.codigo}`,
        datosAnteriores: { estado: 'borrador' },
        datosNuevos: { estado: accionPendiente.estado },
      })
      await cargar()
      setAccionPendiente(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCambiando(false)
    }
  }

  const handleRegistrarPago = async (payload: RegistroPagoPayload) => {
    if (!pagoPendienteId || !user) return
    setCambiando(true)
    try {
      const liq = liquidaciones.find((l) => l.id === pagoPendienteId)
      await pagarLiquidacionAgri(pagoPendienteId, payload)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'actualizar',
        modulo: 'liquidaciones_agri',
        registroId: pagoPendienteId,
        descripcion: `Liquidación liquidada: ${liq?.codigo}`,
        datosAnteriores: { estado: 'confirmada' },
        datosNuevos: { estado: 'pagada', fecha_pago: payload.fecha_pago },
      })
      await cargar()
      setPagoPendienteId(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCambiando(false)
    }
  }

  const handleDescargar = async (id: string) => {
    setDescargandoId(id)
    try {
      const full = await getLiquidacionAgri(id)
      generateLiquidacionAgriExcel(full)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDescargandoId(null)
    }
  }

  const handleEliminar = async (id: string) => {
    if (!user) return
    setCambiando(true)
    try {
      const liq = liquidaciones.find(l => l.id === id)
      await deleteLiquidacionAgri(id)
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'eliminar',
        modulo: 'liquidaciones_agri',
        registroId: id,
        descripcion: `Liquidación eliminada: ${liq?.codigo}`,
        datosAnteriores: { codigo: liq?.codigo, total_monto: liq?.total_monto },
        datosNuevos: null,
      })
      await cargar()
      setEliminarPendienteId(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCambiando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const filtradas = liquidaciones.filter((l) => {
    if (esTesoreria && !['confirmada', 'pagada'].includes(l.estado)) return false

    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return l.codigo?.toLowerCase().includes(q) ||
      (l.agricultor as any)?.apellido?.toLowerCase().includes(q) ||
      (l.agricultor as any)?.nombre?.toLowerCase().includes(q)
  })

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />

  return (
    <div>
      <PageHeader
        title="Liquidaciones – Agricultores"
        description="Liquidaciones de producción de los agricultores"
        actions={
          <Button onClick={() => navigate('/liquidaciones/agricultores/nueva')}>
            <Plus className="h-4 w-4 mr-2" /> Nueva liquidación
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por código o agricultor..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {filtradas.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="Sin liquidaciones" description="Crea la primera liquidación para un agricultor." />
      ) : (
        <div className="flex flex-col gap-2">
          {filtradas.map((l) => (
            <Card key={l.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 cursor-pointer" onClick={() => navigate(`/liquidaciones/agricultores/${l.id}`)}>
                    <p className="font-medium text-sm">{l.codigo}</p>
                    <p className="text-muted-foreground text-xs">
                      {(l.agricultor as any)?.apellido}, {(l.agricultor as any)?.nombre}
                      {' · '}{formatFecha(l.fecha_inicio)} – {formatFecha(l.fecha_fin)}
                    </p>
                    {esTesoreria && l.estado === 'pagada' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Pago: {l.fecha_pago ? formatFecha(l.fecha_pago) : '-'}
                        {' · '}Operacion: {l.numero_operacion || '-'}
                        {' · '}Modalidad: {l.modalidad_pago === 'transferencia'
                          ? 'Transferencia'
                          : l.modalidad_pago === 'yape_plin'
                            ? 'Yape/Plin'
                            : l.modalidad_pago === 'efectivo'
                              ? 'Efectivo'
                              : '-'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold text-sm">{formatMoneda(l.total_monto ?? 0)}</p>
                    <EstadoLiquidacionBadge estado={l.estado} />
                    {esTesoreria && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={descargandoId === l.id}
                        onClick={() => { void handleDescargar(l.id) }}
                        title="Descargar reporte"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {l.estado === 'borrador' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cambiando}
                          onClick={() => navigate(`/liquidaciones/agricultores/${l.id}/editar`)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cambiando}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setEliminarPendienteId(l.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAccionPendiente({ id: l.id, estado: 'confirmada' })}
                        >
                          Confirmar
                        </Button>
                      </>
                    )}
                    {l.estado === 'confirmada' && (
                      puedePagar ? (
                        <Button size="sm" variant="outline" onClick={() => setPagoPendienteId(l.id)}>
                          Marcar liquidada
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled>
                          Pago solo admin
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Confirmar acción */}
      <ConfirmDialog
        open={!!eliminarPendienteId}
        title="¿Eliminar liquidación?"
        description={`Se eliminará la liquidación. Esta acción es irreversible.`}
        confirmLabel="Sí, eliminar"
        variant="destructive"
        loading={cambiando}
        onConfirm={() => {
          if (eliminarPendienteId) void handleEliminar(eliminarPendienteId)
        }}
        onCancel={() => setEliminarPendienteId(null)}
      />

      <ConfirmDialog
        open={!!accionPendiente}
        title="¿Confirmar liquidación?"
        description="La liquidación saldrá de borrador y quedará confirmada."
        confirmLabel="Sí, confirmar"
        loading={cambiando}
        onConfirm={() => { void handleCambiarEstado() }}
        onCancel={() => setAccionPendiente(null)}
      />

      <RegistrarPagoDialog
        open={!!pagoPendienteId}
        loading={cambiando}
        title="Registrar pago de liquidación"
        description="Ingresa los datos del pago para marcar la liquidación como liquidada."
        onConfirm={(payload) => handleRegistrarPago(payload)}
        onCancel={() => setPagoPendienteId(null)}
      />
    </div>
  )
}
