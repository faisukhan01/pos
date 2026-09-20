'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, Boxes, AlertTriangle, PackageX, History, Loader2, PackageCheck, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { formatMoney, formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StockTakeDialog } from '@/components/pos/stock-take-dialog'

interface InventoryResponse {
  items: {
    id: string
    productId: string
    name: string
    barcode: string | null
    sku: string | null
    unit: string
    category: string | null
    stock: number
    minStock: number
    purchasePrice: number
    sellingPrice: number
    stockValue: number
  }[]
  total: number
  page: number
  pageSize: number
}

interface MovementsResponse {
  items: {
    id: string
    type: string
    quantity: number
    balanceAfter: number
    note: string | null
    reference: string | null
    createdAt: string
    item: { product: { name: string; unit: string } }
  }[]
}

const MOVEMENT_LABELS: Record<string, string> = {
  OPENING: 'Opening stock',
  SALE: 'Sale',
  PURCHASE: 'Purchase',
  RETURN: 'Customer return',
  ADJUSTMENT: 'Adjustment',
  TRANSFER: 'Transfer',
  STOCK_TAKE: 'Stock take',
}

export function InventoryView() {
  const { user, activeBranchId, branches, settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [page, setPage] = useState(1)
  const [adjusting, setAdjusting] = useState<InventoryResponse['items'][number] | null>(null)
  const [historyFor, setHistoryFor] = useState<{ productId: string; name: string } | null>(null)
  const [stockTakeOpen, setStockTakeOpen] = useState(false)
  const [newStock, setNewStock] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [busy, setBusy] = useState(false)

  const canManage = !!user && hasPermission(user.role, PERMISSIONS.INVENTORY_MANAGE)
  const branchId = activeBranchId ?? branches[0]?.id

  const url = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: '20', filter })
    if (debounced) sp.set('q', debounced)
    if (branchId) sp.set('branchId', branchId)
    return `/api/inventory?${sp.toString()}`
  }, [page, filter, debounced, branchId])

  const { data, loading, refetch } = useFetch<InventoryResponse>(url)

  const movementsUrl = historyFor && branchId
    ? `/api/reports/movements?productId=${historyFor.productId}&branchId=${branchId}`
    : null
  const { data: movements, loading: movementsLoading } = useFetch<MovementsResponse>(movementsUrl)

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const totals = useMemo(() => {
    if (!data) return null
    return {
      units: data.items.reduce((s, i) => s + i.stock, 0),
      value: data.items.reduce((s, i) => s + i.stockValue, 0),
    }
  }, [data])

  const openAdjust = (item: InventoryResponse['items'][number]) => {
    setAdjusting(item)
    setNewStock(String(item.stock))
    setAdjustNote('')
  }

  const submitAdjust = async () => {
    if (!adjusting || !branchId) return
    const val = Number(newStock)
    if (!Number.isFinite(val) || val < 0) {
      toast.error('Enter a valid stock quantity (0 or more).')
      return
    }
    setBusy(true)
    try {
      const res = await api.post<{ delta: number }>('/api/inventory/adjust', {
        productId: adjusting.productId,
        newStock: val,
        note: adjustNote.trim() || undefined,
        branchId,
      })
      toast.success('Stock adjusted', {
        description:
          res.delta === 0
            ? 'Quantity unchanged.'
            : `${adjusting.name}: ${res.delta > 0 ? '+' : ''}${res.delta} ${adjusting.unit} recorded.`,
      })
      setAdjusting(null)
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search product, barcode or SKU…"
            className="pl-9"
            aria-label="Search inventory"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1) }}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="low" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Low
            </TabsTrigger>
            <TabsTrigger value="out" className="gap-1.5">
              <PackageX className="h-3.5 w-3.5" /> Out
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {totals && data && data.items.length > 0 && (
          <p className="hidden text-xs text-muted-foreground sm:block sm:ml-auto">
            Page totals: {formatNumber(totals.units)} units · {formatMoney(totals.value, symbol)} at cost
          </p>
        )}
        {canManage && (
          <Button variant="outline" onClick={() => setStockTakeOpen(true)} className="sm:ml-auto lg:ml-0">
            <ClipboardList className="h-4 w-4" /> Stock take
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Boxes className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">
                  {filter === 'low' ? 'Nothing is running low' : filter === 'out' ? 'No out-of-stock products' : 'No inventory yet'}
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {filter === 'all'
                    ? 'Stock appears here once products have opening stock, purchases or sales.'
                    : 'Try the All tab to see the full stock list.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Alert at</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Cost value</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Retail value</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((i) => {
                      const low = i.stock > 0 && i.stock <= i.minStock
                      const out = i.stock <= 0
                      return (
                        <TableRow key={i.id}>
                          <TableCell>
                            <p className="font-medium">{i.name}</p>
                            <p className="font-price text-xs text-muted-foreground">{i.barcode ?? i.sku ?? '—'}</p>
                          </TableCell>
                          <TableCell className="hidden text-sm md:table-cell">{i.category ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                'font-price',
                                out && 'border-destructive/40 text-destructive',
                                low && 'border-amber-300 text-amber-700 dark:text-amber-300'
                              )}
                            >
                              {formatNumber(i.stock)} {i.unit}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-right font-price text-xs text-muted-foreground sm:table-cell">
                            {i.minStock}
                          </TableCell>
                          <TableCell className="hidden text-right font-price text-xs lg:table-cell">{formatMoney(i.stockValue, symbol)}</TableCell>
                          <TableCell className="hidden text-right font-price text-xs lg:table-cell">
                            {formatMoney(i.stock * i.sellingPrice, symbol)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setHistoryFor({ productId: i.productId, name: i.name })}
                                aria-label={`Movement history for ${i.name}`}
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>
                              {canManage && (
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openAdjust(i)}>
                                  <PackageCheck className="h-3.5 w-3.5" /> Adjust
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                <p className="text-muted-foreground">{data.total} item{data.total === 1 ? '' : 's'} · page {data.page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stock take dialog */}
      <StockTakeDialog
        open={stockTakeOpen}
        onOpenChange={setStockTakeOpen}
        branchId={branchId ?? null}
        onSubmitted={refetch}
      />

      {/* Adjust dialog */}
      <Dialog open={!!adjusting} onOpenChange={(o) => !o && setAdjusting(null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby="adjust-desc">
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription id="adjust-desc">
              For damaged goods, expiry, shrinkage or a stock-count correction. The change is recorded in the
              movement history with your name and reason.
            </DialogDescription>
          </DialogHeader>
          {adjusting && (
            <div className="space-y-3.5">
              <div className="rounded-xl bg-muted px-3.5 py-2.5">
                <p className="text-sm font-medium">{adjusting.name}</p>
                <p className="text-xs text-muted-foreground">
                  Currently on hand: {formatNumber(adjusting.stock)} {adjusting.unit}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-stock">Counted / corrected quantity</Label>
                <Input
                  id="adj-stock"
                  inputMode="numeric"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value.replace(/[^0-9]/g, ''))}
                  className="font-price text-right"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-note">Reason (recommended)</Label>
                <Input
                  id="adj-note"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. 2 cartons damaged in transit"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjusting(null)} disabled={busy}>Cancel</Button>
            <Button onClick={submitAdjust} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement history dialog */}
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="sm:max-w-lg" aria-describedby="hist-desc">
          <DialogHeader>
            <DialogTitle>Stock movements</DialogTitle>
            <DialogDescription id="hist-desc">{historyFor?.name}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto scrollbar-thin">
            {movementsLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
              </div>
            ) : !movements || movements.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No movements recorded yet.</p>
            ) : (
              <ol className="relative space-y-0 border-l-2 py-1 pl-4 ml-2">
                {movements.items.slice(0, 40).map((m) => (
                  <li key={m.id} className="relative pb-4 last:pb-0">
                    <span
                      className={cn(
                        'absolute -left-[21.5px] top-1 h-3 w-3 rounded-full border-2 border-background',
                        m.quantity > 0 ? 'bg-emerald-500' : 'bg-red-400'
                      )}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{MOVEMENT_LABELS[m.type] ?? m.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(m.createdAt)}
                          {m.reference ? ` · ${m.reference}` : ''}
                          {m.note ? ` · ${m.note}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('font-price text-sm font-semibold', m.quantity > 0 ? 'text-emerald-700' : 'text-red-600')}>
                          {m.quantity > 0 ? '+' : ''}{formatNumber(m.quantity)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">bal. {formatNumber(m.balanceAfter)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
