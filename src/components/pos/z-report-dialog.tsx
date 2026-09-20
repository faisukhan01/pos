'use client'

import { useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Printer, ReceiptText } from 'lucide-react'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { formatMoney, formatDateTime } from '@/lib/format'
import { paymentLabel } from '@/lib/types'

interface SalesReport {
  summary: { gross: number; transactions: number; avg: number; discounts: number }
  byMethod: { method: string; total: number; count: number }[]
  byCashier: { name: string; total: number; count: number }[]
}

interface ExpensesReport {
  items: { id: string; category: string; amount: number; paymentMethod: string; description: string | null }[]
  total: number
}

// End-of-day (X/Z-style) summary — sized for the same 80mm receipt printer.
export function ZReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { business, branches, activeBranchId, settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [date, setDate] = useState(today)
  const branchId = activeBranchId ?? branches[0]?.id
  const printRef = useRef<HTMLDivElement>(null)

  const handleOpenChange = (o: boolean) => {
    if (o) setDate(today)
    onOpenChange(o)
  }

  const sales = useFetch<SalesReport>(
    open && branchId ? `/api/reports?type=sales&from=${date}&to=${date}&branchId=${branchId}` : null
  )
  const expenses = useFetch<ExpensesReport>(open ? `/api/reports?type=expenses&from=${date}&to=${date}` : null)

  const cashSales = sales.data?.byMethod.find((m) => m.method === 'CASH')?.total ?? 0
  const cashExpenses = expenses.data?.items.filter((e) => e.paymentMethod === 'CASH').reduce((s, e) => s + e.amount, 0) ?? 0
  const cashExpected = cashSales - cashExpenses
  const loading = sales.loading || expenses.loading

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="zreport-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" /> End-of-day summary
          </DialogTitle>
          <DialogDescription id="zreport-desc">
            Print a shift-close report: sales by payment type, cash expected in the drawer, expenses.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="z-date">Business date</Label>
            <Input id="z-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => window.print()} disabled={loading} className="h-9">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto scrollbar-thin rounded-xl border bg-white text-black">
          <div ref={printRef} className="receipt-print bg-white">
            <div className="receipt-sheet font-mono px-5 py-5 text-[12px] leading-relaxed">
              <div className="text-center">
                <p className="text-[15px] font-bold uppercase tracking-wide">{business?.name ?? 'Store'}</p>
                <p className="text-[11px]">END-OF-DAY SUMMARY (Z-REPORT)</p>
                <p className="text-[11px]">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-[10px]">Printed {formatDateTime(new Date())}</p>
              </div>

              <div className="my-3 border-t border-dashed border-black/60" />

              {loading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-4 w-3/4 bg-black/10" />
                  <Skeleton className="h-4 w-1/2 bg-black/10" />
                  <Skeleton className="h-4 w-2/3 bg-black/10" />
                </div>
              ) : (
                <>
                  <p className="mb-1 text-[11px] font-semibold">SALES</p>
                  <div className="space-y-0.5 text-[11.5px]">
                    <div className="flex justify-between"><span>Transactions</span><span>{sales.data?.summary.transactions ?? 0}</span></div>
                    <div className="flex justify-between"><span>Gross sales</span><span>{formatMoney(sales.data?.summary.gross ?? 0, symbol)}</span></div>
                    <div className="flex justify-between"><span>Discounts given</span><span>-{formatMoney(sales.data?.summary.discounts ?? 0, symbol)}</span></div>
                    <div className="flex justify-between font-bold"><span>NET TOTAL</span><span>{formatMoney(sales.data?.summary.gross ?? 0, symbol)}</span></div>
                  </div>

                  {(sales.data?.byMethod.length ?? 0) > 0 && (
                    <>
                      <p className="mb-1 mt-3 text-[11px] font-semibold">PAYMENT BREAKDOWN</p>
                      <div className="space-y-0.5 text-[11.5px]">
                        {sales.data?.byMethod.map((m) => (
                          <div key={m.method} className="flex justify-between">
                            <span>{paymentLabel(m.method)} ({m.count})</span>
                            <span>{formatMoney(m.total, symbol)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="my-3 border-t border-dashed border-black/60" />
                  <p className="mb-1 text-[11px] font-semibold">CASH DRAWER</p>
                  <div className="space-y-0.5 text-[11.5px]">
                    <div className="flex justify-between"><span>Cash sales</span><span>{formatMoney(cashSales, symbol)}</span></div>
                    <div className="flex justify-between"><span>Cash expenses paid out</span><span>-{formatMoney(cashExpenses, symbol)}</span></div>
                    <div className="mt-1 flex justify-between border-t border-black pt-1 text-[13px] font-bold">
                      <span>CASH EXPECTED</span><span>{formatMoney(cashExpected, symbol)}</span>
                    </div>
                  </div>

                  {(expenses.data?.total ?? 0) > 0 && (
                    <>
                      <p className="mb-1 mt-3 text-[11px] font-semibold">EXPENSES (ALL METHODS)</p>
                      <div className="space-y-0.5 text-[11.5px]">
                        {expenses.data?.items.slice(0, 10).map((e) => (
                          <div key={e.id} className="flex justify-between">
                            <span className="truncate pr-2">{e.category}{e.description ? ` — ${e.description}` : ''}</span>
                            <span>{formatMoney(e.amount, symbol)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold">
                          <span>Total</span><span>{formatMoney(expenses.data?.total ?? 0, symbol)}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {(sales.data?.byCashier.length ?? 0) > 0 && (
                    <>
                      <p className="mb-1 mt-3 text-[11px] font-semibold">BY CASHIER</p>
                      <div className="space-y-0.5 text-[11.5px]">
                        {sales.data?.byCashier.map((c) => (
                          <div key={c.name} className="flex justify-between">
                            <span>{c.name} ({c.count})</span>
                            <span>{formatMoney(c.total, symbol)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="my-3 border-t border-dashed border-black/60" />
              <p className="text-center text-[10px]">Counted cash should match “Cash Expected”. Differences must be recorded as adjustments.</p>
              <p className="mt-1 text-center text-[10px]">Printed by Nova POS</p>
            </div>
          </div>
        </div>

        <Separator />
        <p className="text-xs text-muted-foreground">
          This summary counts only completed sales recorded by the system — physical float (opening cash) is not
          tracked yet.
        </p>
      </DialogContent>
    </Dialog>
  )
}
