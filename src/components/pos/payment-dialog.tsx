'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Banknote, CreditCard, Smartphone, Check, BookOpenText, UserRound, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/client-api'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PAYMENT_METHODS } from '@/lib/types'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  total: number
  currencySymbol: string
  customerId: string | null
  customerName: string
  onComplete: (method: 'CASH' | 'CARD' | 'MOBILE' | 'CREDIT', amountReceived: number) => Promise<void>
}

const METHOD_ICONS = { CASH: Banknote, CARD: CreditCard, MOBILE: Smartphone, CREDIT: BookOpenText }

export function PaymentDialog({
  open,
  onOpenChange,
  total,
  currencySymbol,
  customerId,
  customerName,
  onComplete,
}: PaymentDialogProps) {
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'MOBILE' | 'CREDIT'>('CASH')
  const [received, setReceived] = useState('')
  const [cashNow, setCashNow] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setMethod('CASH')
      setReceived('')
      setCashNow('')
      setBusy(false)
    }
  }, [open])

  // Fetch the customer's udhaar balance when the Udhaar tab becomes relevant.
  useEffect(() => {
    setBalance(null)
    if (!open || method !== 'CREDIT' || !customerId) return
    let alive = true
    api
      .get<{ balance: number }>(`/api/customers/${customerId}/credit`)
      .then((d) => {
        if (alive) setBalance(d.balance)
      })
      .catch(() => {
        if (alive) setBalance(0)
      })
    return () => {
      alive = false
    }
  }, [open, method, customerId])

  const receivedNum = Number(received) || 0
  const cashNowNum = Number(cashNow) || 0
  const change = Math.max(0, receivedNum - total)
  const cashShort = cashNowNum < 0 || cashNowNum > total
  const enough = method !== 'CASH' || receivedNum >= total
  const creditBlocked = method === 'CREDIT' && (!customerId || cashShort)
  const canConfirm = enough && !creditBlocked && !busy

  const quickAmounts = useMemo(() => {
    const opts = new Set<number>([total])
    for (const step of [50, 100, 500, 1000, 5000]) {
      const rounded = Math.ceil(total / step) * step
      if (rounded >= total) opts.add(rounded)
      const next = rounded + step
      if (next >= total && opts.size < 4) opts.add(next)
    }
    return Array.from(opts).sort((a, b) => a - b).slice(0, 4)
  }, [total])

  const confirm = async () => {
    if (!canConfirm) return
    setBusy(true)
    try {
      const amount =
        method === 'CASH' ? receivedNum : method === 'CREDIT' ? Math.min(cashNowNum, total) : total
      await onComplete(method, amount)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-sm" aria-describedby="payment-desc">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription id="payment-desc">
            Collect <span className="font-price font-semibold text-foreground">{formatMoney(total, currencySymbol)}</span> from the customer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Payment method">
          {PAYMENT_METHODS.map((m) => {
            const Icon = METHOD_ICONS[m.value]
            const active = method === m.value
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMethod(m.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-sm transition-colors',
                  active
                    ? 'border-primary bg-accent text-accent-foreground font-medium'
                    : 'border-border bg-card hover:border-primary/35'
                )}
              >
                <Icon className="h-5 w-5" />
                {m.label}
              </button>
            )
          })}
        </div>

        {method === 'CASH' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((amt) => (
                <Button key={amt} type="button" variant="outline" size="sm" className="font-price" onClick={() => setReceived(String(amt))}>
                  {amt.toLocaleString('en-PK')}
                </Button>
              ))}
            </div>
            <div>
              <label htmlFor="received" className="mb-1.5 block text-sm font-medium">Amount received</label>
              <Input
                id="received"
                inputMode="decimal"
                value={received}
                onChange={(e) => setReceived(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                className="h-12 text-lg font-price text-right"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-sm text-muted-foreground">Change to return</span>
              <span className={cn('font-price text-xl font-semibold', !enough && 'text-destructive')}>
                {formatMoney(change, currencySymbol)}
              </span>
            </div>
            {!enough && received !== '' && (
              <p className="text-sm text-destructive">
                Still need {formatMoney(total - receivedNum, currencySymbol)} to cover the bill.
              </p>
            )}
          </div>
        ) : method === 'CREDIT' ? (
          <div className="space-y-3">
            {customerId ? (
              <>
                <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3.5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {balance === null ? 'Checking udhaar book…' : balance > 0 ? `Already owes ${formatMoney(balance, currencySymbol)}` : 'Book is clear — no udhaar yet'}
                    </p>
                  </div>
                </div>
                <div>
                  <label htmlFor="cash-now" className="mb-1.5 block text-sm font-medium">Cash paid now (optional)</label>
                  <Input
                    id="cash-now"
                    inputMode="decimal"
                    value={cashNow}
                    onChange={(e) => setCashNow(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    className="h-11 font-price text-right"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
                  <span className="text-sm font-medium text-amber-900 dark:text-amber-300">Added to udhaar book</span>
                  <span className="font-price text-lg font-bold text-amber-900 dark:text-amber-200">
                    {formatMoney(Math.max(0, total - cashNowNum), currencySymbol)}
                  </span>
                </div>
                {cashShort && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> Cash paid now cannot exceed the bill total.
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Udhaar needs a saved customer — pick who is taking the credit from the <strong>Customer</strong> selector in the cart first.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
            {method === 'CARD' ? 'Insert, tap or swipe the card on the terminal.' : 'Show the QR code and confirm the mobile transfer.'}
            <p className="mt-1 text-foreground font-medium">Charge {formatMoney(total, currencySymbol)}</p>
          </div>
        )}

        <Button size="lg" className="h-12 w-full text-base" disabled={!canConfirm} onClick={confirm}>
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>{method === 'CREDIT' ? <BookOpenText className="h-5 w-5" /> : <Check className="h-5 w-5" />} {method === 'CREDIT' ? 'Write in udhaar book' : 'Complete sale'}</>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
