import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLiquidacionesPersonal } from '@/services/liquidaciones-personal.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EmptyState } from '@/components/shared/EmptyState'
import { EstadoLiquidacionBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoneda, formatQuincena } from '@/utils/formatters'
import { Plus, FileText, Search } from 'lucide-react'
import type { LiquidacionPersonal } from '@/types/models'

export default function LiquidacionesPersonalPage() {
  const navigate = useNavigate()
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionPersonal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await getLiquidacionesPersonal()
      setLiquidaciones(data)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const filtradas = liquidaciones.filter((l) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return l.codigo?.toLowerCase().includes(q) ||
      (l.personal as any)?.apellido?.toLowerCase().includes(q) ||
      (l.personal as any)?.nombre?.toLowerCase().includes(q)
  })

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />

  return (
    <div>
      <PageHeader
        title="Liquidaciones – Personal"
        description="Liquidaciones quincenales del personal de campo"
        actions={
          <Button onClick={() => navigate('/liquidaciones/personal/nueva')}>
            <Plus className="h-4 w-4 mr-2" /> Nueva liquidación
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por código o nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {filtradas.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="Sin liquidaciones" description="Crea la primera liquidación para el personal de campo." />
      ) : (
        <div className="flex flex-col gap-2">
          {filtradas.map((l) => (
            <Card key={l.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/liquidaciones/personal/${l.id}`)}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{l.codigo}</p>
                  <p className="text-muted-foreground text-xs">
                    {(l.personal as any)?.apellido}, {(l.personal as any)?.nombre}
                    {' · '}{formatQuincena(l.quincena)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-sm">{formatMoneda(l.total_monto ?? 0)}</p>
                  <EstadoLiquidacionBadge estado={l.estado} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
