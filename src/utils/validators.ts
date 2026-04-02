import { z } from 'zod'

// ─────────────────────────────────────────────
// SCHEMAS DE VALIDACIÓN REUTILIZABLES
// ─────────────────────────────────────────────

const nullableUpperTrim = (value: unknown) => {
  if (value === '' || value == null) return null
  if (typeof value !== 'string') return value
  const normalized = value.trim().toUpperCase()
  return normalized === '' ? null : normalized
}

export const dniSchema = z.preprocess(
  (v) => (v === '' || v == null ? null : (typeof v === 'string' ? v.trim() : v)),
  z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos').nullable()
)

export const telefonoSchema = z.preprocess(
  (v) => (v === '' || v == null ? null : (typeof v === 'string' ? v.trim() : v)),
  z.string().regex(/^[0-9+\s()-]{7,15}$/, 'Teléfono inválido').nullable()
)

export const codigoSchema = z
  .string()
  .trim()
  .min(2, 'El código debe tener al menos 2 caracteres')
  .max(30, 'El código no puede exceder 30 caracteres')
  .regex(/^[A-Z0-9_-]+$/, 'Solo letras, números, guión o guión bajo')
  .transform((value) => value.toUpperCase())

export const nombreSchema = z
  .string()
  .trim()
  .min(2, 'Mínimo 2 caracteres')
  .max(100, 'Máximo 100 caracteres')
  .transform((value) => value.toUpperCase())

export const pesoKgSchema = z
  .number({ message: 'Ingrese un número válido' })
  .positive('El peso debe ser mayor a 0')
  .max(50000, 'Peso fuera de rango (máx 50,000 kg)')

export const precioSchema = z
  .number({ message: 'Ingrese un número válido' })
  .nonnegative('El precio no puede ser negativo')
  .max(1000, 'Precio fuera de rango')

export const cantidadEnteraSchema = z
  .number({ message: 'Ingrese un número válido' })
  .int('Debe ser un número entero')
  .nonnegative('Debe ser mayor o igual a 0')

export const hectareasSchema = z
  .number({ message: 'Ingrese un número válido' })
  .positive('Las hectáreas deben ser mayores a 0')
  .max(10000, 'Hectáreas fuera de rango')

export const observacionesSchema = z
  .preprocess(nullableUpperTrim, z.string().max(500).nullable())

// ─────────────────────────────────────────────
// SCHEMAS DE ENTIDADES
// ─────────────────────────────────────────────

export const agricultorHectareaSchema = z.object({
  producto_id: z.string().uuid('Seleccione un producto'),
  hectareas: hectareasSchema,
})

export const agricultorSchema = z.object({
  codigo:    codigoSchema,
  nro_lote:  z.preprocess(nullableUpperTrim, z.string().max(20, 'Maximo 20 caracteres').nullable()),
  nombre:    nombreSchema,
  apellido:  nombreSchema,
  dni:       dniSchema,
  telefono:  telefonoSchema,
  numero_cuenta: z.preprocess(nullableUpperTrim, z.string().max(50, 'Maximo 50 caracteres').nullable()),
  fecha_alta: z.string().min(1, 'Ingrese la fecha de alta'),
  ubicacion: z.preprocess(nullableUpperTrim, z.string().max(200).nullable()),
  estado:    z.enum(['activo', 'inactivo']),
})

export const acopiadorSchema = z.object({
  codigo:    codigoSchema,
  nombre:    nombreSchema,
  apellido:  nombreSchema,
  dni:       dniSchema,
  telefono:  telefonoSchema,
  numero_cuenta: z.preprocess(nullableUpperTrim, z.string().max(50, 'Maximo 50 caracteres').nullable()),
  fecha_alta: z.string().min(1, 'Ingrese la fecha de alta'),
  ubicacion: z.preprocess(nullableUpperTrim, z.string().max(200).nullable()),
  estado:    z.enum(['activo', 'inactivo']),
})

export const productoSchema = z.object({
  codigo:          codigoSchema,
  nombre:          nombreSchema,
  variedad:        z.enum(['snow_peas', 'sugar']),
  calidad:         z.enum(['cat1', 'cat2']),
  tipo_produccion: z.enum(['organico', 'convencional']),
})

