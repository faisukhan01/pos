'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, Plus, Pencil, Trash2, Loader2, Truck } from 'lucide-react'
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
import { formatMoney } from '@/lib/format'
import { QuickContact } from '@/components/pos/quick-contact'
import type { SupplierDto } from '@/lib/types'

export function SuppliersView() {
  const { user, settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierDto | null>(null)
  const [deleting, setDeleting] = useState<SupplierDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', note: '' })

  const canManage = !!user && hasPermission(user.role, PERMISSIONS.SUPPLIERS_MANAGE)

  const url = useMemo(() => {
    const sp = new URLSearchParams({ pageSize: '50' })
    if (debounced) sp.set('q', debounced)
    return `/api/suppliers?${sp.toString()}`
  }, [debounced])

  const { data, loading, refetch } = useFetch<{ items: SupplierDto[]; total: number }>(url)

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', phone: '', email: '', address: '', note: '' })
    setFormOpen(true)
  }
  const openEdit = (s: SupplierDto) => {
    setEditing(s)
    setForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', note: s.note ?? '' })
    setFormOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.name.trim().length < 2) {
      toast.error('Please enter the supplier name.')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await api.put(`/api/suppliers/${editing.id}`, form)
        toast.success('Supplier updated')
      } else {
        await api.post('/api/suppliers', form)
        toast.success('Supplier added', { description: form.name })
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
      await api.del(`/api/suppliers/${deleting.id}`)
      toast.success('Supplier removed')
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search supplier name or phone…" className="pl-9" aria-label="Search suppliers" />
        </div>
        {data && (
          <p className="hidden text-xs text-muted-foreground sm:block sm:ml-auto">
            {data.total} supplier{data.total === 1 ? '' : 's'}
          </p>
        )}
        {canManage && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add supplier</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Truck className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No suppliers yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Save the businesses you buy stock from to keep purchase history against each one.
                </p>
              </div>
              {canManage && <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add first supplier</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader className="[&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Note</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Purchased</TableHead>
                    {canManage && <TableHead className="w-24 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">{s.address ?? '—'}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {s.phone ? <QuickContact phone={s.phone} name={s.name} /> : '—'}
                      </TableCell>
                      <TableCell className="hidden max-w-[180px] truncate text-sm text-muted-foreground lg:table-cell">{s.note ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{s.purchases ?? 0}</TableCell>
                      <TableCell className="text-right font-price font-semibold">{formatMoney(s.purchaseTotal ?? 0, symbol)}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(s)} aria-label={`Remove ${s.name}`}>
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

      <Dialog open={formOpen} onOpenChange={(o) => !busy && setFormOpen(o)}>
        <DialogContent className="sm:max-w-md" aria-describedby="sup-desc">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add a supplier'}</DialogTitle>
            <DialogDescription id="sup-desc">Contact details you actually use when reordering.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Name *</Label>
              <Input id="s-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. National Distributors" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="font-price" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-addr">Address</Label>
              <Input id="s-addr" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-note">What they supply</Label>
              <Input id="s-note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Beverages & snacks" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save changes' : 'Add supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Past purchase orders keep their supplier name printed on them.</AlertDialogDescription>
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
