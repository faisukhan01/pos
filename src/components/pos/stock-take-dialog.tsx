'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Loader2, ClipboardList, Search, CheckCheck } from 'lucide-react'
import { api } from '@/lib/client-api'
import { cn } from '@/lib/utils'
import type { PosProduct } from '@/lib/types'

interface StockTakeDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  branchId: string | null
  onSubmitted?: () => void
}

interface CountRow {
  productId: string
  name: string
  unit: string
  expected: number
  counted: string
}

export function StockTakeDialog({ open, onOpenChange, branchId, onSubmitted }: StockTakeDialogProps) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [rows, setRows] = useState<CountRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ adjusted: number; skippedCount: number; message: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) {
      setRows([])
      setDone(null)
      setQuery('')
      setDebounced('')
    }
  }, [open])

  useEffect(() => {
    if (!open || !branchId) return
    let alive = true
    setLoading(true)
    const sp = new URLSearchParams({ pageSize: '200', branchId })
    if (debounced) sp.set('q', debounced)
    api
      .get<{ items: (PosProduct & { category?: { name: string } | null })[] }>(`/api/products?${sp.toString()}`)
      .then((d) => {
        if (!alive) return
        setRows(
          d.items.map((p) => ({
            productId: p.id,
            name: p.name,
            unit: p.unit,
            expected: p.stock,
            counted: String(p.stock),
          }))
        )
      })
      .catch((e) => {
        if (alive) toast.error((e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, branchId, debounced])

  const changes = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, delta: (Number(r.counted) || 0) - r.expected }))
        .filter((r) => r.delta !== 0 && r.counted !== ''),
    [rows]
  )

  const setCounted = (productId: string, value: string) => {
    setRows((rs) => rs.map((r) => (r.productId === productId ? { ...r, counted: value.replace(/[^0-9]/g, '') } : r)))
  }

  const markAllMatched = () => {
    setRows((rs) => rs.map((r) => ({ ...r, counted: String(r.expected) })))
    toast.info('All counted as matching — nothing will be adjusted.')
  }

  const submit = async () => {
    if (!branchId || changes.length === 0 || busy) return
    setBusy(true)
    try {
      const res = await api.post<{ adjusted: number; skippedCount: number; message: string; applied: { name: string; delta: number; unit: string }[] }>(
        '/api/inventory/stock-take',
        {
          branchId,
          counts: changes.map((c) => ({ productId: c.productId, counted: Number(c.counted), expected: c.expected })),
        }
      )
      setDone(res)
      toast.success(res.message, {
        description: res.applied
          .slice(0, 3)
          .map((a) => `${a.name} ${a.delta > 0 ? '+' : ''}${a.delta} ${a.unit}`)
          .concat(res.applied.length > 3 ? [`…and ${res.applied.length - 3} more`] : [])
          .join(' · '),
      })
      onSubmitted?.()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-xl" aria-describedby="stocktake-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Stock take — physical count
          </DialogTitle>
          <DialogDescription id="stocktake-desc">
            Count what is actually on the shelf. Only rows where the count differs from the system will be adjusted, and every correction is recorded in the movement log.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300/60 bg-emerald-50 px-6 py-10 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
              <CheckCheck className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <p className="font-semibold">{done.message}</p>
              {done.skippedCount > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {done.skippedCount} row{done.skippedCount === 1 ? '' : 's'} skipped — the shelf changed while you were counting.
                </p>
              )}
            </div>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter products…" className="pl-9" aria-label="Filter products" />
              </div>
              <Button variant="outline" onClick={markAllMatched} disabled={loading}>All match</Button>
            </div>

            <div className="max-h-[42vh] overflow-y-auto scrollbar-thin rounded-xl border">
              {loading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
                </div>
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No products to count.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-2 py-2 text-right font-medium">System</th>
                      <th className="px-2 py-2 text-center font-medium">Counted</th>
                      <th className="px-3 py-2 text-right font-medium">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => {
                      const delta = r.counted === '' ? null : (Number(r.counted) || 0) - r.expected
                      return (
                        <tr key={r.productId}>
                          <td className="max-w-[240px] truncate px-3 py-1.5">{r.name}</td>
                          <td className="px-2 py-1.5 text-right font-price tabular-nums text-muted-foreground">{r.expected}</td>
                          <td className="px-2 py-1 text-center">
                            <Input
                              value={r.counted}
                              onChange={(e) => setCounted(r.productId, e.target.value)}
                              inputMode="numeric"
                              className="mx-auto h-8 w-20 text-center font-price"
                              aria-label={`Counted quantity for ${r.name}`}
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {delta === null || delta === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'font-price',
                                  delta > 0
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'border-destructive/40 bg-destructive/5 text-destructive'
                                )}
                              >
                                {delta > 0 ? '+' : ''}{delta} {r.unit}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {changes.length === 0 ? (
                  'No differences yet — count the shelf and type what you see.'
                ) : (
                  <>
                    <span className="font-medium text-foreground">{changes.length}</span> product{changes.length === 1 ? '' : 's'} will be adjusted.
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
                <Button onClick={submit} disabled={busy || changes.length === 0}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Apply {changes.length > 0 ? changes.length : ''} correction{changes.length === 1 ? '' : 's'}</>}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
