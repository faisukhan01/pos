'use client'

import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  Boxes,
  ReceiptText,
  ShoppingCart,
  Users,
  Truck,
  Wallet,
  ChartColumn,
  Settings as SettingsIcon,
  UsersRound,
  LogOut,
  Menu,
  Moon,
  Sun,
  ChevronsUpDown,
  MapPin,
  Vault,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS, roleLabel } from '@/lib/permissions'
import { api } from '@/lib/client-api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CommandPalette, type PaletteItem } from '@/components/layout/command-palette'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DashboardView } from '@/components/views/dashboard-view'
import { PosView } from '@/components/views/pos-view'
import { ProductsView } from '@/components/views/products-view'
import { InventoryView } from '@/components/views/inventory-view'
import { SalesView } from '@/components/views/sales-view'
import { PurchasesView } from '@/components/views/purchases-view'
import { CustomersView } from '@/components/views/customers-view'
import { SuppliersView } from '@/components/views/suppliers-view'
import { ExpensesView } from '@/components/views/expenses-view'
import { ReportsView } from '@/components/views/reports-view'
import { StaffView } from '@/components/views/staff-view'
import { SettingsView } from '@/components/views/settings-view'
import { ShiftsView } from '@/components/views/shifts-view'

export type ViewKey =
  | 'dashboard'
  | 'pos'
  | 'shifts'
  | 'products'
  | 'inventory'
  | 'sales'
  | 'purchases'
  | 'customers'
  | 'suppliers'
  | 'expenses'
  | 'reports'
  | 'staff'
  | 'settings'

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Sell',
    items: [
      { key: 'pos', label: 'Register', icon: ScanBarcode, permission: PERMISSIONS.POS_SELL },
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { key: 'sales', label: 'Sales', icon: ReceiptText, permission: PERMISSIONS.SALES_VIEW },
      { key: 'shifts', label: 'Cash Drawer', icon: Vault, permission: PERMISSIONS.SHIFTS_VIEW },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { key: 'products', label: 'Products', icon: Package, permission: PERMISSIONS.PRODUCTS_VIEW },
      { key: 'inventory', label: 'Inventory', icon: Boxes, permission: PERMISSIONS.INVENTORY_VIEW },
      { key: 'purchases', label: 'Purchases', icon: ShoppingCart, permission: PERMISSIONS.PURCHASES_VIEW },
    ],
  },
  {
    title: 'Business',
    items: [
      { key: 'customers', label: 'Customers', icon: Users, permission: PERMISSIONS.CUSTOMERS_VIEW },
      { key: 'suppliers', label: 'Suppliers', icon: Truck, permission: PERMISSIONS.SUPPLIERS_VIEW },
      { key: 'expenses', label: 'Expenses', icon: Wallet, permission: PERMISSIONS.EXPENSES_VIEW },
      { key: 'reports', label: 'Reports', icon: ChartColumn, permission: PERMISSIONS.REPORTS_VIEW },
    ],
  },
  {
    title: 'Admin',
    items: [
      { key: 'staff', label: 'Staff', icon: UsersRound, permission: PERMISSIONS.USERS_MANAGE },
      { key: 'settings', label: 'Settings', icon: SettingsIcon, permission: PERMISSIONS.PRODUCTS_VIEW },
    ],
  },
]

const VIEW_TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'How the store is doing today' },
  pos: { title: 'Register', subtitle: 'Ring up a sale in seconds' },
  shifts: { title: 'Cash Drawer', subtitle: 'Shifts and cash reconciliation' },
  products: { title: 'Products', subtitle: 'Your catalog and pricing' },
  inventory: { title: 'Inventory', subtitle: 'Stock on hand and movements' },
  sales: { title: 'Sales', subtitle: 'Every invoice, searchable' },
  purchases: { title: 'Purchases', subtitle: 'Stock coming in from suppliers' },
  customers: { title: 'Customers', subtitle: 'Who buys from you' },
  suppliers: { title: 'Suppliers', subtitle: 'Who supplies your shelves' },
  expenses: { title: 'Expenses', subtitle: 'Money going out' },
  reports: { title: 'Reports', subtitle: 'Numbers that help you decide' },
  staff: { title: 'Staff', subtitle: 'Accounts and access' },
  settings: { title: 'Settings', subtitle: 'Business profile and preferences' },
}

