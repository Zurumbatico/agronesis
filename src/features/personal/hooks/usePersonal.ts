import { useState, useEffect, useCallback } from 'react'
import { getPersonalCampo, createPersonal, updatePersonal, deletePersonal } from '@/services/personal.service'
import { useAuthStore } from '@/store/auth.store'
import type { PersonalCampo } from '@/types/models'
import type { PersonalCampoFormData } from '@/utils/validators'

export function usePersonal() {
  const { user } = useAuthStore()
  const [personal, setPersonal] = useState<PersonalCampo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try { setPersonal(await getPersonalCampo()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const crear = async (data: PersonalCampoFormData) => {
    if (!user) throw new Error('No autenticado')
    const nuevo = await createPersonal(data as Parameters<typeof createPersonal>[0], user.id)
    setPersonal((prev) => [nuevo, ...prev])
    return nuevo
  }

  const actualizar = async (id: string, data: PersonalCampoFormData) => {
    const actualizado = await updatePersonal(id, data)
    setPersonal((prev) => prev.map((p) => (p.id === id ? actualizado : p)))
    return actualizado
  }

  const eliminar = async (id: string) => {
    await deletePersonal(id)
    setPersonal((prev) => prev.filter((p) => p.id !== id))
  }

  return { personal, loading, error, reload, crear, actualizar, eliminar }
}
