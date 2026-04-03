import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Filter, Printer } from 'lucide-react'
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
import { CALIDAD_PRODUCTO_CONFIG, ESTADO_LOTE_CONFIG, TIPO_PRODUCCION_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { formatFecha, formatPeso } from '@/utils/formatters'
import type { LoteFormData } from '@/utils/validators'
import type { EstadoLote, Lote } from '@/types/models'

export default function LotesPage() {
  const { lotes, loading, error, reload, crear } = useLotes()
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoLote | 'todos'>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [ticketLote, setTicketLote] = useState<Lote | null>(null)

  const getAcopiadorLabel = (lote: Lote) => {
    if (lote.acopiador) return `${lote.acopiador.apellido}, ${lote.acopiador.nombre}`
    if (lote.acopiador_agricultor) return `${lote.acopiador_agricultor.apellido}, ${lote.acopiador_agricultor.nombre}`
    return '-'
  }

  const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

  const handlePrintTicket = (lote: Lote) => {
    const acopiadorLabel = getAcopiadorLabel(lote)
    const productoNombre = lote.producto?.nombre ?? '-'
    const productoCodigo = lote.producto?.codigo ?? '-'
    const variedad = lote.producto ? VARIEDAD_PRODUCTO_CONFIG[lote.producto.variedad].label : '-'
    const calidad = lote.producto ? CALIDAD_PRODUCTO_CONFIG[lote.producto.calidad].label : '-'
    const tipo = lote.producto ? TIPO_PRODUCCION_CONFIG[lote.producto.tipo_produccion].label : '-'
    const centroAcopio = lote.centro_acopio?.nombre ?? '-'

    const printWindow = window.open('', '_blank', 'width=420,height=720')
    if (!printWindow) return

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Ticket ${escapeHtml(lote.codigo)}</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #111;
              font-family: 'Courier New', Courier, monospace;
            }
            body {
              width: 72mm;
              margin: 0 auto;
              padding: 4mm 2mm 6mm;
            }
            .ticket {
              width: 100%;
              font-size: 12px;
              line-height: 1.15;
            }
            .center { text-align: center; }
            .strong { font-weight: 700; }
            .title {
              font-size: 15px;
              font-weight: 700;
              margin-bottom: 2mm;
              text-transform: uppercase;
            }
            .subtitle {
              font-size: 11px;
              margin-bottom: 3mm;
            }
            .divider {
              border-top: 1px dashed #111;
              margin: 3mm 0;
            }
            .block { margin-bottom: 3mm; }
            .label {
              font-size: 10px;
              text-transform: uppercase;
            }
            .value {
              font-size: 12px;
              font-weight: 700;
            }
            .row {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              margin: 1mm 0;
            }
            .row .label {
              font-size: 11px;
              text-transform: none;
            }
            .row .value {
              font-size: 11px;
              font-weight: 700;
              text-align: right;
            }
            .grid3 {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 2mm;
              margin-top: 2mm;
            }
            .grid3 > div, .grid2 > div {
              border-top: 1px dashed #999;
              padding-top: 1.5mm;
            }
            .grid2 {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 2mm;
              margin-top: 2mm;
            }
            .metric-label {
              font-size: 10px;
              text-transform: uppercase;
            }
            .metric-value {
              font-size: 13px;
              font-weight: 700;
              margin-top: 1mm;
            }
          </style>
        </head>
        <body>
          <main class="ticket">
            <section class="center block">
              <div class="title">AGRONESIS DEL PERU S.A.C.</div>
              <div class="strong">${escapeHtml(formatFecha(lote.fecha_ingreso))}</div>
              <div class="subtitle">Centro de acopio: ${escapeHtml(centroAcopio)}</div>
            </section>

            <div class="divider"></div>

            <section class="center block">
              <div class="strong">TICKET DE CONFIRMACION</div>
              <div class="value">${escapeHtml(lote.codigo)}</div>
            </section>

            <div class="divider"></div>

            <section class="block">
              <div class="label">Codigo</div>
              <div class="value">${escapeHtml(lote.codigo)}</div>
            </section>

            ${lote.codigo_lote_agricultor ? `
            <section class="block">
              <div class="label">Codigo de lote por agricultor</div>
              <div class="value">${escapeHtml(lote.codigo_lote_agricultor)}</div>
            </section>
            ` : ''}

            <section class="block">
              <div class="label">Agricultor</div>
              <div class="value">${escapeHtml(`${lote.agricultor?.apellido ?? '-'}, ${lote.agricultor?.nombre ?? ''}`.trim())}</div>
            </section>

            <section class="block">
              <div class="label">Acopiador</div>
              <div class="value">${escapeHtml(acopiadorLabel)}</div>
            </section>

            <div class="divider"></div>

            <section class="block">
              <div class="label">Producto</div>
              <div class="value">${escapeHtml(productoNombre)}</div>
              <div class="row"><span class="label">Codigo</span><span class="value">${escapeHtml(productoCodigo)}</span></div>
              <div class="row"><span class="label">Variedad</span><span class="value">${escapeHtml(variedad)}</span></div>
              <div class="row"><span class="label">Calidad</span><span class="value">${escapeHtml(calidad)}</span></div>
              <div class="row"><span class="label">Tipo</span><span class="value">${escapeHtml(tipo)}</span></div>
            </section>

            <div class="grid3">
              <div>
                <div class="metric-label">Bruto</div>
                <div class="metric-value">${escapeHtml(formatPeso(lote.peso_bruto_kg))}</div>
              </div>
              <div>
                <div class="metric-label">Tara</div>
                <div class="metric-value">${escapeHtml(formatPeso(lote.peso_tara_kg))}</div>
              </div>
              <div>
                <div class="metric-label">Neto</div>
                <div class="metric-value">${escapeHtml(formatPeso(lote.peso_neto_kg))}</div>
              </div>
            </div>

            <div class="grid2">
              <div>
                <div class="metric-label">Jabas ingresadas</div>
                <div class="metric-value">${escapeHtml(String(lote.num_cubetas))}</div>
              </div>
              <div>
                <div class="metric-label">Fecha</div>
                <div class="metric-value">${escapeHtml(formatFecha(lote.fecha_ingreso))}</div>
              </div>
            </div>
          </main>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const filtrados = lotes.filter((l) => {
    const coincideBusqueda = `${l.codigo} ${l.agricultor?.nombre ?? ''} ${l.agricultor?.apellido ?? ''} ${l.acopiador?.nombre ?? ''} ${l.acopiador?.apellido ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())
    const coincideEstado = filtroEstado === 'todos' || l.estado === filtroEstado
    return coincideBusqueda && coincideEstado
  })

  const handleSubmit = async (data: LoteFormData) => {
    try {
      const nuevo = await crear(data)
      setDialogError(null)
      setDialogOpen(false)
      setTicketLote(nuevo)
    } catch (e) {
      setDialogError((e as Error).message)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Lotes"
        description={`${lotes.length} registrados`}
        actions={<Button onClick={() => { setDialogError(null); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Nuevo lote</Button>}
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
          action={<Button onClick={() => { setDialogError(null); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Nuevo lote</Button>}
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
                  {l.centro_acopio?.nombre} · {formatFecha(l.fecha_ingreso)} · N° JABAS: {l.num_cubetas} · Bruto: {formatPeso(l.peso_bruto_kg)} · Tara: {formatPeso(l.peso_tara_kg)} · Neto: {formatPeso(l.peso_neto_kg)}
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
          {dialogError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{dialogError}</p>}
          <LoteForm onSubmit={handleSubmit} onCancel={() => { setDialogError(null); setDialogOpen(false) }} />
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
                {ticketLote.codigo_lote_agricultor && (
                  <div>
                    <p className="text-xs text-muted-foreground">Código de lote por agricultor</p>
                    <p className="font-medium">{ticketLote.codigo_lote_agricultor}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Agricultor</p>
                  <p className="font-semibold">{ticketLote.agricultor?.apellido}, {ticketLote.agricultor?.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Acopiador</p>
                  <p className="font-semibold">{getAcopiadorLabel(ticketLote)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Producto</p>
                  {ticketLote.producto ? (
                    <div className="space-y-1">
                      <p className="font-medium">{ticketLote.producto.nombre}</p>
                      <p className="text-xs text-muted-foreground">Codigo: {ticketLote.producto.codigo}</p>
                      <p className="text-xs text-muted-foreground">Variedad: {VARIEDAD_PRODUCTO_CONFIG[ticketLote.producto.variedad].label}</p>
                      <p className="text-xs text-muted-foreground">Calidad: {CALIDAD_PRODUCTO_CONFIG[ticketLote.producto.calidad].label}</p>
                      <p className="text-xs text-muted-foreground">Tipo: {TIPO_PRODUCCION_CONFIG[ticketLote.producto.tipo_produccion].label}</p>
                    </div>
                  ) : (
                    <p>-</p>
                  )}
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
                    <p className="text-xs text-muted-foreground">Jabas ingresadas</p>
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
                  <Button type="button" variant="secondary" className="w-full" onClick={() => handlePrintTicket(ticketLote)}>
                    <Printer className="h-4 w-4" /> Imprimir
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
