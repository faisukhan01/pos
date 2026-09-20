import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'

// Stock take (physical count): submit counted quantities for a batch of
// products; every difference becomes an audited STOCK_TAKE movement.

const stockTakeSchema = z.object({
  branchId: z.string().optional().nullable(),
  note: z.string().trim().max(200).optional().nullable(),
  counts: z
    .array(
      z.object({
        productId: z.string().min(1),
        counted: z.coerce.number().min(0, 'Counted quantity cannot be negative'),
        expected: z.coerce.number().min(0).optional(), // optimistic-concurrency hint from the client
      })
    )
    .min(1, 'Count at least one product before submitting.'),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_MANAGE)
    const data = stockTakeSchema.parse(await req.json())
    const branchId = await resolveBranchId(null, data.branchId)
    const branch = await db.branch.findUnique({ where: { id: branchId } })
    if (!branch) throw new ApiError(404, 'Branch not found.')

    const productIds = data.counts.map((c) => c.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, unit: true } })
    const productMap = new Map(products.map((p) => [p.id, p]))

    const results = await db.$transaction(async (tx) => {
      const applied: { productId: string; name: string; unit: string; expected: number; counted: number; delta: number }[] = []
      const skipped: { productId: string; name: string; reason: string }[] = []

      for (const c of data.counts) {
        const product = productMap.get(c.productId)
        if (!product) {
          skipped.push({ productId: c.productId, name: 'Unknown product', reason: 'no longer exists' })
          continue
        }
        const inv = await tx.inventoryItem.findUnique({
          where: { branchId_productId: { branchId, productId: c.productId } },
        })
        const current = inv?.stock ?? 0
        if (!inv) {
          skipped.push({ productId: c.productId, name: product.name, reason: 'no inventory record in this branch' })
          continue
        }
        if (c.expected !== undefined && c.expected !== current) {
          skipped.push({ productId: c.productId, name: product.name, reason: `stock changed meanwhile (now ${current} ${product.unit})` })
          continue
        }
        const delta = Math.round((c.counted - current) * 100) / 100
        if (delta === 0) continue // counted matches the system — nothing to adjust

        await tx.inventoryItem.update({ where: { id: inv.id }, data: { stock: c.counted } })
        await tx.inventoryMovement.create({
          data: {
            itemId: inv.id,
            type: 'STOCK_TAKE',
            quantity: delta,
            balanceAfter: c.counted,
            note: data.note || `Physical count by ${user.name}`,
            reference: null,
          },
        })
        applied.push({ productId: c.productId, name: product.name, unit: product.unit, expected: current, counted: c.counted, delta })
      }

      return { applied, skipped }
    })

    return ok({
      ...results,
      adjusted: results.applied.length,
      skippedCount: results.skipped.length,
      message:
        results.applied.length === 0
          ? 'Everything matched the system — no adjustments needed.'
          : `Stock updated for ${results.applied.length} product${results.applied.length === 1 ? '' : 's'}.`,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
