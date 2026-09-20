'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, ReceiptText, Undo2, Loader2, Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { formatMoney, formatDateTime } from '@/lib/format'
import { paymentLabel, paymentBadgeClass, type SaleDto } from '@/lib/types'
import { downloadCsv, todayStamp, fetchAllPages } from '@/lib/csv'
import { cn } from '@/lib/utils'

interface SalesResponse {
  items: {
    id: string
    invoiceNo: string
    customerName: string
    cashierName: string
    paymentMethod: string
    total: number
    status: string
    itemCount: number
    createdAt: string
  }[]
  total: number
  page: number
  pageSize: number
  grandTotal: number
}

interface SaleDetail extends SaleDto {
  returns?: { returnNo: string; reason: string | null; amount: number; createdAt: string; itemsJson: string }[]
  branch?: { name: string }
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: 'Completed', className: 'border-teal-300 text-teal-700 dark:text-teal-300' },
  PARTIALLY_RETURNED: { label: 'Partly returned', className: 'border-amber-300 text-amber-700 dark:text-amber-300' },
  RETURNED: { label: 'Returned', className: 'border-destructive/40 text-destructive' },
}

export function SalesView() {
  const { settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [method, setMethod] = useState('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [returnMode, setReturnMode] = useState(false)
  const [returnSel, setReturnSel] = useState<Record<string, number>>({})
  const [returnReason, setReturnReason] = useState('')
  const [returnBusy, setReturnBusy] = useState(false)
  const [receiptMode, setReceiptMode] = useState(false)
  const [exporting, setExporting] = useState(false)

  const exportCsv = async () => {
    setExporting(true)
    try {
      const pages = await fetchAllPages<SalesResponse>(
        (p, ps) => {
          const sp = new URLSearchParams({ page: String(p), pageSize: String(ps) })
          if (debounced) sp.set('q', debounced)
          if (method !== 'all') sp.set('method', method)
          return `/api/sales?${sp.toString()}`
        },
        (d) => d.items
      )
      const rows = pages.flatMap((d) => d.items)
      if (!rows.length) {
        toast.info('Nothing to export with the current filters.')
        return
      }
      downloadCsv(
        `sales-${todayStamp()}.csv`,
        ['Invoice', 'Date', 'Customer', 'Cashier', 'Payment', 'Items', 'Total', 'Status'],
        rows.map((s) => [
          s.invoiceNo,
          formatDateTime(s.createdAt),
          s.customerName,
          s.cashierName,
          paymentLabel(s.paymentMethod),
          s.itemCount,
          s.total,
          STATUS_LABELS[s.status]?.label ?? s.status,
        ])
      )
      toast.success('Sales exported', { description: `${rows.length} invoices saved as CSV.` })
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message })
    } finally {
      setExporting(false)
    }
  }

  const url = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: '15' })
    if (debounced) sp.set('q', debounced)
    if (method !== 'all') sp.set('method', method)
    return `/api/sales?${sp.toString()}`
  }, [debounced, method, page])

  const { data, loading, refetch } = useFetch<SalesResponse>(url)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    setDetail(null)
    setReturnMode(false)
    setReturnSel({})
    setReturnReason('')
    setReceiptMode(false)
    try {
      const sale = await api.get<SaleDetail>(`/api/sales/${id}`)
      setDetail(sale)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDetailLoading(false)
    }
  }

  const submitReturn = async () => {
    if (!detail) return
    const items = Object.entries(returnSel)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, qty]) => ({ saleItemId, quantity: qty }))
    if (!items.length) {
      toast.error('Tick at least one item to return.')
      return
    }
    if (returnReason.trim().length < 3) {
      toast.error('Please record a short reason for the return.')
      return
    }
    setReturnBusy(true)
    try {
      await api.post(`/api/sales/${detail.id}/return`, { reason: returnReason.trim(), items })
      toast.success('Return recorded', { description: 'Stock has been added back to the shelf.' })
      setReturnMode(false)
      const fresh = await api.get<SaleDetail>(`/api/sales/${detail.id}`)
      setDetail(fresh)
      refetch()
    } catch (err) {
      toast.error('Return failed', { description: (err as Error).message })
    } finally {
      setReturnBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search invoice number, customer or cashier…"
            className="pl-9"
            aria-label="Search sales"
          />
        </div>
        <Select value={method} onValueChange={(v) => { setMethod(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Payment method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="CARD">Card</SelectItem>
            <SelectItem value="MOBILE">Mobile / QR</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <p className="hidden text-xs text-muted-foreground sm:block">
            {data.total} invoice{data.total === 1 ? '' : 's'} · {formatMoney(data.grandTotal, symbol)} total
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-2 sm:ml-2"
          onClick={exportCsv}
          disabled={exporting}
          aria-label="Export sales as CSV"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </Button>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <ReceiptText className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No sales found</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {debounced || method !== 'all'
                    ? 'Nothing matches these filters. Try widening your search.'
                    : 'Once you complete a sale at the till, it shows up here.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader className="[&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="hidden md:table-cell">Customer</TableHead>
                      <TableHead className="hidden lg:table-cell">Cashier</TableHead>
                      <TableHead className="hidden sm:table-cell">Payment</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((s) => {
                      const st = STATUS_LABELS[s.status] ?? { label: s.status, className: '' }
                      return (
                        <TableRow key={s.id} className="cursor-pointer" onClick={() => openDetail(s.id)}>
                          <TableCell>
                            <p className="font-price font-semibold">{s.invoiceNo}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</p>
                          </TableCell>
                          <TableCell className="hidden text-sm md:table-cell">{s.customerName}</TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{s.cashierName}</TableCell>
                          <TableCell className="hidden text-sm sm:table-cell">
                            <Badge variant="outline" className={paymentBadgeClass(s.paymentMethod)}>{paymentLabel(s.paymentMethod)}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{s.itemCount}</TableCell>
                          <TableCell className="text-right font-price font-semibold">{formatMoney(s.total, symbol)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={st.className}>{st.label}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
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

      {/* Detail dialog */}
      <Dialog open={!!detail || detailLoading} onOpenChange={(o) => { if (!o) { setDetail(null); setDetailLoading(false) } }}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] flex flex-col" aria-describedby="sale-detail-desc">
          {detailLoading && <Skeleton className="h-72 rounded-xl" />}
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2">
                  <span className="font-price">{detail.invoiceNo}</span>
                  <Badge variant="outline" className={(STATUS_LABELS[detail.status] ?? { className: '' }).className}>
                    {(STATUS_LABELS[detail.status] ?? { label: detail.status }).label}
                  </Badge>
                </DialogTitle>
                <DialogDescription id="sale-detail-desc">
                  {formatDateTime(detail.createdAt)} · {detail.branch?.name ?? 'Store'} ·{' '}
                  <Badge variant="outline" className={paymentBadgeClass(detail.paymentMethod)}>{paymentLabel(detail.paymentMethod)}</Badge>
                </DialogDescription>
              </DialogHeader>

              <div className={cn('min-h-0 flex-1 overflow-y-auto scrollbar-thin', receiptMode && 'max-h-[45vh]')}>
                <div className={cn(receiptMode && 'rounded-xl border bg-white')}>
                  <div className={cn(receiptMode && 'receipt-print bg-white')}>
                    <div className={cn(receiptMode && 'receipt-sheet font-mono px-4 py-4 text-[11.5px]')}>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Items</p>
                        <ul className="divide-y rounded-xl border">
                          {detail.items.map((it) => (
                            <li key={it.id} className="flex items-center gap-3 px-3 py-2">
                              {returnMode && (
                                <Checkbox
                                  id={`ret-${it.id}`}
                                  checked={(returnSel[it.id] ?? 0) > 0}
                                  onCheckedChange={(c) =>
                                    setReturnSel((s) => {
                                      const next = { ...s }
                                      if (c) next[it.id] = it.quantity - it.returnedQty
                                      else delete next[it.id]
                                      return next
                                    })
                                  }
                                  disabled={it.quantity - it.returnedQty <= 0}
                                  aria-label={`Return ${it.name}`}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{it.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {it.quantity} × {formatMoney(it.unitPrice, symbol)}
                                  {it.returnedQty > 0 && ` · ${it.returnedQty} returned`}
                                </p>
                              </div>
                              {returnMode && (returnSel[it.id] ?? 0) > 0 && (
                                <div className="w-14">
                                  <Input
                                    inputMode="numeric"
                                    value={returnSel[it.id]}
                                    onChange={(e) =>
                                      setReturnSel((s) => ({
                                        ...s,
                                        [it.id]: Math.min(Number(e.target.value.replace(/[^0-9]/g, '')) || 0, it.quantity - it.returnedQty),
                                      }))
                                    }
                                    className="h-8 text-center font-price"
                                    aria-label={`Quantity to return for ${it.name}`}
                                  />
                                </div>
                              )}
                              <span className="font-price text-sm font-semibold">{formatMoney(it.lineTotal, symbol)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-3 space-y-1 text-sm">
                        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-price">{formatMoney(detail.subtotal, symbol)}</span></div>
                        {detail.discount > 0 && <div className="flex justify-between text-teal-600 dark:text-teal-400"><span>Discount</span><span className="font-price">-{formatMoney(detail.discount, symbol)}</span></div>}
                        {detail.tax > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="font-price">{formatMoney(detail.tax, symbol)}</span></div>}
                        <div className="flex justify-between border-t pt-1.5 text-base font-bold"><span>Total</span><span className="font-price">{formatMoney(detail.total, symbol)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Paid</span><span className="font-price">{formatMoney(detail.amountReceived, symbol)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Change</span><span className="font-price">{formatMoney(detail.changeDue, symbol)}</span></div>
                        <p className="pt-1 text-xs text-muted-foreground">Cashier: {detail.cashierName} · Customer: {detail.customerName}</p>
                      </div>

                      {detail.returns && detail.returns.length > 0 && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3 text-xs space-y-1">
                          <p className="font-semibold text-amber-800 dark:text-amber-300">Returns on this invoice</p>
                          {detail.returns.map((r) => (
                            <p key={r.returnNo} className="text-amber-700 dark:text-amber-400">
                              {r.returnNo} · {formatMoney(r.amount, symbol)} · {formatDateTime(r.createdAt)}{r.reason ? ` · ${r.reason}` : ''}
                            </p>
                          ))}
                        </div>
                      )}

                      {returnMode && (
                        <div className="mt-3 space-y-1.5">
                          <Label htmlFor="ret-reason">Reason for return</Label>
                          <Textarea
                            id="ret-reason"
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            rows={2}
                            placeholder="e.g. Customer changed mind, unopened pack"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                {returnMode ? (
                  <>
                    <Button variant="outline" onClick={() => setReturnMode(false)} disabled={returnBusy}>Back</Button>
                    <Button onClick={submitReturn} disabled={returnBusy}>
                      {returnBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                      Record return
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setReceiptMode((v) => !v)}>
                      <Printer className="h-4 w-4" /> {receiptMode ? 'Exit print view' : 'Print view'}
                    </Button>
                    <ReturnButton status={detail.status} onBegin={() => setReturnMode(true)} />
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReturnButton({ status, onBegin }: { status: string; onBegin: () => void }) {
  if (status === 'RETURNED') return <Button variant="outline" disabled>Fully returned</Button>
  return (
    <Button onClick={onBegin}>
      <Undo2 className="h-4 w-4" /> Return items
    </Button>
  )
}
