import * as XLSX from 'xlsx-js-style'
import type { LiquidacionAgri } from '@/types/models'
import { formatFecha } from './formatters'

export function generateLiquidacionAgriExcel(liquidacion: LiquidacionAgri): void {
  const agricultorNombre = liquidacion.agricultor
    ? `${liquidacion.agricultor.apellido}, ${liquidacion.agricultor.nombre}`
    : liquidacion.agricultor_id

  const detalles = liquidacion.detalles ?? []

  const rows: Array<Array<string | number>> = [
    ['Reporte de Liquidacion Agricultor'],
    ['Codigo', liquidacion.codigo],
    ['Agricultor', agricultorNombre],
    ['Periodo', `${formatFecha(liquidacion.fecha_inicio)} - ${formatFecha(liquidacion.fecha_fin)}`],
    ['Estado', liquidacion.estado],
    ['Total (S/)', liquidacion.total_monto],
    ['Fecha pago', liquidacion.fecha_pago ? formatFecha(liquidacion.fecha_pago) : '-'],
    ['Numero operacion', liquidacion.numero_operacion ?? '-'],
    ['Modalidad', formatModalidad(liquidacion.modalidad_pago)],
    [],
    ['Lote', 'Categoria', 'Peso (kg)', 'Precio (S/ kg)', 'Subtotal (S/)'],
    ...detalles.map((d) => [
      d.lote?.codigo ?? d.lote_id,
      d.categoria,
      d.peso_kg,
      d.precio_kg,
      d.subtotal,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F4E3D' } },
    alignment: { horizontal: 'center' },
  }

  for (let c = 0; c <= 4; c++) {
    const ref = XLSX.utils.encode_cell({ r: 10, c })
    if (ws[ref]) ws[ref].s = headerStyle
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Liquidacion')
  XLSX.writeFile(wb, `${liquidacion.codigo}.xlsx`)
}

function formatModalidad(modalidad: LiquidacionAgri['modalidad_pago']): string {
  if (modalidad === 'transferencia') return 'Transferencia'
  if (modalidad === 'yape_plin') return 'Yape/Plin'
  if (modalidad === 'efectivo') return 'Efectivo'
  return '-'
}
