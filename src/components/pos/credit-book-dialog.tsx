'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Loader2, ArrowDownLeft, ArrowUpRight, SlidersHorizontal, BookOpenText, Inbox } from 'lucide-react'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { cn } from '@/lib/utils'
import { formatMoney, formatDateTime } from '@/lib/format'
import type { CreditEntryDto } from '@/lib/types'

interface CreditBookDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  customer: { id: string; name: string; phone: string | null } | null
  currencySymbol: string
  canManage: boolean
  onLedgerChanged?: () => void
}

type EntryKind = 'PAYMENT' | 'CHARGE' | 'ADJUST'

const KIND_META: Record<EntryKind, { label: string; verb: string }> = {
  PAYMENT: { label: 'Payment received', verb: 'Record payment' },
  CHARGE: { label: 'Manual charge', verb: 'Add charge' },
  ADJUST: { label: 'Adjustment', verb: 'Adjust book' },
}

export function CreditBookDialog({
  open,
  onOpenChange,
  customer,
  currencySymbol,
  canManage,
  onLedgerChanged,
}: CreditBookDialogProps) {
  const [kind, setKind] = useState<EntryKind>('PAYMENT')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const ledgerUrl = open && customer ? `/api/customers/${customer.id}/credit` : null
  const { data, loading, refetch } = useFetch<{
    customer: { id: string; name: string; phone: string | null }
    balance: number
    entries: CreditEntryDto[]
  }>(ledgerUrl)

  const balance = data?.balance ?? 0
  const quickAmounts = useMemo(() => {
    if (!balance) return []
    const opts = new Set<number>()
    for (const step of [50, 100, 500, 1000]) {
      const rounded = Math.min(Math.ceil(Math.abs(balance) / step) * step, Math.abs(balance))
      if (rounded > 0) opts.add(rounded)
      if (opts.size >= 3) break
    }
    opts.add(Math.abs(balance))
    return Array.from(opts).sort((a, b) => a - b).slice(0, 4)
  }, [balance])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer) return
    const value = Number(amount)
    if (!value || Number.isNaN(value)) {
      toast.error('Enter an amount first.')
      return
    }
    if (kind === 'ADJUST' && value < 0 && Math.abs(value) > Math.abs(balance)) {
      toast.error('That adjustment would wipe out more than the balance.')
      return
    }
    setBusy(true)
    try {
      await api.post(`/api/customers/${customer.id}/credit`, {
        type: kind,
        amount: value,
        note: note || null,
      })
      toast.success(
        kind === 'PAYMENT'
          ? `Payment of ${formatMoney(Math.abs(value), currencySymbol)} recorded`
          : kind === 'CHARGE'
            ? `${formatMoney(Math.abs(value), currencySymbol)} charged to ${customer.name}`
            : 'Book adjusted'
      )
      setAmount('')
      setNote('')
      refetch()
      onLedgerChanged?.()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby="khata-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenText className="h-5 w-5 text-primary" /> Udhaar book — {customer?.name}
          </DialogTitle>
          <DialogDescription id="khata-desc">
            Every credit sale, payment and adjustment, with the running balance.
          </DialogDescription>
        </DialogHeader>

        {/* Balance hero */}
        <div
          className={cn(
            'flex items-center justify-between rounded-2xl border px-5 py-4',
            balance > 0
              ? 'border-amber-300/70 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-900 dark:from-amber-950/50 dark:to-orange-950/30'
              : 'border-emerald-300/70 bg-gradient-to-br from-emerald-50 to-teal-50 dark:border-emerald-900 dark:from-emerald-950/50 dark:to-teal-950/30'
          )}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {balance > 0 ? 'Owes the shop' : 'Book is clear'}
            </p>
            <p className="mt-0.5 font-price text-3xl font-bold tabular-nums tracking-tight">
              {loading && !data ? '…' : formatMoney(Math.abs(balance), currencySymbol)}
            </p>
          </div>
          {balance > 0 && canManage && (
            <Button
              size="sm"
              onClick={() => {
                setKind('PAYMENT')
                setAmount(String(Math.abs(balance)))
              }}
            >
              <ArrowDownLeft className="h-4 w-4" /> Settle full
            </Button>
          )}
        </div>

        {/* Ledger timeline */}
        <div className="rounded-xl border">
          <div className="max-h-[38vh] overflow-y-auto scrollbar-thin">
            {loading && !data ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : !data || data.entries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                  <Inbox className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Nothing in the book yet</p>
                <p className="max-w-[260px] text-xs text-muted-foreground">
                  Sell on Udhaar at the counter, or record a charge below, and it will show up here.
                </p>
              </div>
            ) : (
              <ol className="divide-y">
                {data.entries.map((e) => {
                  const positive = e.amount > 0
                  const Icon = e.type === 'PAYMENT' ? ArrowDownLeft : e.type === 'CHARGE' ? ArrowUpRight : SlidersHorizontal
                  return (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          positive
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium">
                            {e.type === 'PAYMENT' ? 'Payment' : e.type === 'CHARGE' ? 'Charge' : 'Adjustment'}
                            {e.saleId ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">on invoice</span> : null}
                          </p>
                          <p
                            className={cn(
                              'font-price text-sm font-bold tabular-nums',
                              positive ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                            )}
                          >
                            {positive ? '+' : '−'}
                            {formatMoney(Math.abs(e.amount), currencySymbol)}
                          </p>
                        </div>
                        {e.note && <p className="truncate text-xs text-muted-foreground">{e.note}</p>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDateTime(e.createdAt)} · by {e.createdByName} · balance{' '}
                          <span className="font-price">{formatMoney(e.balanceAfter, currencySymbol)}</span>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>

        {canManage && (
          <>
            <Separator />
            <form onSubmit={submit} className="space-y-3">
              <div role="radiogroup" aria-label="Entry type" className="grid grid-cols-3 gap-2">
                {(['PAYMENT', 'CHARGE', 'ADJUST'] as EntryKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      'rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors',
                      kind === k ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/40'
                    )}
                  >
                    {KIND_META[k].verb}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="khata-amount">
                    Amount {kind === 'ADJUST' && <span className="text-xs text-muted-foreground">(− to reduce, + to add)</span>}
                  </Label>
                  <Input
                    id="khata-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(kind === 'ADJUST' ? /[^0-9.-]/g : /[^0-9.]/g, ''))}
                    placeholder="0"
                    className="font-price text-right"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="khata-note">Note</Label>
                  <Input
                    id="khata-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={kind === 'PAYMENT' ? 'e.g. cash received' : 'optional'}
                  />
                </div>
              </div>
              {kind === 'PAYMENT' && quickAmounts.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Quick:</span>
                  {quickAmounts.map((q) => (
                    <Button key={q} type="button" variant="outline" size="sm" className="h-7 font-price" onClick={() => setAmount(String(q))}>
                      {q.toLocaleString('en-PK')}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                <Button type="submit" disabled={busy || (kind === 'PAYMENT' && balance <= 0)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : KIND_META[kind].verb}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
