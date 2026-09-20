'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Upload, Pencil, Trash2, Search, PackageSearch, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { formatMoney } from '@/lib/format'
import type { PosProduct } from '@/lib/types'
import { ProductFormDialog } from '@/components/pos/product-form-dialog'
import { ImportDialog } from '@/components/pos/import-dialog'

interface ProductsResponse {
  items: (PosProduct & { category?: { name: string; color: string } | null })[]
  total: number
  page: number
  pageSize: number
}

export function ProductsView() {
  const { user, activeBranchId, branches, settings } = useAuthStore()
  const symbol = settings?.currencySymbol ?? 'Rs'
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PosProduct | null>(null)
  const [prefillBarcode, setPrefillBarcode] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [deleting, setDeleting] = useState<PosProduct | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const canManage = !!user && hasPermission(user.role, PERMISSIONS.PRODUCTS_MANAGE)
  const branchId = activeBranchId ?? branches[0]?.id

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Pre-fill from the POS "Product not found → Add product" flow
  useEffect(() => {
    const code = localStorage.getItem('pos-new-product-barcode')
    if (code) {
      localStorage.removeItem('pos-new-product-barcode')
      setPrefillBarcode(code)
      setEditing(null)
      setFormOpen(true)
    }
  }, [])

  const url = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: '15' })
    if (debounced) sp.set('q', debounced)
    if (categoryId !== 'all') sp.set('categoryId', categoryId)
    if (branchId) sp.set('branchId', branchId)
    return `/api/products?${sp.toString()}`
  }, [debounced, categoryId, page, branchId])

  const { data, loading, refetch } = useFetch<ProductsResponse>(url)
  const { data: categories } = useFetch<{ id: string; name: string; color: string; productCount: number }[]>('/api/categories')

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  const openCreate = useCallback(() => {
    setEditing(null)
    setPrefillBarcode(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((p: PosProduct) => {
    setEditing(p)
    setPrefillBarcode(null)
    setFormOpen(true)
  }, [])

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await api.del(`/api/products/${deleting.id}`)
      toast.success('Product removed', { description: `${deleting.name} is no longer on sale. History is preserved.` })
      setDeleting(null)
      refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search name, barcode, SKU or brand…"
            className="pl-9"
            aria-label="Search products"
          />
        </div>
        <Select
          value={categoryId}
          onValueChange={(v) => { setCategoryId(v); setPage(1) }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.productCount})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage && (
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add product
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <PackageSearch className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No products yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Add your first product manually, import a CSV from your supplier, or scan a barcode at the till.
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add product</Button>
                  <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import CSV</Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden md:table-cell">Barcode</TableHead>
                      <TableHead className="hidden lg:table-cell">Category</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      {canManage && <TableHead className="w-20 text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.brand ?? ''} {p.sku ? `· ${p.sku}` : ''}</p>
                        </TableCell>
                        <TableCell className="hidden font-price text-xs text-muted-foreground md:table-cell">
                          {p.barcode ?? '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {p.category ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.category.color }} />
                              {p.category.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-price text-xs text-muted-foreground">{formatMoney(p.purchasePrice, symbol)}</TableCell>
                        <TableCell className="text-right font-price font-semibold">{formatMoney(p.sellingPrice, symbol)}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              p.stock <= 0
                                ? 'border-destructive/40 text-destructive'
                                : p.stock <= p.minStock
                                  ? 'border-amber-300 text-amber-700 dark:text-amber-300'
                                  : ''
                            }
                          >
                            {p.stock} {p.unit}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleting(p)}
                                aria-label={`Remove ${p.name}`}
                              >
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
              {/* Pagination */}
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                <p className="text-muted-foreground">
                  {data.total} product{data.total === 1 ? '' : 's'} · page {data.page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        prefillBarcode={prefillBarcode}
        onSaved={() => refetch()}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        categories={categories?.map((c) => c.name) ?? []}
        onImported={() => refetch()}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The product will be hidden from the catalog and can no longer be sold. Past sales and returns keep
              their records — nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Keep product</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteBusy}
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
            >
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove product'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

