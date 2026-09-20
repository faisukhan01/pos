'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Store, ReceiptText, MapPin, Users, Coins, Plus, Building2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS, roleLabel } from '@/lib/permissions'
import type { Branch } from '@/lib/types'

interface SettingsResponse {
  business: { id: string; name: string; businessType: string; currency: string; phone: string | null; email: string | null; address: string | null }
  settings: {
    receiptHeader: string
    receiptFooter: string
    currencySymbol: string
    showLogo: boolean
    lowStockAlerts: boolean
    taxInclusive: boolean
  } | null
  branchCount: number
  userCount: number
}

export function SettingsView() {
  const { user, updateSettings, setBranches: setStoreBranches } = useAuthStore()
  const { data, loading, refetch } = useFetch<SettingsResponse>('/api/settings')
  const { data: branchList, refetch: refetchBranches } = useFetch<Branch[]>('/api/branches')
  const canManage = !!user && hasPermission(user.role, PERMISSIONS.SETTINGS_MANAGE)

  const [business, setBusiness] = useState({ name: '', phone: '', email: '', address: '', businessType: 'RETAIL' })
  const [prefs, setPrefs] = useState({ receiptHeader: '', receiptFooter: '', currencySymbol: 'Rs', showLogo: true, lowStockAlerts: true, taxInclusive: false })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) {
      setBusiness({
        name: data.business.name ?? '',
        phone: data.business.phone ?? '',
        email: data.business.email ?? '',
        address: data.business.address ?? '',
        businessType: data.business.businessType ?? 'RETAIL',
      })
      setPrefs({
        receiptHeader: data.settings?.receiptHeader ?? '',
        receiptFooter: data.settings?.receiptFooter ?? '',
        currencySymbol: data.settings?.currencySymbol ?? 'Rs',
        showLogo: data.settings?.showLogo ?? true,
        lowStockAlerts: data.settings?.lowStockAlerts ?? true,
        taxInclusive: data.settings?.taxInclusive ?? false,
      })
    }
  }, [data])

  const save = async () => {
    setBusy(true)
    try {
      await api.put('/api/settings', {
        business: {
          name: business.name,
          phone: business.phone || null,
          email: business.email || null,
          address: business.address || null,
          businessType: business.businessType,
        },
        settings: {
          receiptHeader: prefs.receiptHeader,
          receiptFooter: prefs.receiptFooter,
          currencySymbol: prefs.currencySymbol,
          showLogo: prefs.showLogo,
          lowStockAlerts: prefs.lowStockAlerts,
          taxInclusive: prefs.taxInclusive,
        },
      })
      toast.success('Settings saved')
      updateSettings({
        receiptHeader: prefs.receiptHeader,
        receiptFooter: prefs.receiptFooter,
        currencySymbol: prefs.currencySymbol,
        showLogo: prefs.showLogo,
        lowStockAlerts: prefs.lowStockAlerts,
        taxInclusive: prefs.taxInclusive,
      })
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
      {!canManage && (
        <p className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          You can view business settings, but only the owner or an administrator can change them.
        </p>
      )}

      {/* Business profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px] tracking-tight">
            <Store className="h-4 w-4 text-primary" /> Business profile
          </CardTitle>
          <CardDescription>Appears on receipts and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3.5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="b-name">Business name</Label>
            <Input id="b-name" value={business.name} onChange={(e) => setBusiness((b) => ({ ...b, name: e.target.value }))} disabled={!canManage} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-phone">Phone</Label>
            <Input id="b-phone" value={business.phone} onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))} disabled={!canManage} className="font-price" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-email">Email</Label>
            <Input id="b-email" type="email" value={business.email} onChange={(e) => setBusiness((b) => ({ ...b, email: e.target.value }))} disabled={!canManage} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="b-addr">Address</Label>
            <Textarea id="b-addr" rows={2} value={business.address} onChange={(e) => setBusiness((b) => ({ ...b, address: e.target.value }))} disabled={!canManage} />
          </div>
          <div className="space-y-1.5">
            <Label>Business type</Label>
            <div className="flex gap-2 pt-1">
              {['RETAIL', 'RESTAURANT', 'HOTEL'].map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setBusiness((b) => ({ ...b, businessType: t }))}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                    business.businessType === t ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'
                  }`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Restaurant & hotel modules (tables, room charges) are on the roadmap and activate per business type.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Receipt preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px] tracking-tight">
            <ReceiptText className="h-4 w-4 text-primary" /> Receipts
          </CardTitle>
          <CardDescription>How your printed receipts read — works with thermal (80mm) and A4 printers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="r-header">Header line</Label>
            <Input id="r-header" value={prefs.receiptHeader} onChange={(e) => setPrefs((p) => ({ ...p, receiptHeader: e.target.value }))} disabled={!canManage} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-footer">Footer line</Label>
            <Input id="r-footer" value={prefs.receiptFooter} onChange={(e) => setPrefs((p) => ({ ...p, receiptFooter: e.target.value }))} disabled={!canManage} />
          </div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <Label htmlFor="r-alerts" className="text-sm">Low-stock alerts on dashboard</Label>
              <p className="text-xs text-muted-foreground">Shows a red count when items hit their alert level.</p>
            </div>
            <Switch id="r-alerts" checked={prefs.lowStockAlerts} onCheckedChange={(v) => canManage && setPrefs((p) => ({ ...p, lowStockAlerts: v }))} disabled={!canManage} />
          </div>
        </CardContent>
      </Card>

      {/* Money & region */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px] tracking-tight">
            <Coins className="h-4 w-4 text-primary" /> Currency & region
          </CardTitle>
          <CardDescription>Defaults are set for Pakistan — change the symbol and currency freely.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="b-currency">Currency code</Label>
            <Input id="b-currency" value={data?.business.currency ?? 'PKR'} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-symbol">Currency symbol on screens</Label>
            <Input id="b-symbol" value={prefs.currencySymbol} onChange={(e) => setPrefs((p) => ({ ...p, currencySymbol: e.target.value }))} disabled={!canManage} className="font-price" />
          </div>
        </CardContent>
      </Card>

      {/* Branches */}
      <BranchesCard
        branches={branchList ?? []}
        canManage={canManage}
        onChanged={async () => {
          try {
            const fresh = await api.get<Branch[]>('/api/branches')
            setStoreBranches(fresh.map((b) => ({ id: b.id, name: b.name, isMain: b.isMain })))
          } catch {
            // list refresh is best-effort; the dialog already surfaced errors
          }
          refetchBranches()
          refetch()
        }}
      />

      {/* Your account */}
      {user && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary">{roleLabel(user.role)}</Badge>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy} className="min-w-36">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
          </Button>
        </div>
      )}
    </div>
  )
}

