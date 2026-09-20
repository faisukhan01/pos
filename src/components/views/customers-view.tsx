'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, Plus, Pencil, Trash2, Loader2, Users, Phone, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { formatMoney, formatDate } from '@/lib/format'
import type { CustomerDto } from '@/lib/types'

export function CustomersView() {
  const { user, settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerDto | null>(null)
  const [deleting, setDeleting] = useState<CustomerDto | null>(null)
  const [busy, setBusy] = useState(false)

  const canManage = !!user && hasPermission(user.role, PERMISSIONS.CUSTOMERS_MANAGE)

  const url = useMemo(() => {
    const sp = new URLSearchParams({ pageSize: '50' })
    if (debounced) sp.set('q', debounced)
    return `/api/customers?${sp.toString()}`
  }, [debounced])

  const { data, loading, refetch } = useFetch<{ items: CustomerDto[]; total: number }>(url)

  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', note: '' })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', phone: '', email: '', address: '', note: '' })
    setFormOpen(true)
  }
  const openEdit = (c: CustomerDto) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', note: '' })
    setFormOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.name.trim().length < 2) {
      toast.error('Please enter the customer name.')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await api.put(`/api/customers/${editing.id}`, form)
        toast.success('Customer updated')
      } else {
        await api.post('/api/customers', form)
        toast.success('Customer added', { description: form.name })
      }
      setFormOpen(false)
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.del(`/api/customers/${deleting.id}`)
      toast.success('Customer removed')
      setDeleting(null)
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or phone…" className="pl-9" aria-label="Search customers" />
        </div>
        {data && (
          <p className="hidden text-xs text-muted-foreground sm:block sm:ml-auto">
            {data.total} customer{data.total === 1 ? '' : 's'}
          </p>
        )}
        {canManage && (
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add customer</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No customers saved</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Walk-in customers can always check out without an account. Save regulars here to track their purchases.
                </p>
              </div>
              {canManage && <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add first customer</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Address</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total spent</TableHead>
                    {canManage && <TableHead className="w-24 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {c.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <p className="font-medium">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">Since {formatDate(c.createdAt)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.phone ? (
                          <span className="flex items-center gap-1.5 text-sm font-price">{<Phone className="h-3 w-3 text-muted-foreground" />}{c.phone}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="hidden max-w-[200px] truncate text-sm text-muted-foreground lg:table-cell">
                        {c.address ? <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{c.address}</span> : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.orders ?? 0}</TableCell>
                      <TableCell className="text-right font-price font-semibold">{formatMoney(c.totalSpent ?? 0, symbol)}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(c)} aria-label={`Remove ${c.name}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !busy && setFormOpen(o)}>
        <DialogContent className="sm:max-w-md" aria-describedby="cust-desc">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add a customer'}</DialogTitle>
            <DialogDescription id="cust-desc">Keep it light — a name and phone number are enough.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name *</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Kiran Bibi" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+92 3xx 1234567" className="font-price" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-addr">Address</Label>
              <Input id="c-addr" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="optional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save changes' : 'Add customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their past invoices stay in your records — only the customer profile is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); confirmDelete() }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