function SidebarNav({ active, onNavigate, user, collapsed = false }: { active: ViewKey; onNavigate: (v: ViewKey) => void; user: { role: string }; collapsed?: boolean }) {
  return (
    <nav aria-label="Main navigation" className={cn('flex-1 overflow-y-auto scrollbar-thin py-3 space-y-4', collapsed ? 'px-2' : 'px-3')}>
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((i) => hasPermission(user.role, i.permission))
        if (!items.length) return null
        if (collapsed) {
          return (
            <div key={section.title}>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = active === item.key
                  return (
                    <li key={item.key} className="flex justify-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onNavigate(item.key)}
                            aria-current={isActive ? 'page' : undefined}
                            aria-label={item.label}
                            className={cn(
                              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                              isActive
                                ? 'bg-primary/10 text-primary dark:bg-primary/15'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'opacity-70')} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
                      </Tooltip>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        }
        return (
          <div key={section.title}>
            <p className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon
                const isActive = active === item.key
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => onNavigate(item.key)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                        isActive
                          ? 'bg-primary/10 font-medium text-primary dark:bg-primary/15'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'opacity-70 group-hover:opacity-100')} />
                      {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex justify-center px-2" title="Nova POS">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Zap className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight">Nova POS</p>
        <p className="text-[10.5px] text-muted-foreground">Retail Management</p>
      </div>
    </div>
  )
}

export function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const { user, business, branches, activeBranchId, setActiveBranch, clear } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const [view, setView] = useState<ViewKey>(() => {
    if (user?.role === 'CASHIER') return 'pos'
    const saved = localStorage.getItem('pos-last-view') as ViewKey | null
    if (saved && NAV_SECTIONS.some((s) => s.items.some((i) => i.key === saved))) return saved
    return 'dashboard'
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('pos-sidebar-collapsed') === '1')
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('pos-last-view', view)
  }, [view])

  useEffect(() => {
    localStorage.setItem('pos-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  // Global shortcuts: Ctrl/Cmd+K → command palette, Ctrl/Cmd+B → collapse sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const canSee = (key: ViewKey) => {
    const item = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.key === key)
    return item && user ? hasPermission(user.role, item.permission) : false
  }

  const navigate = (v: ViewKey) => {
    if (!canSee(v)) return
    setView(v)
    setMobileNavOpen(false)
  }

  const signOut = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // ignore network hiccups on logout
    }
    clear()
    toast('Signed out', { description: 'See you at the next shift.' })
    onSignOut()
  }

  if (!user) return null
  const meta = VIEW_TITLES[view]
  const branchLocked = !!user.branchId
  const activeBranch = branches.find((b) => b.id === activeBranchId)

  const userCard = (
    <div className={cn('border-t border-sidebar-border p-3', collapsed && 'px-2')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[13px] font-semibold">
              {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[13px] font-medium">{user.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{roleLabel(user.role)}</p>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <DropdownMenuLabel>
            <p>{user.name}</p>
            <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const paletteItems: PaletteItem[] = NAV_SECTIONS.flatMap((s) =>
    s.items
      .filter((i) => user && hasPermission(user.role, i.permission))
      .map((i) => ({ key: i.key, label: i.label, section: s.title, icon: i.icon }))
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden lg:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-screen transition-[width] duration-200 ease-out',
            collapsed ? 'w-[64px]' : 'lg:w-56 xl:w-60'
          )}
        >
          <div className={cn('flex items-center justify-between pt-4 pb-1', collapsed ? 'px-2' : 'px-4')}>
            <BrandMark collapsed={collapsed} />
          </div>
          <SidebarNav active={view} onNavigate={navigate} user={user} collapsed={collapsed} />
          {userCard}
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
              {/* Desktop: sidebar collapse */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex text-muted-foreground hover:text-foreground"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
              </Button>

              {/* Mobile nav */}
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0 bg-sidebar">
                  <SheetHeader className="px-4 pt-5 pb-1 border-b border-sidebar-border">
                    <SheetTitle asChild>
                      <div><BrandMark /></div>
                    </SheetTitle>
                  </SheetHeader>
                  <SidebarNav active={view} onNavigate={navigate} user={user} />
                  {userCard}
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[15px] font-semibold tracking-tight">{meta.title}</h1>
                <p className="hidden sm:block truncate text-xs text-muted-foreground">{meta.subtitle}</p>
              </div>

              {/* Command palette trigger */}
              <button
                onClick={() => setPaletteOpen(true)}
                aria-label="Open quick search (Ctrl+K)"
                className="hidden sm:flex h-8 w-40 items-center gap-2 rounded-lg border border-input bg-muted/40 px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring md:w-48"
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">Search…</span>
                <kbd className="pointer-events-none rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">Ctrl K</kbd>
              </button>
              <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="Open quick search">
                <Search className="h-[18px] w-[18px]" />
              </Button>

              {business && (
                <p className="hidden xl:block text-[13px] text-muted-foreground">{business.name}</p>
              )}

              {/* Branch selector */}
              {branches.length > 1 && !branchLocked && (
                <Select value={activeBranchId ?? undefined} onValueChange={setActiveBranch}>
                  <SelectTrigger size="sm" className="w-[180px] gap-2" aria-label="Active branch">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </Button>
            </div>
          </header>

          {/* View content — keyed wrapper gives every view a soft entrance */}
          <main className="flex-1">
            <div key={view} className="view-enter h-full">
              {view === 'dashboard' && <DashboardView onNavigate={navigate} />}
              {view === 'pos' && <PosView onNavigate={navigate} />}
              {view === 'shifts' && <ShiftsView />}
              {view === 'products' && <ProductsView />}
              {view === 'inventory' && <InventoryView />}
              {view === 'sales' && <SalesView />}
              {view === 'purchases' && <PurchasesView />}
              {view === 'customers' && <CustomersView />}
              {view === 'suppliers' && <SuppliersView />}
              {view === 'expenses' && <ExpensesView />}
              {view === 'reports' && <ReportsView />}
              {view === 'staff' && <StaffView />}
              {view === 'settings' && <SettingsView />}
            </div>
          </main>

          {/* Sticky footer — sits at the bottom even on short views */}
          <footer className="mt-auto border-t border-border/60">
            <div className="flex h-9 items-center justify-between px-4 sm:px-6 text-[11px] text-muted-foreground/80">
              <p>{business ? `${business.name} · ` : ''}Nova POS</p>
              <p className="hidden sm:block">Live data · {activeBranch?.name ?? 'Main branch'}</p>
            </div>
          </footer>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={paletteItems}
        onNavigate={navigate}
        dark={theme === 'dark'}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onSignOut={signOut}
      />
    </div>
  )
}
