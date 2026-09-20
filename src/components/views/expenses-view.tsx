'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Loader2, Wallet, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { formatMoney, formatDate } from '@/lib/format'
import { EXPENSE_CATEGORIES, paymentLabel } from '@/lib/types'

interface ExpensesResponse {
  items: { id: string; category: string; amount: number; paymentMethod: string; description: string | null; date: string }[]
  total: number
  page: number
  pageSize: number
  grandTotal: number
}

export function ExpensesView() {
  const { user, settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ category: 'Rent', amount: '', paymentMethod: 'CASH', description: '', date: new Date().toISOString().slice(0, 10) })
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const canManage = !!user && hasPermission(user.role, PERMISSIONS.EXPENSES_MANAGE)

  const url = useMemo(() => `/api/expenses?from=${month}-01&to=${month}-31&pageSize=100`, [month])
  const { data, loading, refetch } = useFetch<ExpensesResponse>(url)

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of data?.items ?? []) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [data])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!form.category) {
      toast.error('Choose a category.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount greater than zero.')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/expenses', { ...form, amount, date: `${form.date}T12:00:00` })
      toast.success('Expense saved', { description: `${form.category} · ${formatMoney(amount, symbol)}` })
      setOpen(false)
      setForm((f) => ({ ...f, amount: '', description: '' }))
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api.del(`/api/expenses/${id}`)
      toast.success('Expense removed')
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Month"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {data && (
          <p className="hidden text-xs text-muted-foreground sm:block sm:ml-auto">
            {data.total} entr{data.total === 1 ? 'y' : 'ies'} · {formatMoney(data.grandTotal, symbol)} this month
          </p>
        )}
        {canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add expense</Button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : !data || data.items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Wallet className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No expenses this month</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Rent, utilities, transport — record money going out so profit stays honest.
                  </p>
                </div>
                {canManage && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add expense</Button>}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead className="hidden sm:table-cell">Paid by</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {canManage && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">{formatDate(e.date)}</TableCell>
                        <TableCell className="text-sm font-medium">{e.category}</TableCell>
                        <TableCell className="hidden max-w-[220px] truncate text-sm text-muted-foreground md:table-cell">{e.description ?? '—'}</TableCell>
                        <TableCell className="hidden text-sm sm:table-cell">{paymentLabel(e.paymentMethod)}</TableCell>
                        <TableCell className="text-right font-price font-semibold">{formatMoney(e.amount, symbol)}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <button
                              onClick={() => remove(e.id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove expense"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Where the money went</p>
            {!data || byCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {byCategory.map(([cat, total]) => {
                  const pct = data && data.grandTotal > 0 ? Math.round((total / data.grandTotal) * 100) : 0
                  return (
                    <li key={cat}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{cat}</span>
                        <span className="font-price">{formatMoney(total, symbol)} · {pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-sm" aria-describedby="expense-desc">
          <DialogHeader>
            <DialogTitle>Record an expense</DialogTitle>
            <DialogDescription id="expense-desc">Keep receipts — your accountant will thank you.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-amount">Amount *</Label>
                <Input id="e-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') }))} className="font-price text-right" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger aria-label="Payment method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="MOBILE">Mobile / QR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-date">Date</Label>
                <Input id="e-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-desc">Description</Label>
              <Input id="e-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. March shop rent" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
