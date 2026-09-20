'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, Plus, Loader2, ShoppingCart, Trash2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { formatMoney, formatDateTime, formatNumber } from '@/lib/format'
import type { SupplierDto, PosProduct } from '@/lib/types'

interface PurchasesResponse {
  items: {
    id: string
    referenceNo: string
    supplierName: string | null
    total: number
    paidAmount: number
    status: string
    itemCount: number
    createdAt: string
  }[]
  total: number
  page: number
  pageSize: number
  grandTotal: number
}

interface Line {
  productId: string
  name: string
  cost: string
  quantity: string
}

const STATUS_STYLES: Record<string, string> = {
  PAID: 'border-teal-300 text-teal-700 dark:text-teal-300',
  UNPAID: 'border-destructive/40 text-destructive',
  PARTIAL: 'border-amber-300 text-amber-700 dark:text-amber-300',
  COMPLETED: '',
}

export function PurchasesView() {
  const { user, activeBranchId, branches, settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const canManage = !!user && hasPermission(user.role, PERMISSIONS.PURCHASES_MANAGE)
  const branchId = activeBranchId ?? branches[0]?.id

  const url = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: '15' })
    if (debounced) sp.set('q', debounced)
    return `/api/purchases?${sp.toString()}`
  }, [debounced, page])

  const { data, loading, refetch } = useFetch<PurchasesResponse>(url)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search reference or supplier…"
            className="pl-9"
            aria-label="Search purchases"
          />
        </div>
        {data && (
          <p className="hidden text-xs text-muted-foreground sm:block sm:ml-auto">
            {data.total} order{data.total === 1 ? '' : 's'} · {formatMoney(data.grandTotal, symbol)} total
          </p>
        )}
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Record purchase
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <ShoppingCart className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No purchases recorded</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  When stock arrives from a supplier, record it here — the shelves update automatically.
                </p>
              </div>
              {canManage && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Record first purchase
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader className="[&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-price font-semibold">{p.referenceNo}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                        </TableCell>
                        <TableCell className="text-sm">{p.supplierName ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{formatNumber(p.itemCount)}</TableCell>
                        <TableCell className="text-right font-price font-semibold">{formatMoney(p.total, symbol)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={STATUS_STYLES[p.status] ?? ''}>
                            {p.status === 'PAID' ? 'Paid in full' : p.status === 'UNPAID' ? 'Unpaid' : p.status === 'PARTIAL' ? 'Partly paid' : 'Completed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                <p className="text-muted-foreground">page {data.page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <CreatePurchaseDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          branchId={branchId}
          currencySymbol={symbol}
          onCreated={() => refetch()}
        />
      )}
    </div>
  )
}

function CreatePurchaseDialog({
  open,
  onOpenChange,
  branchId,
  currencySymbol,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  branchId: string | null
  currencySymbol: string
  onCreated: () => void
}) {
  const [supplierId, setSupplierId] = useState('none')
  const [paid, setPaid] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [picker, setPicker] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: suppliers } = useFetch<{ items: SupplierDto[] }>('/api/suppliers?pageSize=100')
  const { data: products } = useFetch<{ items: PosProduct[] }>(branchId ? `/api/products?branchId=${branchId}&pageSize=200` : null)

  const total = lines.reduce((s, l) => s + Number(l.cost || 0) * Number(l.quantity || 0), 0)

  const addLine = () => {
    if (!picker) return
    const p = products?.items.find((x) => x.id === picker)
    if (!p) return
    if (lines.some((l) => l.productId === p.id)) {
      toast.info('Product already in this order — adjust the quantity instead.')
      return
    }
    setLines((ls) => [...ls, { productId: p.id, name: p.name, cost: String(p.purchasePrice || ''), quantity: '10' }])
    setPicker('')
  }

  const submit = async () => {
    if (!lines.length) {
      toast.error('Add at least one product to this purchase.')
      return
    }
    if (lines.some((l) => !Number(l.quantity) || Number(l.quantity) < 1)) {
      toast.error('Every line needs a quantity of 1 or more.')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/purchases', {
        branchId,
        supplierId: supplierId === 'none' ? null : supplierId,
        paidAmount: Number(paid || 0),
        note: note.trim() || null,
        items: lines.map((l) => ({ productId: l.productId, cost: Number(l.cost || 0), quantity: Number(l.quantity) })),
      })
      toast.success('Purchase recorded', { description: 'Stock levels have been increased.' })
      onCreated()
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto scrollbar-thin" aria-describedby="purchase-desc">
        <DialogHeader>
          <DialogTitle>Record a purchase</DialogTitle>
          <DialogDescription id="purchase-desc">
            Stock arriving from a supplier. Quantities are added to the shelf and the supplier&apos;s history is updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger aria-label="Supplier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier / cash purchase</SelectItem>
                  {suppliers?.items.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-paid">Amount paid</Label>
              <Input id="po-paid" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" className="font-price text-right" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            <div className="flex gap-2">
              <Select value={picker} onValueChange={setPicker}>
                <SelectTrigger className="flex-1" aria-label="Choose product"><SelectValue placeholder="Choose a product…" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {products?.items.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku ?? p.barcode ?? p.id.slice(0, 6)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={addLine} disabled={!picker}><Plus className="h-4 w-4" /> Add</Button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed py-8 text-center">
                <Truck className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Add the products that arrived in this delivery.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {lines.map((l, idx) => (
                  <li key={l.productId} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span>
                    <Input
                      value={l.cost}
                      onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, cost: e.target.value.replace(/[^0-9.]/g, '') } : x)))}
                      placeholder="cost"
                      className="h-8 w-20 font-price text-right"
                      aria-label={`Unit cost for ${l.name}`}
                    />
                    <Input
                      value={l.quantity}
                      onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, quantity: e.target.value.replace(/[^0-9]/g, '') } : x)))}
                      placeholder="qty"
                      className="h-8 w-16 font-price text-right"
                      aria-label={`Quantity for ${l.name}`}
                    />
                    <span className="hidden w-24 text-right font-price text-sm sm:block">
                      {formatMoney(Number(l.cost || 0) * Number(l.quantity || 0), currencySymbol)}
                    </span>
                    <button
                      onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${l.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="po-note">Note (optional)</Label>
            <Input id="po-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Invoice #4412 from supplier" />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
            <span className="text-sm text-muted-foreground">Purchase total</span>
            <span className="font-price text-lg font-bold">{formatMoney(total, currencySymbol)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || lines.length === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save purchase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
