import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, Phone } from 'lucide-react'
import { usePersonal } from './hooks/usePersonal'
import { PersonalForm } from './PersonalForm'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage } from '@/components/shared/Spinner'
import { EstadoActivoBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TIPO_PERSONAL_CONFIG } from '@/constants'
import { formatMoneda } from '@/utils/formatters'
import type { PersonalCampo } from '@/types/models'
import type { PersonalCampoFormData } from '@/utils/validators'

export default function PersonalPage() {
  const { personal, loading, error, reload, crear, actualizar, eliminar } = usePersonal()
  const [busqueda, setBusqueda] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<PersonalCampo | null>(null)

  const filtrados = personal.filter((p) =>
    `${p.nombre} ${p.apellido} ${p.codigo}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  const abrirNuevo = () => { setEditando(null); setDialogOpen(true) }
  const abrirEditar = (p: PersonalCampo) => { setEditando(p); setDialogOpen(true) }
  const cerrar = () => { setDialogOpen(false); setEditando(null) }

  const handleSubmit = async (data: PersonalCampoFormData) => {
    if (editando) await actualizar(editando.id, data)
    else await crear(data)
    cerrar()
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Personal de Campo"
        description={`${personal.length} registrados`}
        actions={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState title="Sin personal" action={!busqueda ? <Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Agregar</Button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtrados.map((p) => (
            <div key={p.id} className="bg-card border rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.apellido}, {p.nombre}</p>
                  <p className="text-xs text-muted-foreground">{p.codigo} · {TIPO_PERSONAL_CONFIG[p.tipo].label}</p>
                </div>
                <EstadoActivoBadge estado={p.estado} />
              </div>
              <div className="text-sm text-muted-foreground flex flex-col gap-0.5">
                {p.telefono && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p.telefono}</span>}
                <span>Tarifa: <strong className="text-foreground">{formatMoneda(p.tarifa_destajo)}/unidad</strong></span>
                {p.dni && <span>DNI: {p.dni}</span>}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => abrirEditar(p)}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm('¿Eliminar?')) eliminar(p.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editando ? 'Editar personal' : 'Nuevo personal'}</DialogTitle></DialogHeader>
          <PersonalForm defaultValues={editando ?? undefined} onSubmit={handleSubmit} onCancel={cerrar} isEditing={!!editando} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
