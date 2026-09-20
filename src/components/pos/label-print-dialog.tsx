'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { toast } from 'sonner'
import { Tags, Printer, Loader2, Minus, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'
import type { PosProduct } from '@/lib/types'

const LABEL_SIZES = {
  L: { key: 'L', name: 'Large — 50 × 30 mm', w: 50, h: 30, cols: 4, rows: 9 },
  M: { key: 'M', name: 'Medium — 40 × 30 mm', w: 40, h: 30, cols: 5, rows: 9 },
  S: { key: 'S', name: 'Small — 38 × 25 mm', w: 38, h: 25, cols: 5, rows: 11 },
} as const
type LabelSizeKey = keyof typeof LABEL_SIZES

const MAX_LABELS = 400

// Renders a Code128 barcode into an SVG element.
function BarcodeSvg({ value, height }: { value: string; height: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        width: 1.3,
        height,
        displayValue: false,
        margin: 0,
        lineColor: '#000000',
      })
    } catch {
      // Value not encodable — leave the SVG empty rather than crash the sheet.
    }
  }, [value, height])
  return <svg ref={ref} className="max-w-full" aria-hidden />
}

export function LabelPrintDialog({
  open,
  onOpenChange,
  products,
  preselectId,
  currencySymbol,
  businessName,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  products: (PosProduct & { category?: { name: string; color: string } | null })[]
  preselectId?: string | null
  currencySymbol: string
  businessName: string
}) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [sizeKey, setSizeKey] = useState<LabelSizeKey>('L')
  const [lastOpen, setLastOpen] = useState(false)

  // Seed the selection each time the dialog opens (render-phase state adjustment —
  // the React-recommended alternative to resetting in an effect).
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      if (preselectId) {
        setQty({ [preselectId]: 12 })
      } else {
        const seed: Record<string, number> = {}
        for (const p of products.slice(0, 6)) seed[p.id] = 12
        setQty(seed)
      }
      setSizeKey('L')
    }
  }

  const selected = useMemo(
    () =>
      Object.entries(qty)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => ({ product: products.find((p) => p.id === id), count: n }))
        .filter((e): e is { product: PosProduct; count: number } => !!e.product),
    [qty, products]
  )
  const totalLabels = selected.reduce((s, e) => s + e.count, 0)

  const toggle = (id: string, on: boolean) => {
    setQty((q) => {
      const next = { ...q }
      if (on) next[id] = next[id] ?? 12
      else delete next[id]
      return next
    })
  }
  const step = (id: string, delta: number) => {
    setQty((q) => {
      const cur = q[id] ?? 0
      const next = Math.max(0, Math.min(99, cur + delta))
      // Respect the global sheet cap.
      if (totalLabels - cur + next > MAX_LABELS) return q
      return { ...q, [id]: next }
    })
  }

  const size = LABEL_SIZES[sizeKey]
  const perPage = size.cols * size.rows
  const pages = Math.ceil(totalLabels / perPage)

  const print = () => {
    if (totalLabels === 0) {
      toast.error('Select at least one product to print labels.')
      return
    }
    window.print()
  }

  // Expand selections into the flat label list for the sheet.
  const labels = useMemo(
    () =>
      selected.flatMap(({ product, count }) =>
        Array.from({ length: count }, (_, i) => ({ product, i }))
      ),
    [selected]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" aria-describedby="labels-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" /> Barcode labels
          </DialogTitle>
          <DialogDescription id="labels-desc">
            Pick products and quantities, then print a label sheet — sized for pre-cut label paper or plain A4 with cut lines.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,280px)_1fr]">
          {/* Left: selection */}
          <div className="space-y-3">
            <div className="flex gap-1.5">
              {(Object.keys(LABEL_SIZES) as LabelSizeKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSizeKey(k)}
                  className={cn(
                    'flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors',
                    sizeKey === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'
                  )}
                >
                  {LABEL_SIZES[k].name.split(' — ')[0]}
                  <span className="block text-[10px] font-normal opacity-75">{LABEL_SIZES[k].w}×{LABEL_SIZES[k].h}mm</span>
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {totalLabels} label{totalLabels === 1 ? '' : 's'} · {pages} A4 page{pages === 1 ? '' : 's'} · max {MAX_LABELS}
            </p>

            <ScrollArea className="h-[320px] rounded-xl border">
              <div className="divide-y">
                {products.map((p) => {
                  const on = (qty[p.id] ?? 0) > 0
                  return (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`Select ${p.name} for labels`}
                        onClick={() => toggle(p.id, !on)}
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-primary/50'
                        )}
                      >
                        {on && <span className="text-[9px] font-bold leading-none">✓</span>}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium leading-tight">{p.name}</p>
                        <p className="font-price text-[11px] text-muted-foreground">
                          {formatMoney(p.sellingPrice, currencySymbol)} · {p.barcode ?? p.sku ?? 'no code'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => step(p.id, -6)}
                          disabled={!on}
                          aria-label={`Fewer labels for ${p.name}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="font-price w-7 text-center text-xs font-semibold">{qty[p.id] ?? 0}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => step(p.id, 6)}
                          aria-label={`More labels for ${p.name}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {products.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">No products on this page.</p>
                )}
              </div>
            </ScrollArea>

            <Button className="gap-2" onClick={print}>
              <Printer className="h-4 w-4" /> Print {totalLabels} label{totalLabels === 1 ? '' : 's'}
            </Button>
          </div>

          {/* Right: live sheet preview (scaled) */}
          <div className="overflow-hidden rounded-xl border bg-muted/40 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Sheet preview — A4, {size.cols} × {size.rows} per page
            </p>
            <div className="max-h-[380px] overflow-auto scrollbar-thin rounded-md bg-white">
              <div className="origin-top-left" style={{ transform: 'scale(0.52)', width: '210mm' }}>
                <LabelSheet
                  labels={labels}
                  businessName={businessName}
                  currencySymbol={currencySymbol}
                  size={size}
                  preview
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LabelSheet({
  labels,
  businessName,
  currencySymbol,
  size,
  preview = false,
}: {
  labels: { product: PosProduct; i: number }[]
  businessName: string
  currencySymbol: string
  size: (typeof LABEL_SIZES)[LabelSizeKey]
  preview?: boolean
}) {
  const rows = Math.ceil(labels.length / size.cols)
  return (
    <div
      className={cn('label-print bg-white p-0', !preview && 'shadow-none')}
      style={{ width: '210mm', minHeight: preview ? `${Math.max(rows, 1) * size.h}mm` : undefined }}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${size.cols}, ${size.w}mm)` }}
      >
        {labels.map(({ product, i }) => (
          <div
            key={`${product.id}-${i}`}
            className={cn(
              'label-cell flex flex-col items-center justify-between overflow-hidden px-1 py-1 text-black',
              preview ? 'border border-dashed border-neutral-300' : ''
            )}
            style={{ width: `${size.w}mm`, height: `${size.h}mm` }}
          >
            <p className="w-full truncate text-center text-[7px] font-semibold uppercase tracking-wide text-neutral-600">
              {businessName}
            </p>
            <p className="line-clamp-2 w-full text-center text-[8.5px] font-medium leading-tight">
              {product.name}
            </p>
            <p className="font-price text-[13px] font-bold leading-none">
              {formatMoney(product.sellingPrice, currencySymbol)}
            </p>
            <div className="flex w-full flex-col items-center">
              <BarcodeSvg value={product.barcode ?? product.sku ?? product.id} height={size.h >= 30 ? 22 : 16} />
              <span className="font-mono text-[6.5px] tracking-wide">{product.barcode ?? product.sku ?? ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
