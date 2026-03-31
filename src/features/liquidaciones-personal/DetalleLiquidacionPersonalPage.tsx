import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getLiquidacionPersonal, actualizarEstadoLiquidacionPersonal } from '@/services/liquidaciones-personal.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EstadoLiquidacionBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoneda, formatFecha, formatQuincena } from '@/utils/formatters'
import type { LiquidacionPersonal } from '@/types/models'

export default function DetalleLiquidacionPersonalPage() {
  const { id } = useParams<{ id: string }>()
  const [liquidacion, setLiquidacion] = useState<LiquidacionPersonal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cambiando, setCambiando] = useState(false)

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getLiquidacionPersonal(id)
      setLiquidacion(data)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [id])

  const cambiarEstado = async (nuevoEstado: 'confirmada' | 'pagada') => {
    if (!liquidacion) return
    const msg = nuevoEstado === 'confirmada' ? '¿Confirmar esta liquidación?' : '¿Marcar como pagada?'
    if (!confirm(msg)) return
    setCambiando(true)
    try {
      await actualizarEstadoLiquidacionPersonal(liquidacion.id, nuevoEstado)
      await cargar()
    } finally { setCambiando(false) }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!liquidacion) return null

  const persona = (liquidacion.personal as any)
  const actividades = (liquidacion.actividades as any[]) ?? []

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={liquidacion.codigo}
        backHref="/liquidaciones/personal"
        actions={
          <div className="flex gap-2">
            {liquidacion.estado === 'borrador' && (
              <Button variant="outline" disabled={cambiando} onClick={() => cambiarEstado('confirmada')}>Confirmar</Button>
            )}
            {liquidacion.estado === 'confirmada' && (
              <Button disabled={cambiando} onClick={() => cambiarEstado('pagada')}>Marcar pagada</Button>
            )}
            <EstadoLiquidacionBadge estado={liquidacion.estado} />
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div><p className="text-muted-foreground text-xs">Personal</p><p className="font-medium">{persona?.apellido}, {persona?.nombre}</p></div>
          <div><p className="text-muted-foreground text-xs">Quincena</p><p className="font-medium">{formatQuincena(liquidacion.quincena)}</p></div>
          <div><p className="text-muted-foreground text-xs">Total unidades</p><p className="font-medium">{liquidacion.total_unidades}</p></div>
          <div><p className="text-muted-foreground text-xs">Total a pagar</p><p className="font-bold text-agro-green">{formatMoneda(liquidacion.total_monto ?? 0)}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Actividades incluidas</CardTitle></CardHeader>
        <CardContent>
          {actividades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividades.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-muted-foreground hover:bg-transparent">
                  <TableHead className="font-medium">Tipo</TableHead>
                  <TableHead className="font-medium">Lote</TableHead>
                  <TableHead className="font-medium">Fecha</TableHead>
                  <TableHead className="text-right font-medium">Uds</TableHead>
                  <TableHead className="text-right font-medium">Tarifa</TableHead>
                  <TableHead className="text-right font-medium">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actividades.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="capitalize">{a.tipo_actividad.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-muted-foreground">{a.lote?.codigo ?? '—'}</TableCell>
                    <TableCell>{formatFecha(a.fecha)}</TableCell>
                    <TableCell className="text-right">{a.cantidad_unidades}</TableCell>
                    <TableCell className="text-right">S/. {a.tarifa_unitaria}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoneda(a.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="text-right font-bold">Total:</TableCell>
                  <TableCell className="text-right font-bold text-agro-green">{formatMoneda(liquidacion.total_monto ?? 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
          {liquidacion.observaciones && <p className="text-sm text-muted-foreground mt-4">Obs: {liquidacion.observaciones}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
