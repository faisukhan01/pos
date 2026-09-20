'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Search, ScanBarcode, PackageSearch, PauseCircle, Keyboard, Vault, CloudOff, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api, HttpError } from '@/lib/client-api'
import { useFetch } from '@/hooks/use-fetch'
import { useOnline } from '@/hooks/use-online'
import { useAuthStore, useCartStore, useHeldStore, useOfflineQueueStore, type QueuedSale } from '@/lib/store'
import { formatMoney } from '@/lib/format'
import { CartPanel } from '@/components/pos/cart-panel'
import { ScannerDialog } from '@/components/pos/scanner-dialog'
import { PaymentDialog } from '@/components/pos/payment-dialog'
import { ReceiptDialog } from '@/components/pos/receipt-dialog'
import { ProductNotFoundDialog } from '@/components/pos/product-not-found-dialog'
import { HeldSalesDialog } from '@/components/pos/held-sales-dialog'
import { ShortcutsDialog } from '@/components/pos/shortcuts-dialog'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import type { PosProduct, SaleDto, ShiftsSummary } from '@/lib/types'
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
  const online = useOnline()
  const queue = useOfflineQueueStore((s) => s.queue)
  const syncing = useOfflineQueueStore((s) => s.syncing)
  const enqueue = useOfflineQueueStore((s) => s.enqueue)
  const dequeue = useOfflineQueueStore((s) => s.dequeue)
  const setSyncing = useOfflineQueueStore((s) => s.setSyncing)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [notFoundOpen, setNotFoundOpen] = useState(false)
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null)
  const [heldOpen, setHeldOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [lastSale, setLastSale] = useState<SaleDto | null>(null)
  const [completing, setCompleting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const branchId = activeBranchId ?? branches[0]?.id ?? null
  const symbol = settings?.currencySymbol ?? 'Rs'
  const canSeeDrawer = !!user && hasPermission(user.role, PERMISSIONS.SHIFTS_VIEW)
  const { data: shiftData, refetch: refetchShifts } = useFetch<ShiftsSummary>(
    canSeeDrawer && branchId ? `/api/shifts?branchId=${branchId}` : null
  )
  const activeShift = shiftData?.active ?? null

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

  // "/" focuses search — keyboard-friendly counter operation. "?" opens shortcut help.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
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
  const heldCount = useHeldStore((s) => s.held.length)

  const completePayment = async (
    method: 'CASH' | 'CARD' | 'MOBILE' | 'CREDIT',
    amountReceived: number
  ) => {
    if (!branchId) return
    setCompleting(true)
    const payload = {
      branchId,
      customerId: cart.customerId,
      discount: cart.discount,
      paymentMethod: method,
      amountReceived,
      lines: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    }
    try {
      const res = await api.post<{ sale: SaleDto; duplicate: boolean }>('/api/sales', {
        ...payload,
        clientRef: crypto.randomUUID(),
      })
      setLastSale(res.sale)
      setPaymentOpen(false)
      setReceiptOpen(true)
      cart.clear()
      refetch()
      refetchShifts()
      if (method === 'CREDIT') {
        toast.success('Udhaar recorded', {
          description: `${res.sale.customerName} — new balance in the credit book.`,
        })
      }
    } catch (err) {
      const status = err instanceof HttpError ? err.status : undefined
      const transient = status === undefined || status >= 500 || !navigator.onLine
      if (transient) {
        // Queue for background sync — the idempotent clientRef prevents double-selling.
        const queued: QueuedSale = {
          id: crypto.randomUUID(),
          at: Date.now(),
          itemCount: payload.lines.reduce((n, l) => n + l.quantity, 0),
          clientTotal: paymentTotal,
          payload,
        }
        enqueue(queued)
        setPaymentOpen(false)
        cart.clear()
        toast.warning('Sale saved offline', {
          description: 'The server could not be reached. It will sync automatically — do not re-ring this sale.',
        })
      } else {
        toast.error('Sale could not be completed', { description: (err as Error).message })
      }
    } finally {
      setCompleting(false)
    }
  }

  // Background sync for the offline queue — sequential, idempotent by clientRef.
  const syncQueue = useCallback(async () => {
    const q = useOfflineQueueStore.getState().queue
    if (q.length === 0 || useOfflineQueueStore.getState().syncing) return
    setSyncing(true)
    let synced = 0
    let dropped = 0
    try {
      for (const item of q) {
        try {
          await api.post<{ sale: SaleDto; duplicate: boolean }>('/api/sales', {
            ...item.payload,
            clientRef: item.id,
          })
          dequeue(item.id)
          synced++
        } catch (err) {
          const status = err instanceof HttpError ? err.status : undefined
          if (status !== undefined && status < 500 && status !== 401) {
            // Permanent business failure (stock gone, product removed…) — retrying
            // will never succeed, so drop it and tell the user honestly.
            dequeue(item.id)
            dropped++
            continue
          }
          throw err // transient — stop and retry later
        }
      }
    } catch {
      // still offline / server down — whatever synced stays synced
    } finally {
      setSyncing(false)
      if (synced > 0) {
        toast.success(`${synced} queued sale${synced === 1 ? '' : 's'} synced`)
        refetch()
        refetchShifts()
      }
      if (dropped > 0) {
        toast.error(`${dropped} queued sale${dropped === 1 ? '' : 's'} could not be saved`, {
          description: 'They were not charged — please re-ring them from the terminal.',
        })
      }
    }
  }, [dequeue, setSyncing, refetch, refetchShifts])

  // Trigger sync when connectivity returns or queued sales appear.
  useEffect(() => {
    if (online && queue.length > 0 && !syncing) {
      const t = setTimeout(() => void syncQueue(), 1200) // settle after reconnect
      return () => clearTimeout(t)
    }
  }, [online, queue.length, syncing, syncQueue])

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
          <Button variant="outline" onClick={() => setHeldOpen(true)} className="h-10 gap-2 relative" aria-label={`Held sales (${heldCount})`}>
            <PauseCircle className="h-4.5 w-4.5" />
            <span className="hidden sm:inline">Held</span>
            {heldCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {heldCount}
              </span>
            )}
          </Button>
          <Button onClick={() => setScannerOpen(true)} className="h-10 gap-2" aria-label="Open camera scanner">
            <ScanBarcode className="h-4.5 w-4.5" />
            <span className="hidden sm:inline">Scan</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts (press ?)">
            <Keyboard className="h-4.5 w-4.5" />
          </Button>
        </div>

        {/* Drawer status chip — taps through to the Cash Drawer view */}
        <div className="flex flex-wrap items-center gap-2">
          {canSeeDrawer && (
            <button
              onClick={() => onNavigate('shifts')}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors',
                activeShift
                  ? 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400'
              )}
              aria-label="Open cash drawer view"
            >
              <Vault className="h-3 w-3" />
              {activeShift ? (
                <span className="font-price">Drawer open · {formatMoney(activeShift.aggregates?.cashExpected ?? 0, symbol)} expected</span>
              ) : (
                <span>No drawer open — tap to start a shift</span>
              )}
            </button>
          )}

          {/* Offline / queued-sales chip */}
          {(!online || queue.length > 0) && (
            <button
              onClick={() => void syncQueue()}
              disabled={syncing}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors',
                !online
                  ? 'border-destructive/50 bg-destructive/10 text-destructive'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400'
              )}
              aria-label={syncing ? 'Syncing queued sales' : 'Sync queued sales now'}
            >
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : !online ? (
                <CloudOff className="h-3 w-3" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {!online ? (
                <span>Offline — sales will queue{queue.length > 0 ? ` (${queue.length} waiting)` : ''}</span>
              ) : syncing ? (
                <span>Syncing {queue.length} queued sale{queue.length === 1 ? '' : 's'}…</span>
              ) : (
                <span className="font-price">{queue.length} sale{queue.length === 1 ? '' : 's'} queued — tap to sync</span>
              )}
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-0.5" role="tablist" aria-label="Categories">
          <button
            onClick={() => setCategoryId(null)}
            role="tab"
            aria-selected={categoryId === null}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              categoryId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-transparent bg-muted/70 text-foreground/80 hover:bg-accent hover:text-foreground'
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
                categoryId === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-transparent bg-muted/70 text-foreground/80 hover:bg-accent hover:text-foreground'
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
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
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
                      'card-lift group relative flex flex-col rounded-xl border bg-card p-3 text-left focus-visible:outline-2 focus-visible:outline-ring',
                      out ? 'cursor-not-allowed opacity-55' : 'hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold uppercase"
                        style={{
                          backgroundColor: `color-mix(in oklch, ${p.category?.color ?? '#5a6b7a'} 14%, transparent)`,
                          color: p.category?.color ?? '#5a6b7a',
                        }}
                      >
                        {(p.category?.name ?? p.brand ?? p.name).trim().charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 min-h-[2.4em] text-[13px] font-medium leading-snug">{p.name}</p>
                        <span
                          className={cn(
                            'mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            out
                              ? 'bg-destructive/10 text-destructive'
                              : p.stock <= 5
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {out ? 'Out of stock' : `${p.stock} left`}
                        </span>
                      </div>
                    </div>
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
                'fixed bottom-5 right-5 z-40 h-13 gap-2 rounded-full px-6 shadow-lg transition-all',
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
      <HeldSalesDialog open={heldOpen} onOpenChange={setHeldOpen} currencySymbol={symbol} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onDecoded={(code) => void handleCode(code)} />
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
        customerId={cart.customerId}
        customerName={cart.customerName}
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