/* ---------------- Branches ---------------- */

function BranchesCard({
  branches,
  canManage,
  onChanged,
}: {
  branches: Branch[]
  canManage: boolean
  onChanged: () => void | Promise<void>
}) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-[15px] tracking-tight">
            <Building2 className="h-4 w-4 text-primary" /> Branches
          </CardTitle>
          <CardDescription>Each branch keeps its own stock, sales and drawer shifts.</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add branch
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {branches.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No branches yet.</p>
        ) : (
          <ul className="space-y-2">
            {branches.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{b.name}</span>
                      {b.isMain && (
                        <Badge variant="outline" className="shrink-0 border-amber-300 text-[10px] text-amber-700 dark:text-amber-300">
                          <Star className="mr-0.5 h-2.5 w-2.5" /> Main
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[b.code, b.address, b.phone].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AddBranchDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => void onChanged()}
      />
    </Card>
  )
}

function AddBranchDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onAdded: () => void
}) {
  const [form, setForm] = useState({ name: '', code: '', phone: '', address: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setForm({ name: '', code: '', phone: '', address: '' })
  }, [open])

  const submit = async () => {
    if (form.name.trim().length < 2) {
      toast.error('Give the branch a name — at least 2 characters.')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/branches', {
        name: form.name.trim(),
        code: form.code.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      })
      toast.success('Branch added', { description: `${form.name.trim()} can now keep its own stock and sales.` })
      onOpenChange(false)
      onAdded()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby="add-branch-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Add a branch
          </DialogTitle>
          <DialogDescription id="add-branch-desc">
            New branches start with empty stock and sales — assign staff to them from Staff &amp; Roles.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="br-name">Branch name *</Label>
            <Input id="br-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Gulshan Outlet" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="br-code">Short code</Label>
              <Input id="br-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="GLS" maxLength={10} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="br-phone">Phone</Label>
              <Input id="br-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="font-price" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="br-addr">Address</Label>
            <Textarea id="br-addr" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
