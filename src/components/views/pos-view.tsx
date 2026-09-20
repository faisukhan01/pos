'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Search, ScanBarcode, PackageSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useAuthStore, useCartStore } from '@/lib/store'
import { formatMoney } from '@/lib/format'
import type { PosProduct, SaleDto } from '@/lib/types'
import { CartPanel } from '@/components/pos/cart-panel'
import { ScannerDialog } from '@/components/pos/scanner-dialog'
import { PaymentDialog } from '@/components/pos/payment-dialog'
import { ReceiptDialog } from '@/components/pos/receipt-dialog'
import { ProductNotFoundDialog } from '@/components/pos/product-not-found-dialog'
import type { ViewKey } from '@/components/layout/app-shell'

interface ProductsResponse {
  items: (PosProduct & { category?: { name: string; color: string } | null })[]
  total: number
}
interface LookupResponse {
  found: boolean
  product?: PosProduct
  message?: string
}

export function PosView({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { user, branches, activeBranchId, business, settings } = useAuthStore()
  const cart = useCartStore()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [notFoundOpen, setNotFoundOpen] = useState(false)
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null)
  const [lastSale, setLastSale] = useState<SaleDto | null>(null)
  const [completing, setCompleting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const branchId = activeBranchId ?? branches[0]?.id ?? null
  const symbol = settings?.currencySymbol ?? 'Rs'

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280)
    return () => clearTimeout(t)
  }, [query])

  const productsUrl = useMemo(() => {
    const sp = new URLSearchParams({ pageSize: '200' })
    if (branchId) sp.set('branchId', branchId)
    if (debounced) sp.set('q', debounced)
    if (categoryId) sp.set('categoryId', categoryId)
    void refreshTick
    return `/api/products?${sp.toString()}`
  }, [branchId, debounced, categoryId, refreshTick])

  const { data, loading, refetch } = useFetch<ProductsResponse>(productsUrl)
  const { data: categoriesData } = useFetch<{ id: string; name: string; color: string; productCount: number }[]>(
    '/api/categories'
  )

  const products = data?.items ?? []

  const addToCart = useCallback(
    (p: PosProduct, silent = false) => {
      if (p.stock <= 0) {
        toast.error('Out of stock', { description: `${p.name} has nothing left on the shelf.` })
        return 'out_of_stock' as const
      }
      const res = cart.add({
        productId: p.id,
        name: p.name,
        barcode: p.barcode,
        unitPrice: p.sellingPrice,
        maxStock: p.stock,
        taxRate: p.taxRate,
        unit: p.unit,
      })
      if (res === 'added') {
        if (!silent) toast.success('Added to cart', { description: p.name })
        return 'added' as const
      }
      if (res === 'increased') {
        return 'added' as const
      }
      toast.warning('Stock limit reached', { description: `Only ${p.stock} ${p.unit} of ${p.name} available.` })
      return 'out_of_stock' as const
    },
    [cart]
  )

  // ONE lookup service for camera scans, manual entry and keyboard-wedge scanners.
  const handleCode = useCallback(
    async (code: string): Promise<'added' | 'not_found' | 'out_of_stock'> => {
      if (!branchId) return 'not_found'
      try {
        const res = await api.get<LookupResponse>(
          `/api/products/lookup?barcode=${encodeURIComponent(code)}&branchId=${branchId}`
        )
        if (!res.found || !res.product) {
          setNotFoundCode(code)
          setNotFoundOpen(true)
          return 'not_found'
        }
        const outcome = addToCart(res.product, true)
        if (outcome === 'added') {
          toast.success('Added to cart', { description: res.product.name })
          return 'added'
        }
        return 'out_of_stock'
      } catch (err) {
        toast.error((err as Error).message)
        return 'not_found'
      }
    },
    [branchId, addToCart]
  )

  // Enter in the search box: exact barcode/SKU match first, else natural text search.
  const onSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const value = query.trim()
    if (!value) return
    if (/^[0-9A-Za-z-]{6,}$/.test(value) && /\d/.test(value)) {
      await handleCode(value)
      setQuery('')
      return
    }
    // fall through: debounced search already handles text
  }

  // "/" focuses search — keyboard-friendly counter operation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const cartCount = useCartStore((s) => s.lines.reduce((n, l) => n + l.quantity, 0))
  const cartTotal = useCartStore((s) => {
    const sub = s.lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0)
    return Math.max(0, sub - (s.discount || 0))
  })
  const paymentTotal = cartTotal

  const completePayment = async (method: 'CASH' | 'CARD' | 'MOBILE', amountReceived: number) => {
    if (!branchId) return
    setCompleting(true)
    try {
      const res = await api.post<{ sale: SaleDto; duplicate: boolean }>('/api/sales', {
        branchId,
        customerId: cart.customerId,
        discount: cart.discount,
        paymentMethod: method,
        amountReceived,
        clientRef: crypto.randomUUID(),
        lines: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      })
      setLastSale(res.sale)
      setPaymentOpen(false)
      setReceiptOpen(true)
      cart.clear()
      refetch()
    } catch (err) {
      toast.error('Sale could not be completed', { description: (err as Error).message })
    } finally {
      setCompleting(false)
    }
  }

  const openAddProduct = (code: string) => {
    localStorage.setItem('pos-new-product-barcode', code)
    onNavigate('products')
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)]">
      {/* Toolbar */}
      <div className="space-y-2.5 border-b bg-background/60 px-4 py-3 sm:px-6">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search products or scan a barcode…  (press / to focus)"
              className="h-10 pl-9 pr-14"
              aria-label="Product search and barcode entry"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">
              /
            </kbd>
          </div>
          <Button onClick={() => setScannerOpen(true)} className="h-10 gap-2" aria-label="Open camera scanner">
            <ScanBarcode className="h-4.5 w-4.5" />
            <span className="hidden sm:inline">Scan</span>
          </Button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-0.5" role="tablist" aria-label="Categories">
          <button
            onClick={() => setCategoryId(null)}
            role="tab"
            aria-selected={categoryId === null}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              categoryId === null ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'
            )}
          >
            All products
          </button>
          {categoriesData?.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id === categoryId ? null : c.id)}
              role="tab"
              aria-selected={categoryId === c.id}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                categoryId === c.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Product grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 sm:px-6">
          {loading && products.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <PackageSearch className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No products found</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  {debounced
                    ? `Nothing matches “${debounced}”. Try a different word, or scan the barcode.`
                    : 'This category is empty. Add products from the Products page.'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setQuery(''); setCategoryId(null); refetch() }}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {products.map((p) => {
                const out = p.stock <= 0
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={out}
                    className={cn(
                      'card-lift group relative flex flex-col rounded-2xl border bg-card p-3 text-left focus-visible:outline-2 focus-visible:outline-ring',
                      out ? 'opacity-55 cursor-not-allowed' : 'hover:border-primary/45'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background"
                        style={{ backgroundColor: p.category?.color ?? '#94a3b8' }}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          out
                            ? 'bg-destructive/10 text-destructive'
                            : p.stock <= 5
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        )}
                      >
                        {out ? 'Out of stock' : `${p.stock} left`}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-[2.4em] text-[13px] font-medium leading-snug">{p.name}</p>
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <span className="font-price text-[15px] font-bold text-primary">
                        {formatMoney(p.sellingPrice, symbol)}
                      </span>
                      <span className="hidden max-w-[90px] truncate text-[10px] text-muted-foreground sm:block">
                        {p.category?.name ?? p.brand ?? ''}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          {!loading && products.length > 0 && data && data.total > products.length && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Showing first {products.length} of {data.total} products — refine your search to narrow down.
            </p>
          )}
        </div>

        {/* Cart — desktop */}
        <div className="hidden w-[360px] shrink-0 border-l bg-sidebar/40 p-3 xl:w-[390px] lg:block">
          <CartPanel currencySymbol={symbol} onCharge={() => setPaymentOpen(true)} busy={completing} />
        </div>
      </div>

      {/* Cart — mobile drawer */}
      <div className="lg:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button
              size="lg"
              className={cn(
                'fixed bottom-5 right-5 z-40 h-13 gap-2 rounded-full px-6 shadow-xl transition-all',
                cartCount === 0 && 'translate-y-24 opacity-0 pointer-events-none'
              )}
            >
              {cartCount} item{cartCount === 1 ? '' : 's'} · {formatMoney(cartTotal, symbol)}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="h-[85dvh]">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Cart</DrawerTitle>
            </DrawerHeader>
            <div className="h-full p-3 pt-0">
              <CartPanel currencySymbol={symbol} onCharge={() => setPaymentOpen(true)} busy={completing} />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Dialogs */}
      <ScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onDecoded={handleCode} />
      <ProductNotFoundDialog
        open={notFoundOpen}
        onOpenChange={setNotFoundOpen}
        code={notFoundCode}
        onAddProduct={openAddProduct}
      />
      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={paymentTotal}
        currencySymbol={symbol}
        onComplete={completePayment}
      />
      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        sale={lastSale}
        businessName={business?.name ?? 'Our Store'}
        branchName={branches.find((b) => b.id === branchId)?.name ?? 'Main Branch'}
        cashierName={user.name}
        receiptHeader={settings?.receiptHeader ?? 'Thank you for shopping with us!'}
        receiptFooter={settings?.receiptFooter ?? 'Thank you for your business.'}
        currencySymbol={symbol}
        onNewSale={() => {
          setReceiptOpen(false)
          searchRef.current?.focus()
        }}
      />
    </div>
  )
}
