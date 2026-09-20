// Shared client-side types mirroring API responses.

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  branchId: string | null
  branch?: { id: string; name: string } | null
}

export interface Branch {
  id: string
  name: string
  code: string | null
  isMain: boolean
  address: string | null
  phone?: string | null
}

export interface Business {
  id: string
  name: string
  businessType: string
  currency: string
  phone: string | null
  address: string | null
}

export interface Settings {
  receiptHeader: string
  receiptFooter: string
  currencySymbol: string
  showLogo: boolean
  lowStockAlerts: boolean
  taxInclusive: boolean
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface PosProduct {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  categoryId: string | null
  brand: string | null
  unit: string
  sellingPrice: number
  purchasePrice: number
  taxRate: number
  minStock: number
  image: string | null
  description: string | null
  active: boolean
  category?: { id: string; name: string; color: string } | null
  stock: number // resolved for active branch
}

export interface CartLine {
  productId: string
  name: string
  barcode: string | null
  unitPrice: number
  quantity: number
  maxStock: number
  taxRate: number
  unit: string
}

export interface SaleItemDto {
  id: string
  productId: string | null
  name: string
  barcode: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
  returnedQty: number
}

export interface SaleDto {
  id: string
  invoiceNo: string
  branchId: string
  cashierName: string
  customerId: string | null
  customerName: string
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
  amountReceived: number
  changeDue: number
  status: string
  createdAt: string
  items: SaleItemDto[]
}

export interface CustomerDto {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  createdAt: string
  totalSpent?: number
  orders?: number
  balance?: number // udhaar (credit) balance; > 0 means the customer owes the shop
}

export interface CreditEntryDto {
  id: string
  customerId: string
  saleId: string | null
  type: 'CHARGE' | 'PAYMENT' | 'ADJUST'
  amount: number // signed
  balanceAfter: number
  note: string | null
  createdByName: string
  createdAt: string
}

export interface SupplierDto {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  purchases?: number
  purchaseTotal?: number
}

export interface ExpenseDto {
  id: string
  category: string
  amount: number
  paymentMethod: string
  description: string | null
  date: string
}

export interface PurchaseDto {
  id: string
  referenceNo: string
  supplierName: string | null
  total: number
  paidAmount: number
  status: string
  createdAt: string
  itemCount: number
}

export interface DashboardData {
  rangeDays: number
  rangeSales: number
  rangeTransactions: number
  avgSale: number
  salesChange: number | null
  lowStockCount: number
  outOfStockCount: number
  rangeExpenses: number
  rangePurchases: number
  salesSeries: { date: string; label: string; total: number; count: number }[]
  expenseSeries: { date: string; label: string; total: number }[]
  paymentBreakdown: { method: string; total: number; count: number }[]
  topProducts: { name: string; quantity: number; revenue: number }[]
  lowStock: { id: string; name: string; stock: number; minStock: number; unit: string; barcode: string | null }[]
  recentSales: { id: string; invoiceNo: string; customerName: string; total: number; paymentMethod: string; createdAt: string; cashierName: string; status: string }[]
}

// ---------------- Cash drawer shifts ----------------

export interface ShiftAggregates {
  from: string
  cashSales: number
  cardSales: number
  mobileSales: number
  creditSales: number
  transactions: number
  grossSales: number
  discounts: number
  returnsTotal: number
  cashExpenses: number
  cashExpected: number
}

export interface ShiftDto {
  id: string
  branchId: string
  branchName?: string | null
  openedByName: string
  closedByName: string | null
  openingFloat: number
  status: string
  countedCash: number | null
  cashExpected: number | null
  variance: number | null
  note: string | null
  openedAt: string
  closedAt: string | null
  aggregates?: ShiftAggregates | null
}

export interface ShiftsSummary {
  active: ShiftDto | null
  history: ShiftDto[]
}

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE', label: 'Mobile / QR' },
  { value: 'CREDIT', label: 'Udhaar' },
] as const

export const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Marketing', 'Maintenance', 'Other',
] as const

export function paymentLabel(method: string) {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method
}

export function paymentBadgeClass(method: string) {
  switch (method) {
    case 'CASH':
      return 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
    case 'CARD':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300'
    case 'MOBILE':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
    case 'CREDIT':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}
