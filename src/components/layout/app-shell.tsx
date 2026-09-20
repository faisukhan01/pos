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
  Store as StoreIcon,
  UsersRound,
  LogOut,
  Menu,
  Moon,
  Sun,
  ChevronsUpDown,
  MapPin,
  Vault,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { hasPermission, PERMISSIONS, roleLabel } from '@/lib/permissions'
import { api } from '@/lib/client-api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
    title: 'Counter',
    items: [
      { key: 'pos', label: 'New Sale', icon: ScanBarcode, permission: PERMISSIONS.POS_SELL },
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { key: 'sales', label: 'Sales & Returns', icon: ReceiptText, permission: PERMISSIONS.SALES_VIEW },
      { key: 'shifts', label: 'Cash Drawer', icon: Vault, permission: PERMISSIONS.SHIFTS_VIEW },
    ],
  },
  {
    title: 'Catalog & Stock',
    items: [
      { key: 'products', label: 'Products', icon: Package, permission: PERMISSIONS.PRODUCTS_VIEW },
      { key: 'inventory', label: 'Inventory', icon: Boxes, permission: PERMISSIONS.INVENTORY_VIEW },
      { key: 'purchases', label: 'Purchases', icon: ShoppingCart, permission: PERMISSIONS.PURCHASES_VIEW },
    ],
  },
  {
    title: 'People & Money',
    items: [
      { key: 'customers', label: 'Customers', icon: Users, permission: PERMISSIONS.CUSTOMERS_VIEW },
      { key: 'suppliers', label: 'Suppliers', icon: Truck, permission: PERMISSIONS.SUPPLIERS_VIEW },
      { key: 'expenses', label: 'Expenses', icon: Wallet, permission: PERMISSIONS.EXPENSES_VIEW },
      { key: 'reports', label: 'Reports', icon: ChartColumn, permission: PERMISSIONS.REPORTS_VIEW },
    ],
  },
  {
    title: 'System',
    items: [
      { key: 'staff', label: 'Staff & Roles', icon: UsersRound, permission: PERMISSIONS.USERS_MANAGE },
      { key: 'settings', label: 'Settings', icon: SettingsIcon, permission: PERMISSIONS.PRODUCTS_VIEW },
    ],
  },
]

const VIEW_TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'How the store is doing today' },
  pos: { title: 'Point of Sale', subtitle: 'Scan, add to cart, take payment' },
  shifts: { title: 'Cash Drawer', subtitle: 'Shifts, floats and cash reconciliation' },
  products: { title: 'Products', subtitle: 'Your catalog and pricing' },
  inventory: { title: 'Inventory', subtitle: 'Stock on hand and movements' },
  sales: { title: 'Sales & Returns', subtitle: 'Every invoice, searchable' },
  purchases: { title: 'Purchases', subtitle: 'Stock coming in from suppliers' },
  customers: { title: 'Customers', subtitle: 'Who buys from you' },
  suppliers: { title: 'Suppliers', subtitle: 'Who supplies your shelves' },
  expenses: { title: 'Expenses', subtitle: 'Money going out' },
  reports: { title: 'Reports', subtitle: 'Numbers that help you decide' },
  staff: { title: 'Staff & Roles', subtitle: 'Accounts, permissions and access' },
  settings: { title: 'Settings', subtitle: 'Business profile and preferences' },
}

function SidebarNav({ active, onNavigate, user }: { active: ViewKey; onNavigate: (v: ViewKey) => void; user: { role: string } }) {
  return (
    <nav aria-label="Main navigation" className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((i) => hasPermission(user.role, i.permission))
        if (!items.length) return null
        return (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
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
                        'group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                        isActive
                          ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                          : 'text-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <Icon className={cn('h-[17px] w-[17px] shrink-0', isActive ? '' : 'text-muted-foreground group-hover:text-inherit')} />
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

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <StoreIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight">Ledger POS</p>
        <p className="text-[11px] text-muted-foreground">Retail Management</p>
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

  useEffect(() => {
    localStorage.setItem('pos-last-view', view)
  }, [view])

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
    <div className="border-t border-sidebar-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel(user.role)}</p>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-60 xl:w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-screen">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <BrandMark />
          </div>
          <SidebarNav active={view} onNavigate={navigate} user={user} />
          {userCard}
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
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
                <h1 className="truncate text-[15px] sm:text-base font-semibold tracking-tight">{meta.title}</h1>
                <p className="hidden sm:block truncate text-xs text-muted-foreground">{meta.subtitle}</p>
              </div>

              {/* Branch selector */}
              {branches.length > 1 && !branchLocked && (
                <Select value={activeBranchId ?? undefined} onValueChange={setActiveBranch}>
                  <SelectTrigger size="sm" className="w-[190px] gap-2" aria-label="Active branch">
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

              {business && (
                <div className="hidden md:block text-right">
                  <p className="text-[13px] font-medium leading-tight">{business.name}</p>
                  <p className="text-[11px] text-muted-foreground">{activeBranch?.name ?? 'Main branch'}</p>
                </div>
              )}
            </div>
          </header>

          {/* View content */}
          <main className="flex-1">
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
          </main>

          {/* Sticky footer — sits at the bottom even on short views */}
          <footer className="mt-auto border-t border-border/70">
            <div className="flex h-10 items-center justify-between px-4 sm:px-6 text-[11.5px] text-muted-foreground">
              <p>
                {business ? `${business.name} · ` : ''}Ledger POS v1.0
              </p>
              <p className="hidden sm:block">All amounts in the store currency · Data refreshes live</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
