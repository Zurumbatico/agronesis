// ─────────────────────────────────────────────
// CONSTANTES DEL SISTEMA
// ─────────────────────────────────────────────

export const APP_NAME = 'AGRONESIS – Trazabilidad'
export const APP_VERSION = '1.0.0'

// Estados y sus etiquetas/colores para UI
export const ESTADO_LOTE_CONFIG = {
  ingresado:        { label: 'Ingresado',        color: 'bg-blue-100 text-blue-800' },
  en_clasificacion: { label: 'Clasificando',      color: 'bg-yellow-100 text-yellow-800' },
  clasificado:      { label: 'Clasificado',       color: 'bg-purple-100 text-purple-800' },
  en_despacho:      { label: 'En Despacho',       color: 'bg-orange-100 text-orange-800' },
  despachado:       { label: 'Despachado',        color: 'bg-green-100 text-green-800' },
  liquidado:        { label: 'Liquidado',         color: 'bg-gray-100 text-gray-700' },
} as const

export const ESTADO_LIQUIDACION_CONFIG = {
  borrador:   { label: 'Borrador',   color: 'bg-gray-100 text-gray-700' },
  confirmada: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  pagada:     { label: 'Pagada',     color: 'bg-green-100 text-green-800' },
} as const

export const TIPO_PRODUCTO_CONFIG = {
  holantao:   { label: 'Holantao'   },
  snow_peas:  { label: 'Snow Peas'  },
  otro:       { label: 'Otro'       },
} as const

export const TIPO_PERSONAL_CONFIG = {
  clasificador: { label: 'Clasificador' },
  cosechador:   { label: 'Cosechador'   },
  empacador:    { label: 'Empacador'    },
  supervisor:   { label: 'Supervisor'   },
} as const

export const CATEGORIA_CLASIFICACION_CONFIG = {
  primera:  { label: 'Primera',  color: 'bg-green-100 text-green-800' },
  segunda:  { label: 'Segunda',  color: 'bg-yellow-100 text-yellow-800' },
  descarte: { label: 'Descarte', color: 'bg-red-100 text-red-800' },
} as const

export const DESTINO_DESPACHO_CONFIG = {
  exportacion:    { label: 'Exportación'     },
  mercado_local:  { label: 'Mercado Local'   },
  planta_proceso: { label: 'Planta de Proceso' },
} as const

export const TIPO_MOVIMIENTO_CUBETA_CONFIG = {
  entrega:     { label: 'Entrega',     color: 'bg-blue-100 text-blue-800' },
  devolucion:  { label: 'Devolución',  color: 'bg-green-100 text-green-800' },
} as const

export const TIPO_ACTIVIDAD_CONFIG = {
  clasificacion: { label: 'Clasificación' },
  cosecha:       { label: 'Cosecha'       },
  empaque:       { label: 'Empaque'       },
  carga:         { label: 'Carga'         },
} as const

// Transiciones válidas de estado de lote
export const TRANSICIONES_LOTE: Record<string, string[]> = {
  ingresado:        ['en_clasificacion'],
  en_clasificacion: ['clasificado'],
  clasificado:      ['en_despacho'],
  en_despacho:      ['despachado'],
  despachado:       ['liquidado'],
  liquidado:        [],
}

// Rutas del sistema
export const ROUTES = {
  LOGIN:                    '/login',
  DASHBOARD:                '/',
  AGRICULTORES:             '/agricultores',
  AGRICULTORES_NUEVO:       '/agricultores/nuevo',
  AGRICULTORES_EDITAR:      '/agricultores/:id/editar',
  PRODUCTOS:                '/productos',
  PRODUCTOS_NUEVO:          '/productos/nuevo',
  PRODUCTOS_EDITAR:         '/productos/:id/editar',
  PERSONAL:                 '/personal',
  PERSONAL_NUEVO:           '/personal/nuevo',
  PERSONAL_EDITAR:          '/personal/:id/editar',
  CENTROS_ACOPIO:           '/centros-acopio',
  CENTROS_ACOPIO_NUEVO:     '/centros-acopio/nuevo',
  CENTROS_ACOPIO_EDITAR:    '/centros-acopio/:id/editar',
  LOTES:                     '/lotes',
  LOTES_NUEVO:              '/lotes/nuevo',
  LOTES_DETALLE:            '/lotes/:id',
  CLASIFICACIONES:          '/lotes/:id/clasificar',
  DESPACHOS:                '/lotes/:id/despachar',
  LIQUIDACIONES_AGRI:       '/liquidaciones/agricultores',
  LIQUIDACIONES_AGRI_NUEVA: '/liquidaciones/agricultores/nueva',
  LIQUIDACIONES_AGRI_DETALLE: '/liquidaciones/agricultores/:id',
  ACTIVIDADES_PERSONAL:     '/actividades-personal',
  LIQUIDACIONES_PERSONAL:   '/liquidaciones/personal',
  LIQUIDACIONES_PERSONAL_NUEVA: '/liquidaciones/personal/nueva',
  LIQUIDACIONES_PERSONAL_DETALLE: '/liquidaciones/personal/:id',
  CUBETAS:                  '/cubetas',
} as const
