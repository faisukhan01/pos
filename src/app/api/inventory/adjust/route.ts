import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'

const adjustSchema = z.object({
  productId: z.string().min(1),
  newStock: z.coerce.number().min(0, 'Stock cannot be negative'),
  note: z.string().trim().max(200).optional().nullable(),
  branchId: z.string().optional().nullable(),
})

// Manual stock adjustment (damage, expiry, count correction, shrinkage)
export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.INVENTORY_MANAGE)
    const data = adjustSchema.parse(await req.json())
    const branchId = await resolveBranchId(null, data.branchId)

    const inv = await db.inventoryItem.findUnique({
      where: { branchId_productId: { branchId, productId: data.productId } },
    })
    if (!inv) throw new ApiError(404, 'This product has no inventory record in the selected branch.')

    const delta = data.newStock - inv.stock
    const updated = await db.$transaction(async (tx) => {
      const u = await tx.inventoryItem.update({ where: { id: inv.id }, data: { stock: data.newStock } })
      await tx.inventoryMovement.create({
        data: {
          itemId: inv.id,
          type: 'ADJUSTMENT',
          quantity: delta,
          balanceAfter: data.newStock,
          note: data.note || 'Manual stock adjustment',
        },
      })
      return u
    })
    return ok({ item: updated, delta })
  } catch (err) {
    return handleApiError(err)
  }
}
