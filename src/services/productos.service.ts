import { supabase } from '@/lib/supabase'
import type { Producto, ProductoInsert, ProductoUpdate } from '@/types/models'

const TABLE = 'productos' as const

export async function getProductos(): Promise<Producto[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Producto[]
}

export async function getProducto(id: string): Promise<Producto> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as Producto
}

export async function createProducto(input: ProductoInsert, userId: string): Promise<Producto> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Producto
}

export async function updateProducto(id: string, input: ProductoUpdate): Promise<Producto> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Producto
}

export async function deleteProducto(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
