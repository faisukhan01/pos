'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ZReportDialog } from '@/components/pos/z-report-dialog'
import { ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { formatMoney, formatNumber, formatDate, formatDateTime, startOfToday, daysAgo } from '@/lib/format'
import { paymentLabel } from '@/lib/types'

type ReportTab = 'sales' | 'products' | 'inventory' | 'expenses' | 'purchases'

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function ReportsView() {
  const { activeBranchId, branches, settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const [tab, setTab] = useState<ReportTab>('sales')
  const [from, setFrom] = useState(toInputDate(daysAgo(29)))
  const [to, setTo] = useState(toInputDate(startOfToday()))
  const [zOpen, setZOpen] = useState(false)
  const branchId = activeBranchId ?? branches[0]?.id

  const salesUrl = useMemo(
    () => (tab === 'sales' && branchId ? `/api/reports?type=sales&from=${from}&to=${to}&branchId=${branchId}` : null),
    [tab, from, to, branchId]
  )
  const productsUrl = useMemo(
    () => (tab === 'products' && branchId ? `/api/reports?type=products&from=${from}&to=${to}&branchId=${branchId}` : null),
    [tab, from, to, branchId]
  )
  const inventoryUrl = useMemo(
    () => (tab === 'inventory' && branchId ? `/api/reports?type=inventory&branchId=${branchId}` : null),
    [tab, branchId]
  )
  const expensesUrl = useMemo(() => (tab === 'expenses' ? `/api/reports?type=expenses&from=${from}&to=${to}` : null), [tab, from, to])
  const purchasesUrl = useMemo(
    () => (tab === 'purchases' && branchId ? `/api/reports?type=purchases&from=${from}&to=${to}&branchId=${branchId}` : null),
    [tab, from, to, branchId]
  )

  const sales = useFetch<{
    summary: { gross: number; transactions: number; avg: number; discounts: number }
    daily: { label: string; total: number; count: number }[]
    byCashier: { name: string; total: number; count: number }[]
    byMethod: { method: string; total: number; count: number }[]
  }>(salesUrl)

  const products = useFetch<{
    byProduct: { name: string; quantity: number; revenue: number }[]
    byCategory: { name: string; quantity: number; revenue: number }[]
  }>(productsUrl)

  const inventory = useFetch<{
    rows: { name: string; sku: string | null; category: string; unit: string; stock: number; minStock: number; costValue: number; retailValue: number; low: boolean }[]
    summary: { skuCount: number; units: number; costValue: number; retailValue: number; lowCount: number }
  }>(inventoryUrl)

  const expenses = useFetch<{
    items: { id: string; category: string; amount: number; paymentMethod: string; description: string | null; date: string }[]
    total: number
    byCategory: { name: string; total: number }[]
  }>(expensesUrl)

  const purchases = useFetch<{
    items: { id: string; referenceNo: string; supplierName: string | null; total: number; status: string; itemCount: number; createdAt: string }[]
    total: number
  }>(purchasesUrl)

  const active = { sales, products, inventory, expenses, purchases }[tab]
  const loading = active.loading

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab !== 'inventory' && (
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Button variant="outline" onClick={() => setZOpen(true)} className="gap-2">
              <ReceiptText className="h-4 w-4" /> End-of-day
            </Button>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From date"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}
      </div>

      {/* End-of-day printable summary */}
      <ZReportDialog open={zOpen} onOpenChange={setZOpen} />

      {loading && (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}

      {/* ---- SALES REPORT ---- */}
      {tab === 'sales' && sales.data && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Gross sales" value={formatMoney(sales.data.summary.gross, symbol)} />
            <MiniStat label="Transactions" value={formatNumber(sales.data.summary.transactions)} />
            <MiniStat label="Average sale" value={formatMoney(sales.data.summary.avg, symbol)} />
            <MiniStat label="Discounts given" value={formatMoney(sales.data.summary.discounts, symbol)} />
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-[15px]">Daily sales</CardTitle></CardHeader>
            <CardContent className="h-[280px]">
              {sales.data.daily.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales.data.daily} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <ChartTooltip
                      formatter={(value: number) => formatMoney(value, symbol)}
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12.5 }}
                    />
                    <Bar dataKey="total" fill="var(--chart-1)" radius={[5, 5, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-[15px]">By payment method</CardTitle></CardHeader>
              <CardContent>
                <SimpleList
                  rows={sales.data.byMethod.map((m) => ({ key: m.method, label: paymentLabel(m.method), sub: `${m.count} invoices`, value: formatMoney(m.total, symbol) }))}
                  empty="No payments in this period."
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-[15px]">By cashier</CardTitle></CardHeader>
              <CardContent>
                <SimpleList
                  rows={sales.data.byCashier.map((c) => ({ key: c.name, label: c.name, sub: `${c.count} invoices`, value: formatMoney(c.total, symbol) }))}
                  empty="No sales in this period."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ---- PRODUCTS REPORT ---- */}
      {tab === 'products' && products.data && !loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-[15px]">Best sellers by revenue</CardTitle></CardHeader>
            <CardContent className="max-h-[480px] overflow-y-auto scrollbar-thin">
              <SimpleList
                rows={products.data.byProduct.map((p) => ({ key: p.name, label: p.name, sub: `${formatNumber(p.quantity)} units`, value: formatMoney(p.revenue, symbol) }))}
                empty="No sales in this period."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-[15px]">Sales by category</CardTitle></CardHeader>
            <CardContent className="max-h-[480px] overflow-y-auto scrollbar-thin">
              <SimpleList
                rows={products.data.byCategory.map((c) => ({ key: c.name, label: c.name, sub: `${formatNumber(c.quantity)} units`, value: formatMoney(c.revenue, symbol) }))}
                empty="No sales in this period."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- INVENTORY REPORT ---- */}
      {tab === 'inventory' && inventory.data && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Products tracked" value={formatNumber(inventory.data.summary.skuCount)} />
            <MiniStat label="Units on shelves" value={formatNumber(inventory.data.summary.units)} />
            <MiniStat label="Stock value at cost" value={formatMoney(inventory.data.summary.costValue, symbol)} />
            <MiniStat label="Stock value at retail" value={formatMoney(inventory.data.summary.retailValue, symbol)} />
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader className="[&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-right">Cost value</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Retail value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.data.rows.map((r) => (
                      <TableRow key={r.name + (r.sku ?? '')}>
                        <TableCell>
                          <p className="font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.sku ?? '—'}</p>
                        </TableCell>
                        <TableCell className="hidden text-sm md:table-cell">{r.category}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={cn('font-price', r.low && 'border-amber-300 text-amber-700 dark:text-amber-300')}>
                            {formatNumber(r.stock)} {r.unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-price text-sm">{formatMoney(r.costValue, symbol)}</TableCell>
                        <TableCell className="hidden text-right font-price text-sm sm:table-cell">{formatMoney(r.retailValue, symbol)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- EXPENSES REPORT ---- */}
      {tab === 'expenses' && expenses.data && !loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="text-[15px]">By category</CardTitle></CardHeader>
            <CardContent>
              <SimpleList
                rows={expenses.data.byCategory.map((c) => ({ key: c.name, label: c.name, sub: '', value: formatMoney(c.total, symbol) }))}
                empty="No expenses in this period."
              />
              <div className="mt-4 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
                <span className="text-sm font-medium">Total</span>
                <span className="font-price text-lg font-bold">{formatMoney(expenses.data.total, symbol)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-[15px]">All expenses</CardTitle></CardHeader>
            <CardContent className="max-h-[480px] overflow-y-auto scrollbar-thin">
              <ul className="divide-y">
                {expenses.data.items.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{e.category}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(e.date)}{e.description ? ` · ${e.description}` : ''}</p>
                    </div>
                    <span className="font-price text-sm font-semibold">{formatMoney(e.amount, symbol)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- PURCHASES REPORT ---- */}
      {tab === 'purchases' && purchases.data && !loading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[15px]">Purchase orders</CardTitle>
            <span className="font-price text-lg font-bold">{formatMoney(purchases.data.total, symbol)}</span>
          </CardHeader>
          <CardContent className="p-0">
            {purchases.data.items.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No purchases in this period.</p>
            ) : (
              <Table>
                <TableHeader className="[&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.data.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-price font-semibold">{p.referenceNo}</TableCell>
                      <TableCell className="text-sm">{p.supplierName ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{formatNumber(p.itemCount)}</TableCell>
                      <TableCell className="text-right font-price">{formatMoney(p.total, symbol)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-price mt-0.5 text-xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}

function SimpleList({ rows, empty }: { rows: { key: string; label: string; sub: string; value: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={r.key} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.label}</p>
            {r.sub && <p className="text-[11px] text-muted-foreground">{r.sub}</p>}
          </div>
          <span className="font-price text-sm font-semibold">{r.value}</span>
        </li>
      ))}
    </ul>
  )
}
