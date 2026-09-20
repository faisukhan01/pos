'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Users, KeyRound, UserCheck, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { ROLE_PERMISSIONS, roleLabel } from '@/lib/permissions'
import { formatDate } from '@/lib/format'

interface StaffUser {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  branchId: string | null
  branchName: string | null
  createdAt: string
}

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_STAFF', 'ACCOUNTANT'] as const

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'border-primary/40 bg-primary/10 text-primary',
  ADMIN: 'border-primary/30 text-primary',
  MANAGER: 'border-sky-300 text-sky-700 dark:text-sky-300',
  CASHIER: 'border-amber-300 text-amber-700 dark:text-amber-300',
  INVENTORY_STAFF: 'border-teal-300 text-teal-700 dark:text-teal-300',
  ACCOUNTANT: 'border-purple-300 text-purple-700 dark:text-purple-300',
}

export function StaffView() {
  const { user: me, branches } = useAuthStore()
  const { data, loading, refetch } = useFetch<StaffUser[]>('/api/users')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [deleting, setDeleting] = useState<StaffUser | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER' as (typeof ROLES)[number],
    branchId: 'none',
    newPassword: '',
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', email: '', password: '', role: 'CASHIER', branchId: 'none', newPassword: '' })
    setFormOpen(true)
  }

  const openEdit = (u: StaffUser) => {
    setEditing(u)
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role as (typeof ROLES)[number],
      branchId: u.branchId ?? 'none',
      newPassword: '',
    })
    setFormOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (editing) {
        await api.patch(`/api/users/${editing.id}`, {
          name: form.name,
          role: form.role,
          branchId: form.branchId === 'none' ? null : form.branchId,
          ...(form.newPassword ? { password: form.newPassword } : {}),
        })
        toast.success('Staff account updated', { description: `${form.name} — ${roleLabel(form.role)}` })
      } else {
        await api.post('/api/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          branchId: form.branchId === 'none' ? null : form.branchId,
        })
        toast.success('Staff account created', { description: `${form.name} can now sign in.` })
      }
      setFormOpen(false)
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (u: StaffUser) => {
    try {
      await api.patch(`/api/users/${u.id}`, { active: !u.active })
      toast.success(u.active ? `${u.name} deactivated` : `${u.name} reactivated`)
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.del(`/api/users/${deleting.id}`)
      toast.success('Staff account removed')
      setDeleting(null)
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const permCount = (role: string) => (ROLE_PERMISSIONS[role] ?? []).length

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground max-w-lg">
            Control who can sign in and what they can reach. Permissions are enforced on the server, not just hidden
            in the menu.
          </p>
        </div>
        <Button className="sm:ml-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add staff
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Branch</TableHead>
                    <TableHead className="hidden lg:table-cell">Permissions</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.map((u) => {
                    const isSelf = me?.id === u.id
                    return (
                      <TableRow key={u.id} className={!u.active ? 'opacity-60' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {u.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                            </div>
                            <div>
                              <p className="font-medium">
                                {u.name}
                                {isSelf && <span className="ml-1.5 text-[10px] font-semibold uppercase text-muted-foreground">(you)</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ROLE_BADGE[u.role] ?? ''}>
                            {roleLabel(u.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-sm md:table-cell">{u.branchName ?? 'All branches'}</TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {permCount(u.role)} of 19
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={u.active}
                              onCheckedChange={() => toggleActive(u)}
                              disabled={busy || isSelf}
                              aria-label={`${u.active ? 'Deactivate' : 'Activate'} ${u.name}`}
                            />
                            <span className="text-xs text-muted-foreground">{u.active ? 'Active' : 'Disabled'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleting(u)}
                              disabled={isSelf}
                              aria-label={`Remove ${u.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !busy && setFormOpen(o)}>
        <DialogContent className="sm:max-w-md" aria-describedby="staff-form-desc">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add a staff account'}</DialogTitle>
            <DialogDescription id="staff-form-desc">
              {editing
                ? 'Role and branch apply immediately — the person may need to refresh their screen.'
                : 'They will sign in with this email and password at the same screen you use.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Full name *</Label>
              <Input id="u-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Ayesha Siddiqui" />
            </div>
            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="u-email">Email *</Label>
                  <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@store.pk" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="u-pass">Password *</Label>
                  <Input id="u-pass" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="At least 6 characters" />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as (typeof ROLES)[number] }))}>
                  <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{permCount(form.role)} permissions granted</p>
              </div>
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}>
                  <SelectTrigger aria-label="Branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label htmlFor="u-newpass" className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> Reset password (optional)
                </Label>
                <Input id="u-newpass" type="password" value={form.newPassword} onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))} placeholder="Leave empty to keep current password" />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save changes' : 'Create account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}&apos;s account?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to sign in. Past invoices keep the cashier name that was printed on them.
              To keep the account but block access, deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
