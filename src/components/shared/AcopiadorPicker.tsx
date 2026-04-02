import { useState, useMemo } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Agricultor, Acopiador } from '@/types/models'

interface AcopiadorPickerProps {
  value: string
  onChange: (value: string) => void
  agricultores: Agricultor[]
  acopiadores: Acopiador[]
  error?: boolean
}

export function AcopiadorPicker({ value, onChange, agricultores, acopiadores, error }: AcopiadorPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const label = useMemo(() => {
    if (!value) return null
    const colonIdx = value.indexOf(':')
    const type = value.slice(0, colonIdx)
    const id = value.slice(colonIdx + 1)
    if (type === 'agri') {
      const a = agricultores.find((x) => x.id === id)
      return a ? `${a.apellido}, ${a.nombre} (${a.codigo})` : null
    }
    if (type === 'aco') {
      const a = acopiadores.find((x) => x.id === id)
      return a ? `${a.apellido}, ${a.nombre} (${a.codigo})` : null
    }
    return null
  }, [value, agricultores, acopiadores])

  const q = search.toLowerCase()

  const filteredAgricultores = useMemo(
    () => agricultores.filter((a) => `${a.apellido} ${a.nombre} ${a.codigo}`.toLowerCase().includes(q)),
    [agricultores, q]
  )

  const filteredAcopiadores = useMemo(
    () => acopiadores.filter((a) => `${a.apellido} ${a.nombre} ${a.codigo}`.toLowerCase().includes(q)),
    [acopiadores, q]
  )
  const combinedResults = useMemo(() => {
    if (!q) return []
    const agriMatches = filteredAgricultores.map((a) => ({
      val: `agri:${a.id}`,
      label: `${a.apellido}, ${a.nombre} (${a.codigo})`,
      badge: 'Agricultor',
    }))
    const acoMatches = filteredAcopiadores.map((a) => ({
      val: `aco:${a.id}`,
      label: `${a.apellido}, ${a.nombre} (${a.codigo})`,
      badge: 'Acopiador',
    }))
    return [...agriMatches, ...acoMatches]
  }, [q, filteredAgricultores, filteredAcopiadores])

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            error ? 'border-destructive' : 'border-input',
            !label && 'text-muted-foreground'
          )}
        >
          <span className="line-clamp-1 text-left">{label ?? 'Seleccionar acopiador...'}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Buscador */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* Tabs */}
        {q ? (
          /* Búsqueda unificada: muestra resultados de ambas listas */
          <ul className="max-h-64 overflow-y-auto p-1">
            {combinedResults.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Sin resultados</li>
            ) : (
              combinedResults.map((item) => (
                <li key={item.val}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item.val)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <Check className={cn('h-4 w-4 shrink-0', value === item.val ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{item.badge}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : (
        <Tabs defaultValue="agricultores">
          <div className="px-2 pt-2">
            <TabsList>
              <TabsTrigger value="agricultores">
                Agricultores ({filteredAgricultores.length})
              </TabsTrigger>
              <TabsTrigger value="acopiadores">
                Acopiadores ({filteredAcopiadores.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="agricultores">
            <ul className="max-h-56 overflow-y-auto p-1">
              {filteredAgricultores.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">Sin resultados</li>
              ) : (
                filteredAgricultores.map((a) => {
                  const val = `agri:${a.id}`
                  return (
                    <li key={val}>
                      <button
                        type="button"
                        onClick={() => handleSelect(val)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <Check className={cn('h-4 w-4 shrink-0', value === val ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{a.apellido}, {a.nombre} ({a.codigo})</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </TabsContent>

          <TabsContent value="acopiadores">
            <ul className="max-h-56 overflow-y-auto p-1">
              {filteredAcopiadores.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">Sin resultados</li>
              ) : (
                filteredAcopiadores.map((a) => {
                  const val = `aco:${a.id}`
                  return (
                    <li key={val}>
                      <button
                        type="button"
                        onClick={() => handleSelect(val)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <Check className={cn('h-4 w-4 shrink-0', value === val ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{a.apellido}, {a.nombre} ({a.codigo})</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </TabsContent>
        </Tabs>
        )}
      </PopoverContent>
    </Popover>
  )
}
