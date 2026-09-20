// Granular permissions — enforced on the server for every sensitive operation,
// mirrored on the client purely to control navigation visibility.

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
  SETTINGS_MANAGE: 'settings.manage',
  USERS_MANAGE: 'users.manage',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const ALL: Permission[] = Object.values(PERMISSIONS) as Permission[]

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
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
  ],
  INVENTORY_STAFF: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_MANAGE,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SUPPLIERS_MANAGE,
  ],
  ACCOUNTANT: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW,
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
    case 'ADMIN': return 'Administrator'
    case 'MANAGER': return 'Store Manager'
    case 'CASHIER': return 'Cashier'
    case 'INVENTORY_STAFF': return 'Inventory Staff'
    case 'ACCOUNTANT': return 'Accountant'
    default: return role
  }
}
