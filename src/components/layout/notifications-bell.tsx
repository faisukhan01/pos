'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, PackageX, TriangleAlert, CircleCheck, ArrowRight, PackagePlus, SlidersHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { api } from '@/lib/client-api'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ViewKey } from '@/components/layout/app-shell'

interface StockRow {
  id: string
  productId: string
  name: string
  stock: number
  minStock: number
  unit: string
}

/**
 * Header bell that surfaces low / out-of-stock alerts. Polls quietly every
 * minute and refreshes when opened; never toasts on background failures.
 */
export function NotificationsBell({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { user, activeBranchId, branches } = useAuthStore()
  const branchId = activeBranchId ?? branches[0]?.id
  const canSee = !!user && hasPermission(user.role, PERMISSIONS.INVENTORY_VIEW)
  const canRestock = !!user && hasPermission(user.role, PERMISSIONS.PURCHASES_MANAGE)
  const canAdjust = !!user && hasPermission(user.role, PERMISSIONS.INVENTORY_MANAGE)
  const [low, setLow] = useState<StockRow[]>([])
  const [out, setOut] = useState<StockRow[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    try {
      const [lo, ou] = await Promise.all([
        api.get<{ items: StockRow[] }>(`/api/inventory?filter=low&pageSize=100&branchId=${branchId}`),
        api.get<{ items: StockRow[] }>(`/api/inventory?filter=out&pageSize=100&branchId=${branchId}`),
      ])
      setLow(lo.items ?? [])
      setOut(ou.items ?? [])
    } catch {
      // passive indicator — swallow background refresh errors
    }
  }, [branchId])

  useEffect(() => {
    if (!canSee) return
    // Initial fetch deferred to a macrotask (keeps the effect body synchronous-safe);
    // then a quiet poll every minute keeps the badge fresh. Adjustments, purchases
    // and stock takes announce 'pos:stock-changed' for an instant refresh.
    const t0 = setTimeout(load, 0)
    const t = setInterval(load, 60_000)
    window.addEventListener('pos:stock-changed', load)
    return () => {
      clearTimeout(t0)
      clearInterval(t)
      window.removeEventListener('pos:stock-changed', load)
    }
  }, [load, canSee])

  if (!canSee) return null

  const total = low.length + out.length
  const anyOut = out.length > 0
  const preview = [...out, ...low].slice(0, 8)

  // Jump straight into the inventory adjust dialog for a specific product.
  const openAdjustIntent = (p: StockRow) => {
    setMenuOpen(false)
    sessionStorage.setItem(
      'pos-adjust-product',
      JSON.stringify({ productId: p.productId, name: p.name, stock: p.stock, minStock: p.minStock, unit: p.unit })
    )
    window.dispatchEvent(new CustomEvent('pos:adjust-intent'))
    onNavigate('inventory')
  }

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(o) => {
        setMenuOpen(o)
        if (o) load()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label={total > 0 ? `${total} stock alerts` : 'No stock alerts'}
        >
          <Bell className="h-[18px] w-[18px]" />
          {total > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
                anyOut && 'animate-pulse',
                anyOut ? 'bg-destructive' : 'bg-amber-500'
              )}
            >
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-[13px] font-semibold">Stock alerts</DropdownMenuLabel>
          {total > 0 && (
            <Badge
              variant="outline"
              className={cn('h-5 px-1.5 text-[10.5px]', anyOut ? 'border-destructive/40 text-destructive' : 'border-amber-300 text-amber-700 dark:text-amber-300')}
            >
              {total}
            </Badge>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        {total === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-300">
              <CircleCheck className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-medium">All stocked up</p>
            <p className="text-xs text-muted-foreground">Nothing needs your attention right now.</p>
          </div>
        ) : (
          <>
            <ul className="max-h-72 overflow-y-auto scrollbar-thin p-1.5">
              {preview.map((p) => {
                const row = (
                  <>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                          p.stock <= 0
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        )}
                      >
                        {p.stock <= 0 ? <PackageX className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium leading-tight">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.stock <= 0 ? 'Out of stock' : `Below minimum of ${formatNumber(p.minStock)} ${p.unit}`}
                        </p>
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className={cn('font-price text-[13px] font-semibold', p.stock <= 0 && 'text-destructive')}>
                        {formatNumber(p.stock)}
                      </span>
                      {canAdjust && (
                        <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </span>
                  </>
                )
                const rowClass = cn(
                  'group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  p.stock <= 0
                    ? 'hover:bg-destructive/[0.06]'
                    : 'hover:bg-amber-500/[0.07] dark:hover:bg-amber-500/[0.05]'
                )
                return (
                  <li key={p.id}>
                    {canAdjust ? (
                      <button
                        type="button"
                        className={cn(rowClass, 'cursor-pointer focus-visible:outline-2 focus-visible:outline-ring')}
                        onClick={() => openAdjustIntent(p)}
                        aria-label={`Adjust stock for ${p.name}`}
                        title="Click to adjust stock"
                      >
                        {row}
                      </button>
                    ) : (
                      <div className={rowClass}>{row}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            {canAdjust && total > 0 && (
              <p className="px-3 pb-1 text-[10.5px] text-muted-foreground">Tip: click an item to adjust its stock count.</p>
            )}
            {total > preview.length && (
              <p className="px-3 pb-1.5 text-[11px] text-muted-foreground">+ {total - preview.length} more in Inventory</p>
            )}
            <DropdownMenuSeparator className="my-0" />
            <div className={cn('grid gap-1 p-1.5', canRestock && 'grid-cols-2')}>
              {canRestock && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-between gap-1 bg-primary/[0.07] text-[12.5px] font-medium text-primary hover:bg-primary/15 hover:text-primary"
                  onClick={() => {
                    setMenuOpen(false)
                    sessionStorage.setItem('pos-restock-intent', 'low')
                    window.dispatchEvent(new CustomEvent('pos:restock-intent'))
                    onNavigate('purchases')
                  }}
                >
                  Restock PO <PackagePlus className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="justify-between text-[12.5px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setMenuOpen(false)
                  onNavigate('inventory')
                }}
              >
                Open inventory <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
