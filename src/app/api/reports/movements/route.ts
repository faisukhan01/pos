import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, parseIntParam } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

// Movement history for one product (used by the Inventory view timeline)
export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.INVENTORY_VIEW)
    const sp = req.nextUrl.searchParams
    const productId = sp.get('productId')
    const branchId = sp.get('branchId')
    const page = parseIntParam(sp.get('page'), 1)
    const pageSize = Math.min(parseIntParam(sp.get('pageSize'), 50), 100)
    if (!productId || !branchId) return ok({ items: [], page, pageSize })

    const inv = await db.inventoryItem.findUnique({
      where: { branchId_productId: { branchId, productId } },
    })
    if (!inv) return ok({ items: [], page, pageSize })

    const [items, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where: { itemId: inv.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.inventoryMovement.count({ where: { itemId: inv.id } }),
    ])
    return ok({ items, total, page, pageSize })
  } catch (err) {
    return handleApiError(err)
  }
}
