import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { LoadingPage } from '@/components/shared/Spinner'
import { ROUTES } from '@/constants'

export function ProtectedRoute() {
  const { user, loading } = useAuthStore()

  if (loading) return <LoadingPage message="Verificando sesión..." />
  if (!user) return <Navigate to={ROUTES.LOGIN} replace />

  return <Outlet />
}
