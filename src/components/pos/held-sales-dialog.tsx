'use client'

import { useState } from 'react'
import { PauseCircle, Play, Trash2, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cartTotals, useCartStore, useHeldStore, type HeldSale } from '@/lib/store'
import { formatMoney, formatTime } from '@/lib/format'
import { useAuthStore } from '@/lib/store'

// Parked sales live on this device (persisted) — deliberately not on the
// server: they belong to the counter, not the books.
export function HeldSalesDialog({
  open,
  onOpenChange,
  currencySymbol,
  onRecalled,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  currencySymbol: string
  onRecalled?: () => void
}) {
  const { held, recall, remove } = useHeldStore()
  const cartCount = useCartStore((s) => s.lines.length)
  const [confirming, setConfirming] = useState<HeldSale | null>(null)

  const doRecall = (h: HeldSale) => {
    recall(h.id)
    setConfirming(null)
    onOpenChange(false)
    onRecalled?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" aria-describedby="held-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-primary" /> Held sales
            </DialogTitle>
            <DialogDescription id="held-desc">
              Parked on this device until recalled. Useful when a customer steps away to fetch cash.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
            {held.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <PauseCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Nothing on hold</p>
                <p className="max-w-[240px] text-xs text-muted-foreground">
                  Press <span className="font-semibold">Hold</span> on the cart to park the current sale and start a
                  fresh one.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {held.map((h) => {
                  const t = cartTotals(h.lines, h.discount)
                  return (
                    <li key={h.id} className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{h.label}</p>
                          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" /> {formatTime(h.at)} · {t.itemCount} item
                            {t.itemCount === 1 ? '' : 's'} · {h.customerName}
                          </p>
                        </div>
                        <span className="font-price text-sm font-semibold">{formatMoney(t.total, currencySymbol)}</span>
                      </div>
                      <div className="mt-2.5 flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 flex-1 gap-1.5"
                          onClick={() => (cartCount > 0 ? setConfirming(h) : doRecall(h))}
                        >
                          <Play className="h-3.5 w-3.5" /> Recall
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            remove(h.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Discard
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the current cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has {cartCount} item{cartCount === 1 ? '' : 's'}. Recalling a held sale replaces the cart with
              the held one. Hold the current cart first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current cart</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirming && doRecall(confirming)}>Replace cart</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
