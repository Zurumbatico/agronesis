import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLiquidacionesAgri, actualizarEstadoLiquidacionAgri, pagarLiquidacionAgri } from '@/services/liquidaciones-agri.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EmptyState } from '@/components/shared/EmptyState'
import { EstadoLiquidacionBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatFecha, formatMoneda } from '@/utils/formatters'
import { Plus, FileText, Search } from 'lucide-react'
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'
import { useAuthStore } from '@/store/auth.store'
import type { LiquidacionAgri } from '@/types/models'

export default function LiquidacionesAgriPage() {
  const navigate = useNavigate()
  const { roles } = useAuthStore()
  const puedePagar = hasPermission(roles, APP_PERMISSIONS.LIQUIDACIONES_AGRI_PAY)
  
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionAgri[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [accionPendiente, setAccionPendiente] = useState<{ id: string; estado: 'confirmada' | 'pagada' } | null>(null)
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
    if (!accionPendiente) return
    setCambiando(true)
    try {
      if (accionPendiente.estado === 'pagada') {
        await pagarLiquidacionAgri(accionPendiente.id)
      } else {
        await actualizarEstadoLiquidacionAgri(accionPendiente.id, accionPendiente.estado)
      }
      await cargar()
      setAccionPendiente(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCambiando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const filtradas = liquidaciones.filter((l) => {
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
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold text-sm">{formatMoneda(l.total_monto ?? 0)}</p>
                    <EstadoLiquidacionBadge estado={l.estado} />
                    {l.estado === 'borrador' && (
                      <Button size="sm" variant="outline" onClick={() => setAccionPendiente({ id: l.id, estado: 'confirmada' })}>
                        Confirmar
                      </Button>
                    )}
                    {l.estado === 'confirmada' && (
                      puedePagar ? (
                        <Button size="sm" variant="outline" onClick={() => setAccionPendiente({ id: l.id, estado: 'pagada' })}>
                          Marcar pagada
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
        open={!!accionPendiente}
        title={accionPendiente?.estado === 'pagada' ? '¿Marcar como pagada?' : '¿Confirmar liquidación?'}
        description={accionPendiente?.estado === 'pagada'
          ? 'La liquidación quedará marcada como pagada.'
          : 'La liquidación saldrá de borrador y quedará confirmada.'}
        confirmLabel={accionPendiente?.estado === 'pagada' ? 'Sí, marcar pagada' : 'Sí, confirmar'}
        loading={cambiando}
        onConfirm={() => { void handleCambiarEstado() }}
        onCancel={() => setAccionPendiente(null)}
      />
    </div>
  )
}
