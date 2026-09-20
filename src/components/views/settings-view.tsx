'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Store, ReceiptText, MapPin, Users, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS, roleLabel } from '@/lib/permissions'

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
  const { user, updateSettings } = useAuthStore()
  const { data, loading, refetch } = useFetch<SettingsResponse>('/api/settings')
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
          <CardTitle className="flex items-center gap-2 text-[15px]">
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
          <CardTitle className="flex items-center gap-2 text-[15px]">
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
          <CardTitle className="flex items-center gap-2 text-[15px]">
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

      {/* Workspace summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <MapPin className="h-4 w-4 text-primary" /> Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs text-muted-foreground">Branches</p>
            <p className="font-price text-2xl font-bold">{data?.branchCount ?? 0}</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Active staff accounts
            </p>
            <p className="font-price text-2xl font-bold">{data?.userCount ?? 0}</p>
          </div>
        </CardContent>
      </Card>

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
