'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Vault,
  Banknote,
  CreditCard,
  Smartphone,
  Undo2,
  ArrowDownToLine,
  Printer,
  Loader2,
  History,
  BookOpenText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { formatMoney, formatTime, formatDate, formatDateTime } from '@/lib/format'
import type { ShiftAggregates, ShiftDto } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ShiftsResponse {
  active: ShiftDto | null
  history: ShiftDto[]
}

const FLOAT_CHIPS = [1000, 3000, 5000, 10000]

export function ShiftsView() {
  const { user, business, branches, activeBranchId, settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const branchId = activeBranchId ?? branches[0]?.id
  const branchName = branches.find((b) => b.id === branchId)?.name ?? 'Main branch'
  const canManage = !!user && hasPermission(user.role, PERMISSIONS.SHIFTS_MANAGE)

  const { data, loading, refetch } = useFetch<ShiftsResponse>(
    branchId ? `/api/shifts?branchId=${branchId}` : null
  )

  // Keep the live cash figure fresh while a drawer is open.
  useEffect(() => {
    if (!data?.active) return
    const id = setInterval(() => refetch(), 30000)
    return () => clearInterval(id)
  }, [data?.active, refetch])

  const [openDialog, setOpenDialog] = useState(false)
  const [closing, setClosing] = useState<ShiftDto | null>(null)
  const [xReportOpen, setXReportOpen] = useState(false)

  const active = data?.active ?? null

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      {/* ---------- Active drawer ---------- */}
      {loading && !data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : active ? (
        <Card className="overflow-hidden">
          <div className="bg-primary px-5 py-4 text-primary-foreground">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                  <Vault className="h-5 w-5" />
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-300 ring-2 ring-primary animate-pulse" />
                </span>
                <div>
                  <p className="text-[13px] font-medium opacity-90">Drawer open since {formatTime(active.openedAt)}</p>
                  <p className="text-lg font-bold leading-tight">
                    {formatMoney(active.aggregates?.cashExpected ?? 0, symbol)}{' '}
                    <span className="text-xs font-normal opacity-80">cash expected right now</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                  onClick={() => setXReportOpen(true)}
                >
                  <Printer className="h-4 w-4" /> X-report
                </Button>
                {canManage && (
                  <Button
                    size="sm"
                    className="gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                    onClick={() => setClosing(active)}
                  >
                    <ArrowDownToLine className="h-4 w-4" /> Count &amp; close
                  </Button>
                )}
              </div>
            </div>
          </div>
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-7">
            <MiniStat label="Opening float" value={formatMoney(active.openingFloat, symbol)} />
            <MiniStat label="Cash sales" value={formatMoney(active.aggregates?.cashSales ?? 0, symbol)} tone="pos" />
            <MiniStat label="Card" value={formatMoney(active.aggregates?.cardSales ?? 0, symbol)} icon={CreditCard} />
            <MiniStat label="Mobile / QR" value={formatMoney(active.aggregates?.mobileSales ?? 0, symbol)} icon={Smartphone} />
            <MiniStat label="Udhaar (credit)" value={formatMoney(active.aggregates?.creditSales ?? 0, symbol)} icon={BookOpenText} />
            <MiniStat label="Transactions" value={String(active.aggregates?.transactions ?? 0)} />
            <MiniStat
              label="Cash out (expenses)"
              value={`-${formatMoney(active.aggregates?.cashExpenses ?? 0, symbol)}`}
              tone="neg"
            />
            <div className="col-span-2 text-xs text-muted-foreground sm:col-span-3 lg:col-span-6">
              Opened by <span className="font-medium text-foreground">{active.openedByName}</span>
              {active.aggregates && active.aggregates.returnsTotal > 0 && (
                <span> · returns {formatMoney(active.aggregates.returnsTotal, symbol)} (refunded in cash)</span>
              )}
              <span> · totals update live every 30 s</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Vault className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No drawer is open at {branchName}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Open a shift with your starting float (the cash you put in the drawer). Every cash sale,
                payout and return is then counted against it until you close the drawer.
              </p>
            </div>
            {canManage && (
              <Button className="gap-2" onClick={() => setOpenDialog(true)}>
                <Vault className="h-4 w-4" /> Open drawer
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------- Shift history ---------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <History className="h-4 w-4 text-primary" /> Closed shifts
          </CardTitle>
          <CardDescription>Drawer counts and variances for the last 20 shifts at this branch.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          ) : (data?.history.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No closed shifts yet — history appears here after you count &amp; close a drawer.
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opened</TableHead>
                    <TableHead className="hidden sm:table-cell">Closed</TableHead>
                    <TableHead className="text-right">Float</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="hidden md:table-cell">By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.history.map((s) => {
                    const over = (s.variance ?? 0) > 0
                    const short = (s.variance ?? 0) < 0
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{formatDate(s.openedAt)}</p>
                          <p className="text-[11px] text-muted-foreground">{formatTime(s.openedAt)}</p>
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                          {s.closedAt ? `${formatDate(s.closedAt)} ${formatTime(s.closedAt)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-price text-xs text-muted-foreground">
                          {formatMoney(s.openingFloat, symbol)}
                        </TableCell>
                        <TableCell className="text-right font-price text-sm">{formatMoney(s.cashExpected ?? 0, symbol)}</TableCell>
                        <TableCell className="text-right font-price text-sm font-semibold">{formatMoney(s.countedCash ?? 0, symbol)}</TableCell>
                        <TableCell className="text-right">
                          {(s.variance ?? 0) === 0 ? (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300">
                              Even
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={cn(
                                'font-price',
                                over
                                  ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300'
                                  : 'border-destructive/40 text-destructive'
                              )}
                            >
                              {over ? '+' : ''}
                              {formatMoney(s.variance ?? 0, symbol)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                          {s.closedByName ?? '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">
        Expenses are recorded at business level, so cash payouts from every branch are counted into the drawer
        until branch-level expenses arrive. Returns are assumed refunded in cash.
      </p>

      {/* ---------- Dialogs ---------- */}
      <OpenDrawerDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        symbol={symbol}
        onOpened={() => refetch()}
      />

      <CloseDrawerDialog
        shift={closing}
        onOpenChange={(o) => !o && setClosing(null)}
        symbol={symbol}
        businessName={business?.name ?? 'Our Store'}
        branchName={branchName}
        onClosed={() => refetch()}
      />

      <XReportDialog
        open={xReportOpen}
        onOpenChange={setXReportOpen}
        shift={active}
        symbol={symbol}
        businessName={business?.name ?? 'Our Store'}
        branchName={branchName}
      />
    </div>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'pos' | 'neg'
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p
        className={cn(
          'font-price truncate text-sm font-semibold',
          tone === 'pos' && 'text-emerald-700 dark:text-emerald-300',
          tone === 'neg' && 'text-destructive'
        )}
      >
        {value}
      </p>
    </div>
  )
}

/* ---------------- Open drawer ---------------- */

function OpenDrawerDialog({
  open,
  onOpenChange,
  symbol,
  onOpened,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  symbol: string
  onOpened: () => void
}) {
  const { branches, activeBranchId } = useAuthStore()
  const branchId = activeBranchId ?? branches[0]?.id
  const [float, setFloat] = useState('5000')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const value = Number(float)
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter the opening float — the cash you are starting the drawer with.')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/shifts', { branchId, openingFloat: value, note: note || null })
      toast.success('Drawer is open', { description: `Started with ${formatMoney(value, symbol)}.` })
      setNote('')
      onOpenChange(false)
      onOpened()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby="open-drawer-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vault className="h-5 w-5 text-primary" /> Open the drawer
          </DialogTitle>
          <DialogDescription id="open-drawer-desc">
            Count the cash you are starting with — it becomes the opening float for this shift.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="float-input">Opening float ({symbol})</Label>
            <Input
              id="float-input"
              type="number"
              min={0}
              inputMode="decimal"
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              className="font-price h-11 text-lg"
              autoFocus
            />
            <div className="flex gap-1.5 pt-1">
              {FLOAT_CHIPS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFloat(String(v))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    Number(float) === v ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'
                  )}
                >
                  {symbol} {v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift-note">Note (optional)</Label>
            <Textarea
              id="shift-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Morning shift, till 2…"
            />
          </div>
          <Button className="w-full gap-2" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Vault className="h-4 w-4" />}
            Open drawer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Count & close ---------------- */

function CloseDrawerDialog({
  shift,
  onOpenChange,
  symbol,
  businessName,
  branchName,
  onClosed,
}: {
  shift: ShiftDto | null
  onOpenChange: (o: boolean) => void
  symbol: string
  businessName: string
  branchName: string
  onClosed: () => void
}) {
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [closedReceipt, setClosedReceipt] = useState<ShiftDto | null>(null)

  useEffect(() => {
    if (shift) {
      setCounted('')
      setNote('')
      setClosedReceipt(null)
    }
  }, [shift])

  const expected = closedReceipt
    ? closedReceipt.cashExpected ?? 0
    : shift?.aggregates?.cashExpected ?? 0
  const countedNum = Number(counted)
  const variance =
    counted.trim() !== '' && Number.isFinite(countedNum) ? Math.round((countedNum - expected) * 100) / 100 : null

  const submit = async () => {
    if (!shift) return
    if (counted.trim() === '' || !Number.isFinite(countedNum) || countedNum < 0) {
      toast.error('Enter the cash you counted in the drawer.')
      return
    }
    setBusy(true)
    try {
      const closed = await api.post<ShiftDto>('/api/shifts/close', {
        shiftId: shift.id,
        countedCash: countedNum,
        note: note || null,
      })
      setClosedReceipt(closed)
      onClosed()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!shift} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="close-drawer-desc">
        {closedReceipt ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-primary" /> Drawer closed
              </DialogTitle>
              <DialogDescription id="close-drawer-desc">
                {varianceText(closedReceipt.variance ?? 0, symbol)} Print the close-out receipt for your records.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[46vh] overflow-y-auto scrollbar-thin rounded-xl border bg-white text-black">
              <div className="receipt-print bg-white">
                <ShiftReceipt shift={closedReceipt} businessName={businessName} branchName={branchName} symbol={symbol} />
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print receipt
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-primary" /> Count the drawer
              </DialogTitle>
              <DialogDescription id="close-drawer-desc">
                Count all cash in the drawer — notes and coins — and enter the total below.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border bg-muted/40 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cash expected</span>
                <span className="font-price text-lg font-bold">{formatMoney(expected, symbol)}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Float {formatMoney(shift?.openingFloat ?? 0, symbol)} + cash sales − payouts − returns
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="counted-input">Cash counted ({symbol})</Label>
              <Input
                id="counted-input"
                type="number"
                min={0}
                inputMode="decimal"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                className="font-price h-11 text-lg"
                autoFocus
              />
              {variance !== null && (
                <p
                  className={cn(
                    'font-price rounded-lg px-3 py-2 text-sm font-medium',
                    variance === 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : variance > 0
                        ? 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                        : 'bg-red-50 text-destructive dark:bg-red-950'
                  )}
                >
                  {variance === 0
                    ? 'Perfect count — drawer is even.'
                    : variance > 0
                      ? `Over by ${formatMoney(variance, symbol)} — extra cash in the drawer.`
                      : `Short by ${formatMoney(Math.abs(variance), symbol)} — cash is missing.`}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="close-note">Note (optional)</Label>
              <Textarea
                id="close-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain any variance…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button className="gap-2" onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                Close drawer
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function varianceText(variance: number, symbol: string) {
  if (variance === 0) return 'Counted cash matches perfectly.'
  if (variance > 0) return `Counted cash is over by ${formatMoney(variance, symbol)}.`
  return `Counted cash is short by ${formatMoney(Math.abs(variance), symbol)}.`
}

/* ---------------- Receipts (X-report + close receipt) ---------------- */

function ShiftReceipt({
  shift,
  businessName,
  branchName,
  symbol,
}: {
  shift: ShiftDto
  businessName: string
  branchName: string
  symbol: string
}) {
  const agg = shift.aggregates
  const isClosed = shift.status === 'CLOSED'
  return (
    <div className="receipt-sheet font-mono px-5 py-5 text-[12px] leading-relaxed">
      <div className="text-center">
        <p className="text-[15px] font-bold uppercase tracking-wide">{businessName}</p>
        <p className="text-[11px]">{isClosed ? 'SHIFT CLOSE RECEIPT (Z)' : 'DRAWER X-REPORT'}</p>
        <p className="text-[11px]">
          {branchName} · {isClosed ? `Shift ${formatDate(shift.openedAt)}` : formatDateTime(shift.openedAt)}
        </p>
        <p className="text-[10px]">Printed {formatDateTime(new Date())}</p>
      </div>

      <div className="my-3 border-t border-dashed border-black/60" />

      <div className="space-y-0.5 text-[11.5px]">
        <div className="flex justify-between">
          <span>Opened</span>
          <span>{formatDateTime(shift.openedAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Opened by</span>
          <span>{shift.openedByName}</span>
        </div>
        {isClosed && shift.closedAt && (
          <>
            <div className="flex justify-between">
              <span>Closed</span>
              <span>{formatDateTime(shift.closedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Closed by</span>
              <span>{shift.closedByName ?? '—'}</span>
            </div>
          </>
        )}
      </div>

      <div className="my-3 border-t border-dashed border-black/60" />
      <p className="mb-1 text-[11px] font-semibold">SALES DURING SHIFT</p>
      <div className="space-y-0.5 text-[11.5px]">
        <div className="flex justify-between">
          <span>Transactions</span>
          <span>{agg?.transactions ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span>Cash sales</span>
          <span>{formatMoney(agg?.cashSales ?? 0, symbol)}</span>
        </div>
        <div className="flex justify-between">
          <span>Card sales</span>
          <span>{formatMoney(agg?.cardSales ?? 0, symbol)}</span>
        </div>
        <div className="flex justify-between">
          <span>Mobile / QR sales</span>
          <span>{formatMoney(agg?.mobileSales ?? 0, symbol)}</span>
        </div>
        {(agg?.discounts ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Discounts given</span>
            <span>-{formatMoney(agg?.discounts ?? 0, symbol)}</span>
          </div>
        )}
        {(agg?.returnsTotal ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Returns refunded (cash)</span>
            <span>-{formatMoney(agg?.returnsTotal ?? 0, symbol)}</span>
          </div>
        )}
      </div>

      <div className="my-3 border-t border-dashed border-black/60" />
      <p className="mb-1 text-[11px] font-semibold">CASH DRAWER</p>
      <div className="space-y-0.5 text-[11.5px]">
        <div className="flex justify-between">
          <span>Opening float</span>
          <span>{formatMoney(shift.openingFloat, symbol)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cash expenses paid out</span>
          <span>-{formatMoney(agg?.cashExpenses ?? 0, symbol)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-black pt-1 text-[13px] font-bold">
          <span>CASH EXPECTED</span>
          <span>{formatMoney(shift.cashExpected ?? agg?.cashExpected ?? 0, symbol)}</span>
        </div>
        {isClosed && (
          <>
            <div className="mt-1 flex justify-between text-[12px]">
              <span>Counted cash</span>
              <span className="font-bold">{formatMoney(shift.countedCash ?? 0, symbol)}</span>
            </div>
            <div className="flex justify-between text-[12px] font-bold">
              <span>VARIANCE</span>
              <span>
                {(shift.variance ?? 0) > 0 ? '+' : ''}
                {formatMoney(shift.variance ?? 0, symbol)}
              </span>
            </div>
          </>
        )}
      </div>

      {shift.note && (
        <>
          <div className="my-3 border-t border-dashed border-black/60" />
          <p className="mb-1 text-[11px] font-semibold">NOTE</p>
          <p className="text-[11px]">{shift.note}</p>
        </>
      )}

      <div className="my-3 border-t border-dashed border-black/60" />
      <p className="text-center text-[10px]">Returns are assumed refunded in cash. Keep this receipt with the drawer count.</p>
      <p className="mt-1 text-center text-[10px]">Printed by Ledger POS</p>
    </div>
  )
}

/* ---------------- X-report (mid-shift) ---------------- */

function XReportDialog({
  open,
  onOpenChange,
  shift,
  symbol,
  businessName,
  branchName,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  shift: ShiftDto | null
  symbol: string
  businessName: string
  branchName: string
}) {
  if (!shift) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="xreport-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" /> X-report — drawer so far
          </DialogTitle>
          <DialogDescription id="xreport-desc">
            A mid-shift snapshot. The drawer stays open — nothing is counted or closed.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[52vh] overflow-y-auto scrollbar-thin rounded-xl border bg-white text-black">
          <div className="receipt-print bg-white">
            <ShiftReceipt shift={shift} businessName={businessName} branchName={branchName} symbol={symbol} />
          </div>
        </div>
        <Separator />
        <div className="flex justify-end">
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
