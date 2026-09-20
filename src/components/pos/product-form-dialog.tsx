'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, ScanBarcode } from 'lucide-react'
import { useFetch } from '@/hooks/use-fetch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/client-api'
import type { PosProduct } from '@/lib/types'

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  product: PosProduct | null
  prefillBarcode?: string | null
  onSaved: () => void
}

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'pack', 'dozen', 'box']

export function ProductFormDialog({ open, onOpenChange, product, prefillBarcode, onSaved }: ProductFormDialogProps) {
  const isEdit = !!product
  const [form, setForm] = useState({
    name: '',
    barcode: '',
    sku: '',
    categoryId: 'none',
    brand: '',
    unit: 'pcs',
    purchasePrice: '',
    sellingPrice: '',
    taxRate: '0',
    minStock: '5',
    openingStock: '',
    description: '',
  })
  const [busy, setBusy] = useState(false)
  const { data: categories } = useCategories()

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name,
          barcode: product.barcode ?? '',
          sku: product.sku ?? '',
          categoryId: product.categoryId ?? 'none',
          brand: product.brand ?? '',
          unit: product.unit ?? 'pcs',
          purchasePrice: String(product.purchasePrice ?? ''),
          sellingPrice: String(product.sellingPrice ?? ''),
          taxRate: String(product.taxRate ?? 0),
          minStock: String(product.minStock ?? 5),
          openingStock: '',
          description: product.description ?? '',
        })
      } else {
        setForm({
          name: '',
          barcode: prefillBarcode ?? '',
          sku: '',
          categoryId: 'none',
          brand: '',
          unit: 'pcs',
          purchasePrice: '',
          sellingPrice: '',
          taxRate: '0',
          minStock: '5',
          openingStock: '',
          description: '',
        })
      }
    }
  }, [open, product, prefillBarcode])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error('Please give the product a name.')
      return
    }
    if (form.sellingPrice === '' || Number(form.sellingPrice) < 0) {
      toast.error('Please enter a valid selling price.')
      return
    }
    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        sku: form.sku.trim() || null,
        categoryId: form.categoryId === 'none' ? null : form.categoryId,
        brand: form.brand.trim() || null,
        unit: form.unit,
        purchasePrice: Number(form.purchasePrice || 0),
        sellingPrice: Number(form.sellingPrice),
        taxRate: Number(form.taxRate || 0),
        minStock: Number(form.minStock || 5),
        description: form.description.trim() || null,
      }
      if (isEdit) {
        await api.put(`/api/products/${product!.id}`, payload)
        toast.success('Product updated', { description: payload.name as string })
      } else {
        payload.openingStock = Number(form.openingStock || 0)
        await api.post('/api/products', payload)
        toast.success('Product added', { description: `${payload.name} is now on the shelf.` })
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error('Could not save product', { description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto scrollbar-thin" aria-describedby="product-form-desc">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${product?.name}` : 'Add a new product'}</DialogTitle>
          <DialogDescription id="product-form-desc">
            {isEdit
              ? 'Prices and stock alerts apply to future sales.'
              : prefillBarcode
                ? 'Scanned code filled automatically — complete the details and save.'
                : 'Only the name and selling price are required. Everything else can wait.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3.5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="p-name">Product name *</Label>
            <Input id="p-name" value={form.name} onChange={set('name')} placeholder="e.g. Basmati Rice 5kg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-barcode" className="flex items-center gap-1.5">
              <ScanBarcode className="h-3.5 w-3.5 text-muted-foreground" /> Barcode
            </Label>
            <Input id="p-barcode" value={form.barcode} onChange={set('barcode')} placeholder="Scan or type" className="font-price" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-sku">SKU (optional)</Label>
            <Input id="p-sku" value={form.sku} onChange={set('sku')} placeholder="e.g. GRO-1024" className="font-price" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
              <SelectTrigger aria-label="Category"><SelectValue placeholder="Uncategorized" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-brand">Brand</Label>
            <Input id="p-brand" value={form.brand} onChange={set('brand')} placeholder="e.g. National" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-cost">Purchase price</Label>
            <Input id="p-cost" inputMode="decimal" value={form.purchasePrice} onChange={set('purchasePrice')} placeholder="0" className="font-price text-right" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-price">Selling price *</Label>
            <Input id="p-price" inputMode="decimal" value={form.sellingPrice} onChange={set('sellingPrice')} placeholder="0" className="font-price text-right" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-unit">Unit</Label>
            <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
              <SelectTrigger aria-label="Unit"><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-tax">Tax rate %</Label>
            <Input id="p-tax" inputMode="decimal" value={form.taxRate} onChange={set('taxRate')} className="font-price text-right" />
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="p-opening">Opening stock</Label>
              <Input id="p-opening" inputMode="numeric" value={form.openingStock} onChange={set('openingStock')} placeholder="0" className="font-price text-right" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="p-minstock">Low-stock alert at</Label>
            <Input id="p-minstock" inputMode="numeric" value={form.minStock} onChange={set('minStock')} className="font-price text-right" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="p-desc">Description (optional)</Label>
            <Textarea id="p-desc" value={form.description} onChange={set('description')} rows={2} placeholder="Anything the cashier should know" />
          </div>

          <DialogFooter className="sm:col-span-2 mt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Save changes' : 'Add product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function useCategories() {
  return useFetch<{ id: string; name: string; color: string }[]>('/api/categories')
}
