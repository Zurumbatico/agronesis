import { VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import type { Lote, Despacho } from '@/types/models'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Día del año (1-365), con cero-padding a 3 dígitos */
function julianDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86_400_000)
  return String(dayOfYear).padStart(3, '0')
}

const EXPORTADOR_NOMBRE = 'AGRONESIS DEL PERU S.A.C'

function getExporterInitial(name: string): string {
  const match = name.trim().match(/[A-Za-z]/)
  return (match?.[0] ?? 'X').toUpperCase()
}

function getFieldLotCode(lote: Lote): string {
  const raw = lote.codigo_lote_agricultor ?? ''
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!clean) return 'SN'
  return clean
}

/**
 * Código de trazabilidad: G · YY · JJJ · DD · II · LL · H1 · E
 *
 * Ejemplo: G2508313CA01H1A
 *   G   = prefijo fijo
 *   25  = año actual/proceso (2 dígitos)
 *   083 = juliano de cosecha (campo del lote)
 *   13  = día de empaque (día de despacho)
 *   CA  = iniciales del agricultor (nombre[0] + apellido[0])
 *   ... = código de lote por agricultor completo (segmento lote de campo)
 *   H1  = tipo de producto (fijo por ahora)
 *   A   = inicial del nombre del exportador
 */
export function getTraceabilityCode(lote: Lote, despacho: Despacho): string {
  const despachoDate = new Date(despacho.fecha_despacho + 'T00:00:00')
  const year = String(despachoDate.getFullYear()).slice(-2)
  const packDay = String(despachoDate.getDate()).padStart(2, '0')
  const julian = julianDay(lote.fecha_cosecha)
  const initials = (
    (lote.agricultor?.nombre?.[0] ?? 'X') +
    (lote.agricultor?.apellido?.[0] ?? 'X')
  ).toUpperCase()
  const fieldLot = getFieldLotCode(lote)
  const productCode = 'H1'
  const exporterInitial = getExporterInitial(EXPORTADOR_NOMBRE)
  return `G${year}${julian}${packDay}${initials}${fieldLot}${productCode}${exporterInitial}`
}

export function printDespachoLabel(lote: Lote, despacho: Despacho): void {
  const variedad = lote.producto
    ? VARIEDAD_PRODUCTO_CONFIG[lote.producto.variedad].label.toUpperCase()
    : 'N/A'
  const code = getTraceabilityCode(lote, despacho)
  const exporterName = EXPORTADOR_NOMBRE

  const printWindow = window.open('', '_blank', 'width=640,height=500')
  if (!printWindow) return

  printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Etiqueta – ${escapeHtml(lote.codigo)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 landscape; margin: 0; }
    body {
      font-family: 'Arial Narrow', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.15;
      color: #000;
      background: #fff;
      width: 297mm;
      height: 210mm;
    }
    .label {
      width: 100%;
      height: 100%;
      border: 2px solid #000;
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    td {
      border: 1px solid #000;
      padding: 4px 6px;
      vertical-align: top;
      font-weight: 700;
      text-transform: uppercase;
    }
    .left { width: 43%; }
    .center { text-align: center; }
    .middle { vertical-align: middle; }
    .small { font-size: 11px; }
    .tiny { font-size: 10px; }
    .exporter {
      font-family: 'Arial Black', Arial, sans-serif;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 1px;
      line-height: 1.05;
      white-space: nowrap;
      margin: 2px 0 4px;
    }
    .trace {
      font-family: 'Courier New', monospace;
      font-size: 43px;
      font-weight: 800;
      line-height: 1;
      text-align: center;
      padding: 6px 0;
      letter-spacing: 0;
    }
    @media print {
      body { margin: 0; }
      .label { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="label">
    <table>
      <tr>
        <td class="left middle">
          <div class="small">EXPORTED BY:</div>
          <div class="exporter">${escapeHtml(exporterName)}</div>
          <div class="small">RUC:20602289029</div>
        </td>
        <td>
          <div>ADDRESS: AV. NICOLAS ARRIOLA NRO.2374 DPTO. 0 URB. EL PINO</div>
          <div>(FRENTE AL BANCO DE CREDITO) BARRANCA, JR LIMA NRO. 934,</div>
          <div>BARRANCA, BARRANCA.</div>
        </td>
      </tr>
      <tr>
        <td class="left middle">
          <div class="small">PACKING HOUSE:</div>
          <div>AGRONESIS DEL PERU S.A.C.</div>
        </td>
        <td>
          <div>ADDRESS: CAR, S/N NRO, S/N FND, FUNDO EL MILAGRO - YUNGAY - ANCASH</div>
        </td>
      </tr>
      <tr>
        <td colspan="2" class="middle">
          <table>
            <tr>
              <td>PRODUCT: HOLANTAO</td>
              <td>VARIETY: ${escapeHtml(variedad)}</td>
              <td>NET WEIGHT: 4.5 JGV (10LB)</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="left middle">GGN: 4069453556065</td>
        <td>
          <div>TRACEABILITY CODE:</div>
          <div class="trace">${escapeHtml(code)}</div>
        </td>
      </tr>
      <tr>
        <td class="center">PRODUCE OF PERU</td>
        <td class="center">KEEP IN REFRIGERATION&nbsp;&nbsp;&nbsp;&nbsp;2°C</td>
      </tr>
    </table>
  </div>
  <script>
    window.onload = function () {
      window.print();
      setTimeout(function () { window.close(); }, 500);
    };
  </script>
</body>
</html>`)
  printWindow.document.close()
}
