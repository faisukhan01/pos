'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'
import { ReceiptText, Star, CalendarClock, Inbox, TrendingUp, BookOpenText, ChevronRight } from 'lucide-react'
import { useFetch } from '@/hooks/use-fetch'
import { cn } from '@/lib/utils'
import { formatMoney, formatDateTime, timeAgo, formatNumber } from '@/lib/format'
import { paymentLabel, paymentBadgeClass } from '@/lib/types'
import { QuickContact } from '@/components/pos/quick-contact'
import type { CustomerDto } from '@/lib/types'

interface HistorySale {
  id: string
  invoiceNo: string
  total: number
  paymentMethod: string
  status: string
  createdAt: string
  cashierName: string
  itemCount: number
  topItems: { name: string; quantity: number }[]
}

interface HistoryData {
  customer: { id: string; name: string; phone: string | null; email: string | null; address: string | null; createdAt: string } | null
  stats: { orders: number; totalSpent: number; avgBasket: number; balance: number; lastVisit: string | null }
  favoriteProducts: { name: string; quantity: number; revenue: number; times: number }[]
  paymentMix: { method: string; total: number; count: number }[]
  sales: HistorySale[]
}

interface CustomerHistoryDrawerProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  customer: Pick<CustomerDto, 'id' | 'name' | 'phone'> | null
  currencySymbol: string
  onOpenKhata?: () => void
}

export function CustomerHistoryDrawer({
  open,
  onOpenChange,
  customer,
  currencySymbol,
  onOpenKhata,
}: CustomerHistoryDrawerProps) {
  const url = open && customer ? `/api/customers/${customer.id}/history` : null
  const { data, loading, refetch } = useFetch<HistoryData>(url)

  // Silent refetch on open (and whenever the target customer changes while open)
  // so the balance and history are never stale after a payment or a new sale.
  // refetch is silent — it won't flip the loading state or flicker the drawer.
  useEffect(() => {
    if (open) refetch()
  }, [open, refetch])

  const stats = data?.stats
  const favMax = Math.max(1, ...(data?.favoriteProducts ?? []).map((f) => f.quantity))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-md" aria-describedby="cust-history-desc">
        <SheetHeader className="relative border-b bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
              {(customer?.name ?? '?').split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-[16px]">{customer?.name ?? 'Customer'}</SheetTitle>
              <SheetDescription id="cust-history-desc" className="truncate">
                {loading && !data ? 'Loading purchase history…' : `${stats?.orders ?? 0} orders · ${data?.customer?.address ?? 'Regular customer'}`}
              </SheetDescription>
            </div>
            {customer?.phone && (
              <QuickContact phone={customer.phone} name={customer.name} compact />
            )}
          </div>
        </SheetHeader>

        {loading && !data ? (
          <div className="space-y-3 p-5">
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : !data?.customer ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Customer not found.</p>
          </div>
        ) : (
          // Plain overflow-y container: Radix ScrollArea's table-layout wrapper
          // lets wide intrinsic content force horizontal overflow on mobile.
          <div className="h-[calc(100vh-120px)] min-w-0 overflow-y-auto scrollbar-thin">
            <div className="space-y-5 px-5 py-4 pb-10">
              {/* Stat trio — min-w-0 lets the grid shrink inside the flex column */}
              <div className="grid min-w-0 grid-cols-3 gap-2">
                <StatTile label="Total spent" value={formatMoney(stats?.totalSpent ?? 0, currencySymbol)} icon={TrendingUp} tone="primary" />
                <StatTile label="Avg basket" value={formatMoney(stats?.avgBasket ?? 0, currencySymbol)} icon={ReceiptText} />
                <StatTile
                  label="Udhaar"
                  value={formatMoney(Math.abs(stats?.balance ?? 0), currencySymbol)}
                  icon={BookOpenText}
                  tone={(stats?.balance ?? 0) > 0 ? 'warn' : 'teal'}
                />
              </div>

              {/* Last visit + khata shortcut */}
              <div className="flex flex-wrap items-center gap-2">
                {stats?.lastVisit && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11.5px] text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" /> Last visit {timeAgo(stats.lastVisit)}
                  </span>
                )}
                {(stats?.balance ?? 0) > 0 && onOpenKhata && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpenKhata}>
                    <BookOpenText className="h-3.5 w-3.5" /> Open udhaar book
                  </Button>
                )}
              </div>

              {/* Favorites */}
              {(data.favoriteProducts?.length ?? 0) > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Star className="h-3.5 w-3.5 text-amber-500" /> Buys most
                  </h3>
                  <ul className="space-y-1.5">
                    {data.favoriteProducts.map((f) => (
                      <li key={f.name} className="rounded-lg border bg-card px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[13px] font-medium">{f.name}</p>
                          <p className="shrink-0 font-price text-[12.5px] font-semibold tabular-nums">{formatMoney(f.revenue, currencySymbol)}</p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{ width: `${Math.max(8, (f.quantity / favMax) * 100)}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">×{formatNumber(f.quantity)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Payment mix */}
              {(data.paymentMix?.length ?? 0) > 0 && (
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">How they pay</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {data.paymentMix.map((p) => (
                      <Badge key={p.method} variant="outline" className={cn('gap-1 border-transparent font-medium', paymentBadgeClass(p.method))}>
                        {paymentLabel(p.method)} · {formatMoney(p.total, currencySymbol)}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              <Separator />

              {/* Purchase timeline */}
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Purchase history {data.sales.length >= 30 && <span className="font-normal normal-case tracking-normal">(latest 30)</span>}
                </h3>
                {data.sales.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
                    <ReceiptText className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-medium">No purchases yet</p>
                    <p className="max-w-[240px] text-xs text-muted-foreground">
                      Tag them at checkout and every bill will appear here.
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {data.sales.map((s) => (
                      <li key={s.id} className="group rounded-xl border bg-card px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]">
                        <div className="flex items-center gap-2">
                          <ReceiptText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                            {s.invoiceNo}
                            {s.status !== 'COMPLETED' && (
                              <span className="ml-1.5 text-[10px] font-bold uppercase text-destructive">{s.status.replace('_', ' ').toLowerCase()}</span>
                            )}
                          </p>
                          <span className="font-price text-[13px] font-bold tabular-nums">{formatMoney(s.total, currencySymbol)}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-6 text-[11px] text-muted-foreground">
                          <span>{formatDateTime(s.createdAt)}</span>
                          <span aria-hidden>·</span>
                          <Badge variant="outline" className={cn('h-4.5 gap-0 border-transparent px-1.5 py-0 text-[10px] font-medium', paymentBadgeClass(s.paymentMethod))}>
                            {paymentLabel(s.paymentMethod)}
                          </Badge>
                          <span aria-hidden>·</span>
                          <span>{s.itemCount} item{s.itemCount === 1 ? '' : 's'}</span>
                        </div>
                        {s.topItems.length > 0 && (
                          <p className="mt-1 truncate pl-6 text-[11px] text-muted-foreground/80">
                            {s.topItems.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'primary' | 'warn' | 'teal'
}) {
  return (
    <div className="rounded-xl border bg-card px-2.5 py-2.5">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-md',
            tone === 'primary' && 'bg-primary/10 text-primary',
            tone === 'warn' && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
            tone === 'teal' && 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
            tone === 'default' && 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-3 w-3" />
        </span>
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 truncate font-price text-[14.5px] font-bold tabular-nums tracking-tight">{value}</p>
    </div>
  )
}
