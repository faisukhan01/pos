'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Banknote, CreditCard, Smartphone, Check } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PAYMENT_METHODS } from '@/lib/types'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  total: number
  currencySymbol: string
  onComplete: (method: 'CASH' | 'CARD' | 'MOBILE', amountReceived: number) => Promise<void>
}

const METHOD_ICONS = { CASH: Banknote, CARD: CreditCard, MOBILE: Smartphone }

export function PaymentDialog({ open, onOpenChange, total, currencySymbol, onComplete }: PaymentDialogProps) {
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'MOBILE'>('CASH')
  const [received, setReceived] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setMethod('CASH')
      setReceived('')
      setBusy(false)
    }
  }, [open])

  const receivedNum = Number(received) || 0
  const change = Math.max(0, receivedNum - total)
  const enough = method !== 'CASH' || receivedNum >= total

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
    if (!enough || busy) return
    setBusy(true)
    try {
      await onComplete(method, method === 'CASH' ? receivedNum : total)
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

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
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
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3.5 text-sm transition-colors',
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
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
            {method === 'CARD' ? 'Insert, tap or swipe the card on the terminal.' : 'Show the QR code and confirm the mobile transfer.'}
            <p className="mt-1 text-foreground font-medium">Charge {formatMoney(total, currencySymbol)}</p>
          </div>
        )}

        <Button size="lg" className="h-12 w-full text-base" disabled={!enough || busy} onClick={confirm}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> Complete sale</>}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
