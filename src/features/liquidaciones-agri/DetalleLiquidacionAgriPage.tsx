import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getLiquidacionAgri, actualizarEstadoLiquidacionAgri, pagarLiquidacionAgri } from '@/services/liquidaciones-agri.service'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EstadoLiquidacionBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatFecha, formatMoneda, formatPeso } from '@/utils/formatters'
import type { LiquidacionAgri } from '@/types/models'

export default function DetalleLiquidacionAgriPage() {
  const { id } = useParams<{ id: string }>()
  const [liquidacion, setLiquidacion] = useState<LiquidacionAgri | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cambiando, setCambiando] = useState(false)

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getLiquidacionAgri(id)
      setLiquidacion(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  const cambiarEstado = async (nuevoEstado: 'confirmada' | 'pagada') => {
    if (!liquidacion) return

    const msg = nuevoEstado === 'confirmada'
      ? '¿Confirmar esta liquidación?'
      : '¿Marcar como pagada? Esto marcará todos los lotes asociados como LIQUIDADO.'

    if (!confirm(msg)) return

    setCambiando(true)
    try {
      if (nuevoEstado === 'pagada') {
        // Marca la liquidación como pagada y actualiza los lotes a 'liquidado'
        await pagarLiquidacionAgri(liquidacion.id)
      } else {
        await actualizarEstadoLiquidacionAgri(liquidacion.id, nuevoEstado)
      }
      await cargar()
    } finally {
      setCambiando(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!liquidacion) return null

  const agri = liquidacion.agricultor as any
  const detalles = (liquidacion.detalles as any[]) ?? []

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={liquidacion.codigo}
        backHref="/liquidaciones/agricultores"
        actions={
          <div className="flex gap-2">
            {liquidacion.estado === 'borrador' && (
              <Button variant="outline" disabled={cambiando} onClick={() => cambiarEstado('confirmada')}>
                Confirmar
              </Button>
            )}
            {liquidacion.estado === 'confirmada' && (
              <Button disabled={cambiando} onClick={() => cambiarEstado('pagada')}>
                Marcar pagada
              </Button>
            )}
            <EstadoLiquidacionBadge estado={liquidacion.estado} />
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Agricultor</p>
            <p className="font-medium">{agri?.apellido}, {agri?.nombre}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Periodo</p>
            <p className="font-medium">{formatFecha(liquidacion.fecha_inicio)} - {formatFecha(liquidacion.fecha_fin)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total a pagar</p>
            <p className="font-bold text-agro-green">{formatMoneda(liquidacion.total_monto ?? 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Fecha creación</p>
            <p className="font-medium">{formatFecha(liquidacion.created_at)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalles de producción</CardTitle>
        </CardHeader>
        <CardContent>
          {detalles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin detalles.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-muted-foreground hover:bg-transparent">
                  <TableHead className="font-medium">Lote</TableHead>
                  <TableHead className="font-medium">Categoría</TableHead>
                  <TableHead className="text-right font-medium">Peso</TableHead>
                  <TableHead className="text-right font-medium">Precio</TableHead>
                  <TableHead className="text-right font-medium">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalles.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.lote?.codigo ?? d.lote_id}</TableCell>
                    <TableCell className="capitalize">{d.categoria}</TableCell>
                    <TableCell className="text-right">{formatPeso(d.peso_kg)}</TableCell>
                    <TableCell className="text-right">S/. {d.precio_kg}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoneda(d.subtotal)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="text-right font-bold">Total:</TableCell>
                  <TableCell className="text-right font-bold text-agro-green">{formatMoneda(liquidacion.total_monto ?? 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          {liquidacion.observaciones && (
            <p className="text-sm text-muted-foreground mt-4">Obs: {liquidacion.observaciones}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
