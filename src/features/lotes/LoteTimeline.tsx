import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { ESTADO_LOTE_CONFIG } from '@/constants'
import type { EstadoLote } from '@/types/models'
import { cn } from '@/lib/utils'

const PASOS: EstadoLote[] = [
  'ingresado', 'en_clasificacion', 'clasificado',
  'en_despacho', 'despachado', 'liquidado',
]

interface LoteTimelineProps {
  estadoActual: EstadoLote
}

export function LoteTimeline({ estadoActual }: LoteTimelineProps) {
  const indexActual = PASOS.indexOf(estadoActual)

  return (
    <div className="flex flex-col gap-0">
      {PASOS.map((paso, i) => {
        const completado = i < indexActual
        const activo = i === indexActual
        const { label } = ESTADO_LOTE_CONFIG[paso]

        return (
          <div key={paso} className="flex items-start gap-3">
            {/* Ícono + línea vertical */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-colors',
                completado && 'bg-primary border-primary text-primary-foreground',
                activo && 'bg-agro-green border-agro-green text-white',
                !completado && !activo && 'border-border bg-background text-muted-foreground'
              )}>
                {completado ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : activo ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              {i < PASOS.length - 1 && (
                <div className={cn('w-0.5 h-6 mt-0.5', completado ? 'bg-primary' : 'bg-border')} />
              )}
            </div>

            {/* Etiqueta */}
            <div className="pt-1 pb-4">
              <p className={cn(
                'text-sm font-medium',
                activo && 'text-agro-green font-semibold',
                !completado && !activo && 'text-muted-foreground'
              )}>
                {label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