export const centroAcopioSchema = z.object({
  codigo:      codigoSchema,
  nombre:      nombreSchema,
  ubicacion:   z.preprocess(nullableUpperTrim, z.string().max(200).nullable()),
  responsable: z.preprocess(nullableUpperTrim, z.string().max(100).nullable()),
  estado:      z.enum(['activo', 'inactivo']),
})

export const loteSchema = z.object({
  codigo:             codigoSchema,
  agricultor_id:      z.string().uuid('Seleccione un agricultor'),
  acopiador_combined: z.string().min(1, 'Seleccione un acopiador'),
  producto_id:        z.string().uuid('Seleccione un producto'),
  centro_acopio_id:   z.string().uuid('Seleccione un centro de acopio'),
  fecha_ingreso:    z.string().min(1, 'Ingrese la fecha de ingreso'),
  peso_bruto_kg:    pesoKgSchema,
  peso_tara_kg:     z
    .number({ message: 'Ingrese un número válido' })
    .nonnegative('La tara no puede ser negativa')
    .max(50000, 'Peso fuera de rango (máx 50,000 kg)'),
  peso_neto_kg:     pesoKgSchema,
  num_cubetas:      cantidadEnteraSchema,
  observaciones:    observacionesSchema,
}).superRefine((data, ctx) => {
  const totalTara = Number((data.peso_tara_kg * data.num_cubetas).toFixed(2))
  const pesoNetoEsperado = Number((data.peso_bruto_kg - totalTara).toFixed(2))

  if (totalTara >= data.peso_bruto_kg) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['peso_tara_kg'],
      message: 'La tara total (tara × jabas) debe ser menor al peso bruto',
    })
  }

  if (Math.abs(data.peso_neto_kg - pesoNetoEsperado) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['peso_neto_kg'],
      message: 'El peso neto debe coincidir con peso bruto - (tara × jabas)',
    })
  }
}).transform((data) => {
  const colonIdx = data.acopiador_combined.indexOf(':')
  const type  = data.acopiador_combined.slice(0, colonIdx)
  const refId = data.acopiador_combined.slice(colonIdx + 1)
  return {
    ...data,
    acopiador_id:            type === 'aco'  ? refId : null,
    acopiador_agricultor_id: type === 'agri' ? refId : null,
  }
})

export const clasificacionSchema = z.object({
  lote_id:             z.string().uuid(),
  categoria:           z.enum(['primera', 'segunda', 'descarte']),
  peso_kg:             pesoKgSchema,
  num_cajas:           cantidadEnteraSchema,
  fecha_clasificacion: z.string().min(1, 'Ingrese la fecha'),
  observaciones:       observacionesSchema,
})

export const despachoSchema = z.object({
  lote_id:              z.string().uuid(),
  fecha_despacho:       z.string().min(1, 'Ingrese la fecha'),
  destino:              z.enum(['exportacion', 'mercado_local', 'planta_proceso']),
  transportista:        z.preprocess(nullableUpperTrim, z.string().max(100).nullable()),
  placa_vehiculo:       z.preprocess(nullableUpperTrim, z.string().max(20).nullable()),
  num_cajas_despachadas: cantidadEnteraSchema,
  peso_neto_kg:         pesoKgSchema,
  precio_venta_kg:      precioSchema,
  observaciones:        observacionesSchema,
})

export const movimientoCubetaSchema = z.object({
  agricultor_id: z.string().uuid('Seleccione un agricultor'),
  lote_id:       z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  tipo:          z.enum(['entrega', 'devolucion']),
  cantidad:      cantidadEnteraSchema.refine((v) => v > 0, 'La cantidad debe ser mayor a 0'),
  fecha:         z.string().min(1, 'Ingrese la fecha'),
  observaciones: observacionesSchema,
})

// ─────────────────────────────────────────────
// TIPOS INFERIDOS DE SCHEMAS
// ─────────────────────────────────────────────
export type AgricultorFormData       = z.infer<typeof agricultorSchema>
export type AcopiadorFormData        = z.infer<typeof acopiadorSchema>
export type ProductoFormData         = z.infer<typeof productoSchema>
export type CentroAcopioFormData     = z.infer<typeof centroAcopioSchema>
export type LoteFormData             = z.infer<typeof loteSchema>
export type ClasificacionFormData    = z.infer<typeof clasificacionSchema>
export type DespachoFormData         = z.infer<typeof despachoSchema>
export type MovimientoCubetaFormData = z.infer<typeof movimientoCubetaSchema>
