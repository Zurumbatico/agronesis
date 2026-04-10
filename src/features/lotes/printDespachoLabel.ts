import { CALIDAD_PRODUCTO_CONFIG, TIPO_DESPACHO_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
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

/** Código de producto: H1/H2 (Snow Peas cat1/cat2) ó S1/S2 (Sugar) */
function getProductCode(lote: Lote): string {
  if (!lote.producto) return 'XX'
  const typeChar = lote.producto.variedad === 'snow_peas' ? 'H' : 'S'
  const catNum = lote.producto.calidad === 'cat1' ? '1' : '2'
  return typeChar + catNum
}

/**
 * Código de trazabilidad: YY · D · JJJ · II · LL · TT
 *
 * Ejemplo: 253083CA01H1
 *   25  = año de despacho (2 dígitos)
 *   3   = último dígito del día de despacho
 *   083 = día juliano de cosecha (lote.fecha_ingreso)
 *   CA  = iniciales del agricultor (nombre[0] + apellido[0])
 *   01  = secuencial del lote (últimos 2 dígitos de lote.codigo)
 *   H1  = tipo/calidad de producto (H=Snow Peas, S=Sugar; 1=Cat1, 2=Cat2)
 */
export function getTraceabilityCode(lote: Lote, despacho: Despacho): string {
  const despachoDate = new Date(despacho.fecha_despacho + 'T00:00:00')
  const year = String(despachoDate.getFullYear()).slice(-2)
  const packDay = String(despachoDate.getDate()).slice(-1)
  const julian = julianDay(lote.fecha_ingreso)
  const initials = (
    (lote.agricultor?.nombre?.[0] ?? 'X') +
    (lote.agricultor?.apellido?.[0] ?? 'X')
  ).toUpperCase()
  const seqMatch = lote.codigo.match(/(\d+)$/)
  const fieldLot = seqMatch ? seqMatch[1].slice(-2).padStart(2, '0') : '00'
  const productCode = getProductCode(lote)
  return `${year}${packDay}${julian}${initials}${fieldLot}${productCode}`
}

function kgToLb(kg: number): string {
  return (kg * 2.20462).toFixed(1)
}

export function printDespachoLabel(lote: Lote, despacho: Despacho): void {
  const productName = lote.producto?.nombre?.toUpperCase() ?? 'N/A'
  const variedad = lote.producto ? VARIEDAD_PRODUCTO_CONFIG[lote.producto.variedad].label : 'N/A'
  const calidad = lote.producto ? CALIDAD_PRODUCTO_CONFIG[lote.producto.calidad].label : 'N/A'
  const tipoDespachoLabel = TIPO_DESPACHO_CONFIG[despacho.tipo_despacho]?.label ?? despacho.tipo_despacho

  const pesoNeto =
    despacho.num_cajas_despachadas > 0
      ? despacho.peso_neto_kg / despacho.num_cajas_despachadas
      : despacho.peso_neto_kg
  const pesoNetoLb = kgToLb(pesoNeto)

  const agricultor = lote.agricultor
    ? `${lote.agricultor.apellido}, ${lote.agricultor.nombre}`
    : 'N/A'
  const ggn = lote.agricultor?.ggn ?? ''
  const senasa = despacho.numero_senasa ?? ''
  const centroAcopio = lote.centro_acopio?.nombre ?? 'N/A'
  const code = getTraceabilityCode(lote, despacho)

  const printWindow = window.open('', '_blank', 'width=640,height=500')
  if (!printWindow) return

  printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Etiqueta – ${escapeHtml(lote.codigo)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 13pt;
      line-height: 1.6;
      color: #000;
      width: 100vw;
      height: 100vh;
      padding: 12mm;
    }
    .label {
      border: 3px solid #000;
      width: 100%;
      height: 100%;
      padding: 10mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .section { margin-bottom: 6mm; }
    .bold { font-weight: bold; }
    .divider { border-top: 1.5px solid #000; margin: 5mm 0; }
    .row { display: flex; gap: 12mm; flex-wrap: wrap; align-items: baseline; }
    .trace-code {
      font-family: 'Courier New', monospace;
      font-size: 22pt;
      font-weight: bold;
      letter-spacing: 3px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      font-size: 13pt;
      font-weight: bold;
      border-top: 1.5px solid #000;
      padding-top: 5mm;
    }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="label">
    <div>
      <div class="section">
        <span class="bold">CENTRO DE ACOPIO:</span> ${escapeHtml(centroAcopio)}
      </div>

      <div class="section">
        <span class="bold">AGRICULTOR:</span> ${escapeHtml(agricultor)}${ggn ? ` &nbsp;·&nbsp; <span class="bold">GGN:</span> ${escapeHtml(ggn)}` : ''}
      </div>

      <div class="divider"></div>

      <div class="row section">
        <span><span class="bold">PRODUCTO:</span> ${escapeHtml(productName)}</span>
        <span><span class="bold">VARIEDAD:</span> ${escapeHtml(variedad)}</span>
        <span><span class="bold">CALIDAD:</span> ${escapeHtml(calidad)}</span>
      </div>

      <div class="row section">
        <span><span class="bold">CAJAS:</span> ${despacho.num_cajas_despachadas}</span>
        <span><span class="bold">PESO TOTAL:</span> ${despacho.peso_neto_kg.toFixed(2)} KG</span>
        <span><span class="bold">PESO/CAJA:</span> ${pesoNeto.toFixed(2)} KG (${pesoNetoLb} LB)</span>
        <span><span class="bold">VÍA:</span> ${escapeHtml(tipoDespachoLabel)}</span>
      </div>

      <div class="divider"></div>

      <div class="section">
        <div><span class="bold">LOTE:</span> ${escapeHtml(lote.codigo)}</div>
        <div style="margin-top:4mm"><span class="bold">CÓD. TRAZABILIDAD:</span></div>
        <div style="margin-top:2mm"><span class="trace-code">${escapeHtml(code)}</span></div>
      </div>

      ${senasa ? `<div class="section"><span class="bold">SENASA:</span> ${escapeHtml(senasa)}</div>` : ''}
    </div>

    <div class="footer">
      <span>PRODUCE OF PERU</span>
      <span>KEEP IN REFRIGERATION</span>
      <span>2°C</span>
    </div>
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
