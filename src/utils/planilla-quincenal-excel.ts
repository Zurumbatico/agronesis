import * as XLSX from 'xlsx-js-style'
import type { PlanillaQuincenal } from '@/types/models'
import { formatFecha } from './formatters'

export function generatePlanillaQuincenalExcel(planilla: PlanillaQuincenal): void {
  const detalles = planilla.detalles ?? []

  const rows: Array<Array<string | number>> = [
    ['Reporte Planilla Quincenal'],
    ['Periodo', `${formatFecha(planilla.periodo_inicio)} - ${formatFecha(planilla.periodo_fin)}`],
    ['Estado', planilla.estado],
    ['Total (S/)', planilla.total_monto],
    ['Fecha pago', planilla.fecha_pago ? formatFecha(planilla.fecha_pago) : '-'],
    ['Numero operacion', planilla.numero_operacion ?? '-'],
    ['Modalidad', formatModalidad(planilla.modalidad_pago)],
    ['Observaciones', planilla.observaciones ?? '-'],
    [],
    ['Colaborador', 'Pago recepcion', 'Pago seleccion', 'Monto empaquetado', 'Otros', 'Total'],
    ...detalles.map((d) => [
      d.colaborador ? `${d.colaborador.apellido}, ${d.colaborador.nombre}` : d.colaborador_id,
      d.pago_recepcion,
      d.pago_seleccion,
      d.monto_empaquetado,
      d.otros_montos,
      d.total,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 12 }]

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F4E3D' } },
    alignment: { horizontal: 'center' },
  }

  for (let c = 0; c <= 5; c++) {
    const ref = XLSX.utils.encode_cell({ r: 9, c })
    if (ws[ref]) ws[ref].s = headerStyle
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Planilla')
  XLSX.writeFile(wb, `planilla-${planilla.periodo_inicio}-${planilla.periodo_fin}.xlsx`)
}

function formatModalidad(modalidad: PlanillaQuincenal['modalidad_pago']): string {
  if (modalidad === 'transferencia') return 'Transferencia'
  if (modalidad === 'yape_plin') return 'Yape/Plin'
  if (modalidad === 'efectivo') return 'Efectivo'
  return '-'
}
