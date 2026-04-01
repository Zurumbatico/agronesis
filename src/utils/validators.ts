import { z } from 'zod'

// ─────────────────────────────────────────────
// SCHEMAS DE VALIDACIÓN REUTILIZABLES
// ─────────────────────────────────────────────

export const dniSchema = z
  .string()
  .regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos')
  .optional()
  .or(z.literal(''))
  .transform((v) => v || null)

export const telefonoSchema = z
  .string()
  .regex(/^[0-9+\s()-]{7,15}$/, 'Teléfono inválido')
  .optional()
  .or(z.literal(''))
  .transform((v) => v || null)

export const codigoSchema = z
  .string()
  .min(2, 'El código debe tener al menos 2 caracteres')
  .max(30, 'El código no puede exceder 30 caracteres')
  .regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, guión o guión bajo')

export const nombreSchema = z
  .string()
  .min(2, 'Mínimo 2 caracteres')
  .max(100, 'Máximo 100 caracteres')

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

// ─────────────────────────────────────────────
// SCHEMAS DE ENTIDADES
// ─────────────────────────────────────────────

export const agricultorHectareaSchema = z.object({
  producto_id: z.string().uuid('Seleccione un producto'),
  hectareas: hectareasSchema,
})

export const agricultorSchema = z.object({
  codigo:    codigoSchema,
  nombre:    nombreSchema,
  apellido:  nombreSchema,
  dni:       dniSchema,
  telefono:  telefonoSchema,
  numero_cuenta: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')).transform((v) => v || null),
  fecha_alta: z.string().min(1, 'Ingrese la fecha de alta'),
  ubicacion: z.string().max(200).optional().or(z.literal('')).transform((v) => v || null),
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
  ubicacion:   z.string().max(200).optional().or(z.literal('')).transform((v) => v || null),
  responsable: z.string().max(100).optional().or(z.literal('')).transform((v) => v || null),
  estado:      z.enum(['activo', 'inactivo']),
})

export const loteSchema = z.object({
  codigo:           codigoSchema,
  agricultor_id:    z.string().uuid('Seleccione un agricultor'),
  producto_id:      z.string().uuid('Seleccione un producto'),
  centro_acopio_id: z.string().uuid('Seleccione un centro de acopio'),
  fecha_ingreso:    z.string().min(1, 'Ingrese la fecha de ingreso'),
  peso_bruto_kg:    pesoKgSchema,
  peso_tara_kg:     z
    .number({ message: 'Ingrese un número válido' })
    .nonnegative('La tara no puede ser negativa')
    .max(50000, 'Peso fuera de rango (máx 50,000 kg)'),
  peso_neto_kg:     pesoKgSchema,
  num_cubetas:      cantidadEnteraSchema,
  observaciones:    z.string().max(500).optional().or(z.literal('')).transform((v) => v || null),
}).superRefine((data, ctx) => {
  const pesoNetoEsperado = Number((data.peso_bruto_kg - data.peso_tara_kg).toFixed(2))

  if (data.peso_tara_kg >= data.peso_bruto_kg) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['peso_tara_kg'],
      message: 'La tara debe ser menor al peso bruto',
    })
  }

  if (Math.abs(data.peso_neto_kg - pesoNetoEsperado) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['peso_neto_kg'],
      message: 'El peso neto debe coincidir con peso bruto - tara',
    })
  }
})

export const clasificacionSchema = z.object({
  lote_id:             z.string().uuid(),
  categoria:           z.enum(['primera', 'segunda', 'descarte']),
  peso_kg:             pesoKgSchema,
  num_cajas:           cantidadEnteraSchema,
  fecha_clasificacion: z.string().min(1, 'Ingrese la fecha'),
  observaciones:       z.string().max(500).optional().or(z.literal('')).transform((v) => v || null),
})

export const despachoSchema = z.object({
  lote_id:              z.string().uuid(),
  fecha_despacho:       z.string().min(1, 'Ingrese la fecha'),
  destino:              z.enum(['exportacion', 'mercado_local', 'planta_proceso']),
  transportista:        z.string().max(100).optional().or(z.literal('')).transform((v) => v || null),
  placa_vehiculo:       z.string().max(20).optional().or(z.literal('')).transform((v) => v || null),
  num_cajas_despachadas: cantidadEnteraSchema,
  peso_neto_kg:         pesoKgSchema,
  precio_venta_kg:      precioSchema,
  observaciones:        z.string().max(500).optional().or(z.literal('')).transform((v) => v || null),
})

export const movimientoCubetaSchema = z.object({
  agricultor_id: z.string().uuid('Seleccione un agricultor'),
  lote_id:       z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  tipo:          z.enum(['entrega', 'devolucion']),
  cantidad:      cantidadEnteraSchema.refine((v) => v > 0, 'La cantidad debe ser mayor a 0'),
  fecha:         z.string().min(1, 'Ingrese la fecha'),
  observaciones: z.string().max(500).optional().or(z.literal('')).transform((v) => v || null),
})

// ─────────────────────────────────────────────
// TIPOS INFERIDOS DE SCHEMAS
// ─────────────────────────────────────────────
export type AgricultorFormData       = z.infer<typeof agricultorSchema>
export type ProductoFormData         = z.infer<typeof productoSchema>
export type CentroAcopioFormData     = z.infer<typeof centroAcopioSchema>
export type LoteFormData             = z.infer<typeof loteSchema>
export type ClasificacionFormData    = z.infer<typeof clasificacionSchema>
export type DespachoFormData         = z.infer<typeof despachoSchema>
export type MovimientoCubetaFormData = z.infer<typeof movimientoCubetaSchema>
