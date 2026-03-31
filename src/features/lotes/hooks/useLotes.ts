import { useState, useEffect, useCallback } from 'react'
import { getLotes, createLote, updateLote, actualizarEstadoLote } from '@/services/lotes.service'
import { useAuthStore } from '@/store/auth.store'
import type { Lote, EstadoLote } from '@/types/models'
import type { LoteFormData } from '@/utils/validators'

export function useLotes() {
  const { user } = useAuthStore()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try { setLotes(await getLotes()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const crear = async (data: LoteFormData) => {
    if (!user) throw new Error('No autenticado')
    const nuevo = await createLote(data as Parameters<typeof createLote>[0], user.id)
    setLotes((prev) => [nuevo, ...prev])
    return nuevo
  }

  const actualizar = async (id: string, data: Partial<LoteFormData>) => {
    const actualizado = await updateLote(id, data as Parameters<typeof updateLote>[1])
    setLotes((prev) => prev.map((l) => (l.id === id ? actualizado : l)))
    return actualizado
  }

  const cambiarEstado = async (id: string, estado: EstadoLote) => {
    const actualizado = await actualizarEstadoLote(id, estado)
    setLotes((prev) => prev.map((l) => (l.id === id ? actualizado : l)))
    return actualizado
  }

  return { lotes, loading, error, reload, crear, actualizar, cambiarEstado }
}
