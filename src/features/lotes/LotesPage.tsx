import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Filter } from 'lucide-react'
import { useLotes } from './hooks/useLotes'
import { LoteForm } from './LoteForm'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage } from '@/components/shared/Spinner'
import { EstadoLoteBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ESTADO_LOTE_CONFIG } from '@/constants'
import { formatFecha, formatPeso } from '@/utils/formatters'
import type { LoteFormData } from '@/utils/validators'
import type { EstadoLote } from '@/types/models'

export default function LotesPage() {
  const { lotes, loading, error, reload, crear } = useLotes()
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoLote | 'todos'>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtrados = lotes.filter((l) => {
    const coincideBusqueda = `${l.codigo} ${l.agricultor?.nombre ?? ''} ${l.agricultor?.apellido ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())
    const coincideEstado = filtroEstado === 'todos' || l.estado === filtroEstado
    return coincideBusqueda && coincideEstado
  })

  const handleSubmit = async (data: LoteFormData) => {
    const nuevo = await crear(data)
    setDialogOpen(false)
    navigate(`/lotes/${nuevo.id}`)
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Lotes"
        description={`${lotes.length} registrados`}
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Nuevo lote</Button>}
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Código o agricultor..." className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoLote | 'todos')}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(ESTADO_LOTE_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          title="Sin lotes"
          description="Registra el primer lote del día."
          action={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Nuevo lote</Button>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map((l) => (
            <div
              key={l.id}
              className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/lotes/${l.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{l.codigo}</span>
                  <EstadoLoteBadge estado={l.estado} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {l.agricultor?.apellido}, {l.agricultor?.nombre} · {l.producto?.nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.centro_acopio?.nombre} · {formatFecha(l.fecha_ingreso)} · {formatPeso(l.peso_bruto_kg)}
                </p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); navigate(`/lotes/${l.id}`) }}>
                <Eye className="h-4 w-4 mr-1" /> Ver
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar nuevo lote</DialogTitle></DialogHeader>
          <LoteForm onSubmit={handleSubmit} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
