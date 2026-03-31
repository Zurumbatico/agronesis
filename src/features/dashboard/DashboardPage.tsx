import React, { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingPage } from '@/components/shared/Spinner'
import { formatPeso } from '@/utils/formatters'
import { Package, Boxes, TrendingUp, Users } from 'lucide-react'

interface StatCardProps { title: string; value: string; sub?: string; icon: React.ReactNode }
function StatCard({ title, value, sub, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-agro-green/10 flex items-center justify-center text-agro-green">
          {icon}
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{title}</p>
          <p className="font-bold text-xl">{value}</p>
          {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalLotes: 0, totalKgClasificado: 0, totalDespachos: 0, personalActivo: 0 })
  const [kgSemana, setKgSemana] = useState<{ semana: string; kg: number }[]>([])
  const [cajasPorProducto, setCajasPorProducto] = useState<{ producto: string; primera: number; segunda: number; descarte: number }[]>([])

  useEffect(() => {
    const cargar = async () => {
      try {
        // Stats básicos
        const [{ count: totalLotes }, { count: totalDespachos }, { count: personalActivo }] = await Promise.all([
          supabase.from('lotes').select('*', { count: 'exact', head: true }),
          supabase.from('despachos').select('*', { count: 'exact', head: true }),
          supabase.from('personal_campo').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
        ])

        const { data: clasificaciones } = await supabase
          .from('clasificaciones')
          .select('peso_kg, fecha_clasificacion, categoria, lote:lotes(producto:productos(nombre))')
          .order('fecha_clasificacion', { ascending: true })

        const totalKgClasificado = (clasificaciones ?? []).reduce((acc: number, c: any) => acc + (c.peso_kg ?? 0), 0)

        setStats({
          totalLotes: totalLotes ?? 0,
          totalKgClasificado,
          totalDespachos: totalDespachos ?? 0,
          personalActivo: personalActivo ?? 0,
        })

        // kg por semana (últimas 8 semanas)
        const semanas = new Map<string, number>()
        for (const c of (clasificaciones ?? []) as any[]) {
          if (!c.fecha_clasificacion) continue
          const d = new Date(c.fecha_clasificacion)
          const semana = `S${Math.ceil(d.getDate() / 7)}-${d.toLocaleString('es', { month: 'short' })}`
          semanas.set(semana, (semanas.get(semana) ?? 0) + (c.peso_kg ?? 0))
        }
        const kgArr = Array.from(semanas.entries())
          .slice(-8)
          .map(([semana, kg]) => ({ semana, kg: Math.round(kg * 100) / 100 }))
        setKgSemana(kgArr)

        // cajas por producto
        const prodMap = new Map<string, { primera: number; segunda: number; descarte: number }>()
        for (const c of (clasificaciones ?? []) as any[]) {
          const prod = (c.lote?.producto?.nombre ?? 'Sin producto')
          if (!prodMap.has(prod)) prodMap.set(prod, { primera: 0, segunda: 0, descarte: 0 })
          const entry = prodMap.get(prod)!
          if (c.categoria === 'primera') entry.primera += c.num_cajas ?? 0
          else if (c.categoria === 'segunda') entry.segunda += c.num_cajas ?? 0
          else if (c.categoria === 'descarte') entry.descarte += c.num_cajas ?? 0
        }
        setCajasPorProducto(Array.from(prodMap.entries()).map(([producto, v]) => ({ producto, ...v })))
      } catch (e) {
        console.error('Dashboard error:', e)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  if (loading) return <LoadingPage />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Resumen operativo de AGRONESIS DEL PERÚ</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Lotes registrados" value={String(stats.totalLotes)} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Kg clasificados" value={formatPeso(stats.totalKgClasificado)} icon={<Boxes className="h-5 w-5" />} />
        <StatCard title="Despachos realizados" value={String(stats.totalDespachos)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Personal activo" value={String(stats.personalActivo)} icon={<Users className="h-5 w-5" />} />
      </div>

      {/* Kg clasificados por semana */}
      {kgSemana.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Kg clasificados por semana</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={kgSemana} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="kgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={((v: unknown) => [`${Number(v ?? 0)} kg`, 'Peso']) as any} />
                <Area type="monotone" dataKey="kg" stroke="#22c55e" fill="url(#kgGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Cajas por producto y categoría */}
      {cajasPorProducto.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cajas clasificadas por producto</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cajasPorProducto} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="producto" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="primera" name="Primera" fill="#22c55e" />
                <Bar dataKey="segunda" name="Segunda" fill="#84cc16" />
                <Bar dataKey="descarte" name="Descarte" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {kgSemana.length === 0 && cajasPorProducto.length === 0 && (
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
            Registra lotes y clasificaciones para ver los gráficos del dashboard.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
