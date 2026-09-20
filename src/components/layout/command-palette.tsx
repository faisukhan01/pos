'use client'

import { useMemo } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { LogOut, Moon, Sun, TriangleAlert, PackageCheck } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { ViewKey } from './app-shell'

export interface PaletteItem {
  key: ViewKey
  label: string
  section: string
  icon: React.ComponentType<{ className?: string }>
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PaletteItem[]
  onNavigate: (v: ViewKey) => void
  dark: boolean
  onToggleTheme: () => void
  onSignOut: () => void
  showStock?: boolean
  branchId?: string | null
}

interface StockRow {
  productId: string
  name: string
  stock: number
  minStock: number
  unit: string
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  onNavigate,
  dark,
  onToggleTheme,
  onSignOut,
  showStock = false,
  branchId,
}: CommandPaletteProps) {
  const sections = items.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    ;(acc[item.section] ??= []).push(item)
    return acc
  }, {})

  // Live low-stock suggestions while the palette is open (permission-gated by showStock).
  // Fetch low AND out separately, like the bell — the low filter excludes stock=0 rows.
  const { data: lowData } = useFetch<{ items: StockRow[]; total: number }>(
    open && showStock && branchId ? `/api/inventory?filter=low&pageSize=6&branchId=${branchId}` : null
  )
  const { data: outData } = useFetch<{ items: StockRow[]; total: number }>(
    open && showStock && branchId ? `/api/inventory?filter=out&pageSize=6&branchId=${branchId}` : null
  )
  const stockAlerts = useMemo(() => {
    const out = outData?.items ?? []
    const low = (lowData?.items ?? []).filter((l) => !out.some((o) => o.productId === l.productId))
    const merged = [...out, ...low]
    const total = (outData?.total ?? 0) + (lowData?.total ?? 0)
    return { rows: merged.slice(0, 6), total }
  }, [lowData, outData])

  const run = (fn: () => void) => {
    onOpenChange(false)
    // Defer so focus returns to the app before the action changes the view.
    setTimeout(fn, 50)
  }

  // Same contract the bell uses: prefill the adjust dialog on the Inventory view.
  const adjustProduct = (p: StockRow) => {
    run(() => {
      sessionStorage.setItem(
        'pos-adjust-product',
        JSON.stringify({ productId: p.productId, name: p.name, stock: p.stock, minStock: p.minStock, unit: p.unit })
      )
      window.dispatchEvent(new CustomEvent('pos:adjust-intent'))
      onNavigate('inventory')
    })
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick actions"
      description="Jump to a page or run a command"
      className="[&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/70 [&_[cmdk-input]]:h-11 [&_[cmdk-item]]:py-2.5"
    >
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList className="max-h-[380px]">
        <CommandEmpty>No matching commands.</CommandEmpty>
        {showStock && (
          <>
            <CommandGroup
              heading={
                stockAlerts.rows.length > 0
                  ? `Stock alerts — ${stockAlerts.rows.length}${stockAlerts.total > stockAlerts.rows.length ? ` of ${stockAlerts.total}` : ''}`
                  : 'Stock alerts'
              }
            >
              {stockAlerts.rows.length === 0 ? (
                <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-muted-foreground">
                  <PackageCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  All stocked up
                </div>
              ) : (
                stockAlerts.rows.map((p) => (
                  <CommandItem
                    key={p.productId}
                    value={`restock ${p.name} low stock ${p.stock <= 0 ? 'out of stock' : ''}`}
                    onSelect={() => adjustProduct(p)}
                    className="data-[selected=true]:bg-amber-500/[0.08]"
                  >
                    <TriangleAlert className={p.stock <= 0 ? 'text-destructive' : 'text-amber-500'} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{p.name}</span>
                    <span className={`shrink-0 text-[11.5px] tabular-nums ${p.stock <= 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                      {p.stock <= 0 ? 'Out of stock' : `${formatNumber(p.stock)} ${p.unit} left`}
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {Object.entries(sections).map(([section, sectionItems], i) => (
          <div key={section}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={section}>
              {sectionItems.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem key={item.key} value={`${item.label} ${item.section}`} onSelect={() => run(() => onNavigate(item.key))}>
                    <Icon className="opacity-70" />
                    <span className="text-[13.5px]">{item.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </div>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="toggle theme dark light" onSelect={() => run(onToggleTheme)}>
            {dark ? <Sun className="opacity-70" /> : <Moon className="opacity-70" />}
            <span className="text-[13.5px]">{dark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
          </CommandItem>
          <CommandItem value="sign out logout" onSelect={() => run(onSignOut)}>
            <LogOut className="opacity-70" />
            <span className="text-[13.5px]">Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
