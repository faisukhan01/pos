'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  Banknote,
  ReceiptText,
  TrendingUp,
  Package,
  PackageX,
  ArrowUpRight,
  Wallet,
  ScanBarcode,
  Plus,
  ChartColumn,
  Vault,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFetch } from '@/hooks/use-fetch'
import { useCountUp } from '@/hooks/use-count-up'
import { useAuthStore } from '@/lib/store'
import { formatMoney, formatTime, timeAgo, formatNumber } from '@/lib/format'
import { paymentLabel, type DashboardData, type ShiftsSummary } from '@/lib/types'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import type { ViewKey } from '@/components/layout/app-shell'

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
] as const

export function DashboardView({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { user, activeBranchId, branches, settings } = useAuthStore()
  const branchId = activeBranchId ?? branches[0]?.id
  const symbol = settings?.currencySymbol ?? 'Rs'
  const [days, setDays] = useState<number>(() => {
    const saved = Number(localStorage.getItem('pos-dashboard-range'))
    return RANGES.some((r) => r.days === saved) ? saved : 1
  })
  const { data, loading, error } = useFetch<DashboardData>(
    branchId ? `/api/dashboard?branchId=${branchId}&days=${days}` : null
  )
  const canSeeDrawer = !!user && hasPermission(user.role, PERMISSIONS.SHIFTS_VIEW)
  const { data: shiftData } = useFetch<ShiftsSummary>(
    canSeeDrawer && branchId ? `/api/shifts?branchId=${branchId}` : null
  )
  const activeShift = shiftData?.active ?? null

  useEffect(() => {
    localStorage.setItem('pos-dashboard-range', String(days))
  }, [days])

  const rangeLabel = days === 1 ? 'today' : `last ${days} days`
  const salesChart = useMemo(() => data?.salesSeries ?? [], [data])
  const payTotal = useMemo(
    () => (data?.paymentBreakdown ?? []).reduce((s, p) => s + p.total, 0),
    [data]
  )

  // KPI count-up — animates from the previous value whenever data lands (incl. range switches).
  const salesNum = useCountUp(data?.rangeSales ?? 0)
  const avgSaleNum = useCountUp(data?.avgSale ?? 0)
  const txnsNum = useCountUp(data?.rangeTransactions ?? 0)
  const stockAlertsNum = useCountUp((data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0))
  const stockAlertsValue = (data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0)

  const changeStr =
    data?.salesChange == null ? null : `${data.salesChange >= 0 ? '+' : ''}${Math.round(data.salesChange)}%`

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive/30">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Range switcher */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          Showing <span className="font-medium text-foreground">{rangeLabel}</span>
        </p>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5" role="tablist" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r.days}
              role="tab"
              aria-selected={days === r.days}
              onClick={() => setDays(r.days)}
              className={cn(
                'h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring sm:px-3',
                days === r.days
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)
          : (
            <>
              <StatCard
                icon={Banknote}
                label={days === 1 ? 'Sales today' : `Sales — ${rangeLabel}`}
                value={formatMoney(Math.round(salesNum), symbol)}
                hint={
                  changeStr ? (
                    <>
                      {formatNumber(data?.rangeTransactions ?? 0)} txns ·{' '}
                      <span className={cn('font-medium', (data?.salesChange ?? 0) >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-destructive')}>
                        {changeStr} vs prev
                      </span>
                    </>
                  ) : (
                    `${formatNumber(data?.rangeTransactions ?? 0)} transactions`
                  )
                }
                tone="primary"
              />
              <StatCard
                icon={TrendingUp}
                label="Average sale"
                value={formatMoney(avgSaleNum, symbol)}
                hint="per transaction"
              />
              <StatCard
                icon={ReceiptText}
                label="Transactions"
                value={formatNumber(Math.round(txnsNum))}
                hint={days === 1 ? 'bills rung up today' : `bills rung up · ${rangeLabel}`}
              />
              <StatCard
                icon={(data?.outOfStockCount ?? 0) > 0 ? PackageX : Package}
                label="Stock alerts"
                value={`${Math.round(stockAlertsNum)}`}
                hint={`${data?.lowStockCount ?? 0} low · ${data?.outOfStockCount ?? 0} out of stock`}
                tone={stockAlertsValue > 0 ? 'warn' : 'default'}
                action={
                  stockAlertsValue > 0
                    ? { label: 'Review', onClick: () => onNavigate('inventory') }
                    : undefined
                }
              />
            </>
          )}
      </div>

      {/* Cash drawer status strip */}
      {canSeeDrawer && (
        <button
          onClick={() => onNavigate('shifts')}
          className={cn(
            'group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
            activeShift
              ? 'border-primary/30 bg-primary/[0.06] hover:bg-primary/10'
              : 'border-dashed bg-card hover:bg-accent/60'
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              activeShift ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            <Vault className="h-4.5 w-4.5" />
          </span>
          {activeShift ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Drawer open · cash expected {formatMoney(activeShift.aggregates?.cashExpected ?? 0, symbol)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Opened by {activeShift.openedByName} at {formatTime(activeShift.openedAt)} · {formatNumber(activeShift.aggregates?.transactions ?? 0)} transactions so far
                </p>
              </div>
              <Badge variant="outline" className="hidden shrink-0 border-primary/40 text-primary sm:inline-flex">Count &amp; close →</Badge>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:hidden" />
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">No drawer is open right now</p>
                <p className="truncate text-xs text-muted-foreground">Open a shift with a starting float to track every rupee in the till.</p>
              </div>
              <Badge variant="outline" className="hidden shrink-0 border-amber-300 text-amber-700 dark:text-amber-300 sm:inline-flex">Open drawer →</Badge>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:hidden" />
            </>
          )}
        </button>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-2" onClick={() => onNavigate('pos')}>
          <ScanBarcode className="h-4 w-4" /> New sale
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => onNavigate('products')}>
          <Plus className="h-4 w-4" /> Add product
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => onNavigate('expenses')}>
          <Wallet className="h-4 w-4" /> Record expense
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => onNavigate('reports')}>
          <ChartColumn className="h-4 w-4" /> Reports
        </Button>
        {canSeeDrawer && (
          <Button size="sm" variant="outline" className="gap-2" onClick={() => onNavigate('shifts')}>
            <Vault className="h-4 w-4" /> Cash drawer
          </Button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Sales trend */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] tracking-tight">
              Sales — {days === 1 ? 'today, by hour' : rangeLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading && !data ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChart} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={days === 1 ? 2 : 'preserveStartEnd'}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <ChartTooltip
                    formatter={(value: number, _name: string, entry: { payload?: { count?: number } }) => [
                      `${formatMoney(value, symbol)} · ${entry?.payload?.count ?? 0} sales`,
                      'Sales',
                    ]}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12.5 }}
                  />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[5, 5, 0, 0]} maxBarSize={days === 1 ? 22 : 34} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment mix */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] tracking-tight">Payments — {rangeLabel}</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading && !data ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : (data?.paymentBreakdown?.length ?? 0) === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No sales {rangeLabel} yet.
              </p>
            ) : (
              <div className="relative h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.paymentBreakdown.map((p) => ({ ...p, label: paymentLabel(p.method) }))}
                      dataKey="total"
                      nameKey="label"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {data?.paymentBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      formatter={(value: number) => formatMoney(value, symbol)}
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12.5 }}
                    />
                    <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 12 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center total — sits inside the donut hole */}
                <div className="pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Total</p>
                  <p className="font-price text-lg font-semibold tracking-tight">{formatMoney(Math.round(payTotal), symbol)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Top products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] tracking-tight">Top products — {rangeLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
            ) : (data?.topProducts?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No sales recorded {rangeLabel} yet.</p>
            ) : (
              <ol className="space-y-2">
                {data?.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    <span className="text-right text-xs text-muted-foreground">
                      {formatNumber(p.quantity)} sold
                      <span className="block font-price font-semibold text-foreground">{formatMoney(p.revenue, symbol)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[15px] tracking-tight">Needs restocking</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigate('inventory')}>
              All stock <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
            ) : (data?.lowStock?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Everything is well stocked.</p>
            ) : (
              <ul className="space-y-2">
                {data?.lowStock.slice(0, 6).map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 transition-colors',
                      p.stock <= 0
                        ? 'border-destructive/25 bg-destructive/[0.04] hover:bg-destructive/[0.07]'
                        : 'hover:border-amber-300/60 hover:bg-amber-500/[0.04] dark:hover:border-amber-300/30'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.barcode ?? '—'}</p>
                    </div>
                    <Badge variant={p.stock <= 0 ? 'destructive' : 'outline'} className={p.stock <= 0 ? '' : 'border-amber-300 text-amber-700 dark:text-amber-300'}>
                      {p.stock <= 0 ? 'Out of stock' : `${formatNumber(p.stock)} left`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[15px] tracking-tight">Recent sales</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigate('sales')}>
              All sales <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
            ) : (data?.recentSales?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No sales yet — open the till and make the first one.</p>
            ) : (
              <ul className="space-y-2">
                {data?.recentSales.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {s.invoiceNo}
                        {s.status !== 'COMPLETED' && (
                          <span className="ml-1.5 text-[10px] font-semibold uppercase text-destructive">{s.status.replace('_', ' ').toLowerCase()}</span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {s.customerName} · {formatTime(s.createdAt)} · {timeAgo(s.createdAt)}
                      </p>
                    </div>
                    <span className="font-price text-sm font-semibold">{formatMoney(s.total, symbol)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Money in/out summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
        <Card className="card-lift">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">Purchases {rangeLabel} (stock coming in)</p>
              <p className="font-price text-lg font-semibold">{formatMoney(data?.rangePurchases ?? 0, symbol)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-lift">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">Expenses {rangeLabel} (money going out)</p>
              <p className="font-price text-lg font-semibold">{formatMoney(data?.rangeExpenses ?? 0, symbol)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint: React.ReactNode
  tone?: 'default' | 'primary' | 'warn'
  action?: { label: string; onClick: () => void }
}) {
  return (
    <Card className="card-lift">
      <CardContent className="flex items-start gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10',
            tone === 'primary' && 'bg-primary/10 text-primary',
            tone === 'warn' && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
            tone === 'default' && 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="font-price truncate text-[17px] font-semibold tracking-tight sm:text-xl">{value}</p>
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
        {action && (
          <Button variant="ghost" size="sm" className="hidden h-7 shrink-0 text-xs sm:inline-flex" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
