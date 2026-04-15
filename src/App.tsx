import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ROUTES, ENABLED_MODULES } from '@/constants'
import { useAuthInit } from '@/hooks/useAuthInit'
import { useAuthStore } from '@/store/auth.store'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'

import LoginPage from '@/features/auth/LoginPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import AgricultoresPage from '@/features/agricultores/AgricultoresPage'
import AcopiadoresPage from '@/features/acopiadores/AcopiadoresPage'
import ColaboradoresPage from '@/features/colaboradores/ColaboradoresPage'
import ProductosPage from '@/features/productos/ProductosPage'
import CentrosAcopioPage from '@/features/centros-acopio/CentrosAcopioPage'
import LotesPage from '@/features/lotes/LotesPage'
import LoteDetallePage from '@/features/lotes/LoteDetallePage'
import ClasificarLotePage from '@/features/lotes/ClasificarLotePage'
import HidroculizarPage from '@/features/lotes/HidroculizarPage'
import EmpaquetarLotePage from '@/features/lotes/EmpaquetarLotePage'
import DespacharLotePage from '@/features/lotes/DespacharLotePage'
import LiquidacionesAgriPage from '@/features/liquidaciones-agri/LiquidacionesAgriPage'
import NuevaLiquidacionAgriPage from '@/features/liquidaciones-agri/NuevaLiquidacionAgriPage'
import DetalleLiquidacionAgriPage from '@/features/liquidaciones-agri/DetalleLiquidacionAgriPage.tsx'
import CubetasPage from '@/features/cubetas/CubetasPage.tsx'
import ConfigPreciosPage from '@/features/admin/ConfigPreciosPage'
import PlanillasPage from '@/features/planillas/PlanillasPage'

function LoginRoute() {
  const { user, loading } = useAuthStore()

  if (loading) return null
  if (user) return <Navigate to={ROUTES.DASHBOARD} replace />
  return <LoginPage />
}

export default function App() {
  useAuthInit()

  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginRoute />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.AGRICULTORES} element={<AgricultoresPage />} />
            <Route path={ROUTES.ACOPIADORES} element={<AcopiadoresPage />} />
            <Route path={ROUTES.COLABORADORES} element={<ColaboradoresPage />} />
            <Route path={ROUTES.PRODUCTOS} element={<ProductosPage />} />
            <Route path={ROUTES.CENTROS_ACOPIO} element={<CentrosAcopioPage />} />
            <Route path={ROUTES.LOTES} element={<LotesPage />} />
            <Route path={ROUTES.LOTES_DETALLE} element={<LoteDetallePage />} />
            <Route path={ROUTES.CLASIFICACIONES} element={<ClasificarLotePage />} />
            <Route path={ROUTES.HIDROCULIZAR} element={<HidroculizarPage />} />
            <Route path={ROUTES.EMPAQUETAR} element={<EmpaquetarLotePage />} />
            <Route path={ROUTES.DESPACHOS} element={<DespacharLotePage />} />
            <Route
              path={ROUTES.CUBETAS}
              element={ENABLED_MODULES.CUBETAS ? <CubetasPage /> : <Navigate to={ROUTES.DASHBOARD} replace />}
            />
            <Route path={ROUTES.LIQUIDACIONES_AGRI} element={<LiquidacionesAgriPage />} />
            <Route path={ROUTES.LIQUIDACIONES_AGRI_NUEVA} element={<NuevaLiquidacionAgriPage />} />
            <Route path={ROUTES.LIQUIDACIONES_AGRI_DETALLE} element={<DetalleLiquidacionAgriPage />} />
            <Route path={ROUTES.PLANILLAS} element={<PlanillasPage />} />
            <Route path={ROUTES.CONFIG_PRECIOS} element={<ConfigPreciosPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
