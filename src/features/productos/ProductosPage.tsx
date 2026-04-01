import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, LayoutGrid, List } from 'lucide-react'
import { useProductos } from './hooks/useProductos'
import { ProductoForm } from './ProductoForm'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage } from '@/components/shared/Spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CALIDAD_PRODUCTO_CONFIG, TIPO_PRODUCCION_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import type { Producto } from '@/types/models'
import type { ProductoFormData } from '@/utils/validators'

export default function ProductosPage() {
  const { productos, loading, error, reload, crear, actualizar, eliminar } = useProductos()
  const [busqueda, setBusqueda] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [vista, setVista] = useState<'cards' | 'lista'>('lista')

  const filtrados = productos.filter((p) =>
    `${p.nombre} ${p.codigo}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  const abrirNuevo = () => { setEditando(null); setDialogOpen(true) }
  const abrirEditar = (p: Producto) => { setEditando(p); setDialogOpen(true) }
  const cerrar = () => { setDialogOpen(false); setEditando(null) }

  const handleSubmit = async (data: ProductoFormData) => {
    if (editando) await actualizar(editando.id, data)
    else await crear(data)
    cerrar()
  }

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return
    await eliminar(id)
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Productos"
        description={`${productos.length} registrados`}
        actions={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant={vista === 'lista' ? 'secondary' : 'outline'}
            onClick={() => setVista('lista')}
          >
            <List className="h-4 w-4" /> Lista
          </Button>
          <Button
            type="button"
            size="sm"
            variant={vista === 'cards' ? 'secondary' : 'outline'}
            onClick={() => setVista('cards')}
          >
            <LayoutGrid className="h-4 w-4" /> Tarjetas
          </Button>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState title="Sin productos" action={!busqueda ? <Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Agregar</Button> : undefined} />
      ) : vista === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtrados.map((p) => (
            <div key={p.id} className="bg-card border rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">{p.codigo} · {VARIEDAD_PRODUCTO_CONFIG[p.variedad].label}</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
                <span>Calidad: <strong className="text-foreground">{CALIDAD_PRODUCTO_CONFIG[p.calidad].label}</strong></span>
                <span>Produccion: <strong className="text-foreground">{TIPO_PRODUCCION_CONFIG[p.tipo_produccion].label}</strong></span>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => abrirEditar(p)}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleEliminar(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Producto</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead>Calidad</TableHead>
                <TableHead>Produccion</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.codigo}</p>
                  </TableCell>
                  <TableCell>{VARIEDAD_PRODUCTO_CONFIG[p.variedad].label}</TableCell>
                  <TableCell>{CALIDAD_PRODUCTO_CONFIG[p.calidad].label}</TableCell>
                  <TableCell>{TIPO_PRODUCCION_CONFIG[p.tipo_produccion].label}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleEliminar(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editando ? 'Editar producto' : 'Nuevo producto'}</DialogTitle></DialogHeader>
          <ProductoForm defaultValues={editando ?? undefined} onSubmit={handleSubmit} onCancel={cerrar} isEditing={!!editando} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
