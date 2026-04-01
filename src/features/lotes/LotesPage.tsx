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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ESTADO_LOTE_CONFIG } from '@/constants'
import { formatFecha, formatPeso } from '@/utils/formatters'
import type { LoteFormData } from '@/utils/validators'
import type { EstadoLote, Lote } from '@/types/models'

export default function LotesPage() {
  const { lotes, loading, error, reload, crear } = useLotes()
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoLote | 'todos'>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [ticketLote, setTicketLote] = useState<Lote | null>(null)

  const filtrados = lotes.filter((l) => {
    const coincideBusqueda = `${l.codigo} ${l.agricultor?.nombre ?? ''} ${l.agricultor?.apellido ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())
    const coincideEstado = filtroEstado === 'todos' || l.estado === filtroEstado
    return coincideBusqueda && coincideEstado
  })

  const handleSubmit = async (data: LoteFormData) => {
    const nuevo = await crear(data)
    setDialogOpen(false)
    setTicketLote(nuevo)
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
                  {l.centro_acopio?.nombre} · {formatFecha(l.fecha_ingreso)} · Bruto: {formatPeso(l.peso_bruto_kg)} · Neto: {formatPeso(l.peso_neto_kg)}
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

      <Dialog open={Boolean(ticketLote)} onOpenChange={(open) => !open && setTicketLote(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ticket de confirmación</DialogTitle></DialogHeader>
          {ticketLote && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Agronesis del Perú S.A.C.</CardTitle>
                <p className="text-sm text-muted-foreground">Lote registrado correctamente</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Código</p>
                  <p className="font-semibold">{ticketLote.codigo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Agricultor</p>
                  <p>{ticketLote.agricultor?.apellido}, {ticketLote.agricultor?.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Producto</p>
                  <p>{ticketLote.producto?.nombre}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Bruto</p>
                    <p className="font-medium">{formatPeso(ticketLote.peso_bruto_kg)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tara</p>
                    <p className="font-medium">{formatPeso(ticketLote.peso_tara_kg)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Neto</p>
                    <p className="font-medium">{formatPeso(ticketLote.peso_neto_kg)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Jabas</p>
                    <p className="font-medium">{ticketLote.num_cubetas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium">{formatFecha(ticketLote.fecha_ingreso)}</p>
                  </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                  <Button type="button" variant="outline" className="w-full" onClick={() => setTicketLote(null)}>
                    Cerrar
                  </Button>
                  <Button type="button" className="w-full" onClick={() => {
                    const loteId = ticketLote.id
                    setTicketLote(null)
                    navigate(`/lotes/${loteId}`)
                  }}>
                    Ver lote
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
