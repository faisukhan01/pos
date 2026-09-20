'use client'

import { Minus, Plus, Trash2, UserRound, ShoppingBasket, X, PauseCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cartTotals, useCartStore, useHeldStore } from '@/lib/store'
import { toast } from 'sonner'
import { formatMoney } from '@/lib/format'
import { useFetch } from '@/hooks/use-fetch'
import type { CustomerDto } from '@/lib/types'

interface CartPanelProps {
  currencySymbol: string
  onCharge: () => void
  busy?: boolean
}

export function CartPanel({ currencySymbol, onCharge, busy }: CartPanelProps) {
  const { lines, customerId, customerName, discount, add, setQty, remove, setCustomer, setDiscount, clear } = useCartStore()
  const hold = useHeldStore((s) => s.hold)
  const { data: customersData } = useFetch<{ items: CustomerDto[] }>('/api/customers?pageSize=100')
  const totals = cartTotals(lines, discount)

  const holdCurrent = () => {
    const label = customerName !== 'Walk-in Customer' ? customerName : `${totals.itemCount} item${totals.itemCount === 1 ? '' : 's'} · ${formatMoney(totals.total, currencySymbol)}`
    const snapshot = hold(label)
    if (snapshot) {
      toast.success('Sale put on hold', { description: `${label} — recall it any time from Held.` })
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card shadow-sm" aria-label="Shopping cart">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="h-4.5 w-4.5 text-primary" />
          <h2 className="text-sm font-semibold">Current sale</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'}
          </span>
        </div>
        {lines.length > 0 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={holdCurrent}
              aria-label="Hold current sale"
            >
              <PauseCircle className="h-3.5 w-3.5" /> Hold
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clear} aria-label="Clear cart">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShoppingBasket className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Cart is empty</p>
            <p className="max-w-[220px] text-xs text-muted-foreground">
              Scan a barcode or tap a product to start the sale.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((line) => (
              <li key={line.productId} className="rounded-xl border bg-background px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="font-price text-xs text-muted-foreground">
                      {formatMoney(line.unitPrice, currencySymbol)} / {line.unit}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(line.productId)}
                    aria-label={`Remove ${line.name}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center rounded-lg border">
                    <button
                      onClick={() => setQty(line.productId, line.quantity - 1)}
                      aria-label="Decrease quantity"
                      className="flex h-7 w-7 items-center justify-center rounded-l-md transition-colors hover:bg-muted disabled:opacity-40"
                      disabled={line.quantity <= 1}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      value={line.quantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
                        setQty(line.productId, Number.isFinite(v) && v > 0 ? v : 0)
                      }}
                      aria-label={`Quantity of ${line.name}`}
                      className="h-7 w-10 border-x bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => {
                        const res = add(
                          {
                            productId: line.productId,
                            name: line.name,
                            barcode: line.barcode,
                            unitPrice: line.unitPrice,
                            maxStock: line.maxStock,
                            taxRate: line.taxRate,
                            unit: line.unit,
                          },
                          1
                        )
                        if (res === 'max_reached' || res === 'out_of_stock') {
                          // signal handled silently — stock cap is visible on the stepper below
                        }
                      }}
                      aria-label="Increase quantity"
                      className="flex h-7 w-7 items-center justify-center rounded-r-md transition-colors hover:bg-muted disabled:opacity-40"
                      disabled={line.quantity >= line.maxStock}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="font-price text-sm font-semibold">
                    {formatMoney(line.unitPrice * line.quantity, currencySymbol)}
                  </span>
                </div>
                {line.maxStock <= 5 && (
                  <p className="mt-1 text-[11px] text-amber-600">Only {line.maxStock} left on the shelf</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals + actions */}
      <div className="border-t px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Select
            value={customerId ?? 'walkin'}
            onValueChange={(v) => {
              if (v === 'walkin') setCustomer(null, 'Walk-in Customer')
              else {
                const c = customersData?.items.find((x) => x.id === v)
                setCustomer(v, c?.name ?? 'Customer')
              }
            }}
          >
            <SelectTrigger size="sm" className="flex-1" aria-label="Customer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walkin">Walk-in Customer</SelectItem>
              {customersData?.items.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <label htmlFor="discount" className="text-muted-foreground">Discount (Rs)</label>
          <Input
            id="discount"
            inputMode="decimal"
            value={discount || ''}
            onChange={(e) => setDiscount(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
            placeholder="0"
            className="h-8 w-24 text-right font-price"
          />
        </div>

        <Separator />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-price">{formatMoney(totals.subtotal, currencySymbol)}</span>
          </div>
          {totals.tax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span className="font-price">{formatMoney(totals.tax, currencySymbol)}</span>
            </div>
          )}
          {totals.discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span className="font-price">-{formatMoney(totals.discount, currencySymbol)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-primary px-4 py-2.5 text-primary-foreground">
          <span className="text-sm font-medium">Total due</span>
          <span className="font-price text-xl font-bold tracking-tight">
            {formatMoney(totals.total, currencySymbol)}
          </span>
        </div>

        <Button
          size="lg"
          className="h-12 w-full text-base font-semibold"
          disabled={lines.length === 0 || busy}
          onClick={onCharge}
        >
          Charge {formatMoney(totals.total, currencySymbol)}
        </Button>
      </div>
    </div>
  )
}
