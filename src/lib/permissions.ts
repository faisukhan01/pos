// Three clean roles — simple to understand, enforced on the server for every
// sensitive operation, mirrored on the client purely for navigation visibility.

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  POS_SELL: 'pos.sell',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_MANAGE: 'inventory.manage',
  SALES_VIEW: 'sales.view',
  SALES_RETURN: 'sales.return',
  PURCHASES_VIEW: 'purchases.view',
  PURCHASES_MANAGE: 'purchases.manage',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_MANAGE: 'suppliers.manage',
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_MANAGE: 'expenses.manage',
  REPORTS_VIEW: 'reports.view',
  SHIFTS_VIEW: 'shifts.view',
  SHIFTS_MANAGE: 'shifts.manage',
  SETTINGS_MANAGE: 'settings.manage',
  USERS_MANAGE: 'users.manage',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const ALL: Permission[] = Object.values(PERMISSIONS) as Permission[]

export const ROLES = ['OWNER', 'MANAGER', 'CASHIER'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter(
    (p) => p !== PERMISSIONS.USERS_MANAGE && p !== PERMISSIONS.SETTINGS_MANAGE
  ),
  CASHIER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.POS_SELL,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_RETURN,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.SHIFTS_VIEW,
    PERMISSIONS.SHIFTS_MANAGE,
  ],
}

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  return perms.includes(permission)
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'OWNER': return 'Owner'
    case 'MANAGER': return 'Manager'
    case 'CASHIER': return 'Cashier'
    default: return role
  }
}

export function roleDescription(role: string): string {
  switch (role) {
    case 'OWNER': return 'Full access — everything in the store.'
    case 'MANAGER': return 'Runs the day: sales, stock, staff-free zones.'
    case 'CASHIER': return 'Sells at the register and handles returns.'
    default: return ''
  }
}
