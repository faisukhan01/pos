import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

const returnSchema = z.object({
  reason: z.string().trim().min(3, 'Please record a reason for this return').max(300),
  items: z
    .array(z.object({ saleItemId: z.string().min(1), quantity: z.coerce.number().int().min(1) }))
    .min(1, 'Select at least one item to return.'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALES_RETURN)
    const { id: saleId } = await params
    const data = returnSchema.parse(await req.json())

    const sale = await db.sale.findUnique({ where: { id: saleId }, include: { items: true } })
    if (!sale) throw new ApiError(404, 'This sale could not be found.')
    if (sale.status === 'RETURNED') throw new ApiError(409, 'This sale has already been fully returned.')

    const itemMap = new Map(sale.items.map((i) => [i.id, i]))
    const returnLines = data.items.map((r) => {
      const item = itemMap.get(r.saleItemId)
      if (!item) throw new ApiError(404, 'One of the selected items does not belong to this sale.')
      const returnable = item.quantity - item.returnedQty
      if (r.quantity > returnable) {
        throw new ApiError(
          409,
          `Only ${returnable} of ${item.name} can still be returned on this invoice (partial returns already recorded).`
        )
      }
      return { item, quantity: r.quantity }
    })

    const amount = returnLines.reduce((s, l) => s + l.item.unitPrice * l.quantity, 0)

    const count = await db.saleReturn.count()
    const returnNo = `RET-${String(count + 1).padStart(5, '0')}`

    const result = await db.$transaction(async (tx) => {
      // Re-verify inside the transaction (protects against concurrent returns)
      for (const l of returnLines) {
        const fresh = await tx.saleItem.findUnique({ where: { id: l.item.id } })
        if (!fresh) throw new ApiError(404, 'Sale item not found.')
        if (l.quantity > fresh.quantity - fresh.returnedQty) {
          throw new ApiError(409, `Not enough returnable quantity left for ${fresh.name}.`)
        }
        await tx.saleItem.update({
          where: { id: fresh.id },
          data: { returnedQty: { increment: l.quantity } },
        })
        if (fresh.productId) {
          const inv = await tx.inventoryItem.findUnique({
            where: { branchId_productId: { branchId: sale.branchId, productId: fresh.productId } },
          })
          if (inv) {
            const updated = await tx.inventoryItem.update({
              where: { id: inv.id },
              data: { stock: { increment: l.quantity } },
            })
            await tx.inventoryMovement.create({
              data: {
                itemId: inv.id,
                type: 'RETURN',
                quantity: l.quantity,
                balanceAfter: updated.stock,
                reference: `${sale.invoiceNo} → ${returnNo}`,
                note: data.reason,
              },
            })
          }
        }
      }

      const ret = await tx.saleReturn.create({
        data: {
          returnNo,
          saleId: sale.id,
          reason: data.reason,
          amount,
          itemsJson: JSON.stringify(
            returnLines.map((l) => ({ saleItemId: l.item.id, name: l.item.name, quantity: l.quantity, unitPrice: l.item.unitPrice }))
          ),
        },
      })

      const refreshed = await tx.saleItem.findMany({ where: { saleId: sale.id } })
      const fullyReturned = refreshed.every((i) => i.returnedQty >= i.quantity)
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: fullyReturned ? 'RETURNED' : 'PARTIALLY_RETURNED' },
      })
      return ret
    })

    return ok({ return: result }, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
