'use client'

import { useMemo } from 'react'
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
import { useAuthStore } from '@/lib/store'
import { formatMoney, formatTime, timeAgo, formatNumber } from '@/lib/format'
import { paymentLabel, type DashboardData, type ShiftsSummary } from '@/lib/types'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import type { ViewKey } from '@/components/layout/app-shell'

const PIE_COLORS = ['#166b4e', '#c98a2b', '#4d8ba8', '#b06343', '#8a5a9e']

export function DashboardView({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { user, activeBranchId, branches, settings } = useAuthStore()
  const branchId = activeBranchId ?? branches[0]?.id
  const symbol = settings?.currencySymbol ?? 'Rs'
  const { data, loading, error } = useFetch<DashboardData>(branchId ? `/api/dashboard?branchId=${branchId}` : null)
  const canSeeDrawer = !!user && hasPermission(user.role, PERMISSIONS.SHIFTS_VIEW)
  const { data: shiftData } = useFetch<ShiftsSummary>(
    canSeeDrawer && branchId ? `/api/shifts?branchId=${branchId}` : null
  )
  const activeShift = shiftData?.active ?? null

  const salesChart = useMemo(() => data?.salesSeries ?? [], [data])

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
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)
          : (
            <>
              <StatCard
                icon={Banknote}
                label="Sales today"
                value={formatMoney(data?.todaySales ?? 0, symbol)}
                hint={`${formatNumber(data?.todayTransactions ?? 0)} transactions`}
                tone="primary"
              />
              <StatCard
                icon={ReceiptText}
                label="Average sale"
                value={formatMoney(data?.avgSale ?? 0, symbol)}
                hint="per transaction today"
              />
              <StatCard
                icon={TrendingUp}
                label="Last 7 days"
                value={formatMoney(data?.weekSales ?? 0, symbol)}
                hint="gross sales"
              />
              <StatCard
                icon={(data?.outOfStockCount ?? 0) > 0 ? PackageX : Package}
                label="Stock alerts"
                value={`${(data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0)}`}
                hint={`${data?.lowStockCount ?? 0} low · ${data?.outOfStockCount ?? 0} out of stock`}
                tone={(data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0) > 0 ? 'warn' : 'default'}
                action={
                  (data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0) > 0
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
            <CardTitle className="text-[15px]">Sales — last 14 days</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading && !data ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChart} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <ChartTooltip
                    formatter={(value: number, _name: string, entry: { payload?: { count?: number } }) => [
                      `${formatMoney(value, symbol)} · ${entry?.payload?.count ?? 0} sales`,
                      'Sales',
                    ]}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12.5 }}
                  />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[5, 5, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment mix */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Payments — last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading && !data ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : (data?.paymentBreakdown?.length ?? 0) === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales yet this week.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.paymentBreakdown.map((p) => ({ ...p, label: paymentLabel(p.method) }))}
                    dataKey="total"
                    nameKey="label"
                    innerRadius="52%"
                    outerRadius="80%"
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
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Top products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Top products — 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
            ) : (data?.topProducts?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No sales recorded yet this week.</p>
            ) : (
              <ol className="space-y-2">
                {data?.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
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
            <CardTitle className="text-[15px]">Needs restocking</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigate('inventory')}>
              All stock <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
            ) : (data?.lowStock?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Everything is well stocked. 👍</p>
            ) : (
              <ul className="space-y-2">
                {data?.lowStock.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
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
            <CardTitle className="text-[15px]">Recent sales</CardTitle>
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
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
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
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Purchases today (stock coming in)</p>
              <p className="font-price text-lg font-semibold">{formatMoney(data?.todayPurchases ?? 0, symbol)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expenses today (money going out)</p>
              <p className="font-price text-lg font-semibold">{formatMoney(data?.todayExpenses ?? 0, symbol)}</p>
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
  hint: string
  tone?: 'default' | 'primary' | 'warn'
  action?: { label: string; onClick: () => void }
}) {
  return (
    <Card className="card-lift">
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            tone === 'primary' && 'bg-primary/10 text-primary',
            tone === 'warn' && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
            tone === 'default' && 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="font-price truncate text-xl font-bold tracking-tight">{value}</p>
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
        {action && (
          <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
