import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, parseIntParam, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'

const purchaseSchema = z.object({
  supplierId: z.string().optional().nullable(),
  supplierName: z.string().trim().max(120).optional().nullable(),
  branchId: z.string().optional().nullable(),
  paidAmount: z.coerce.number().min(0).default(0),
  note: z.string().trim().max(300).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        cost: z.coerce.number().min(0, 'Unit cost cannot be negative'),
        quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
      })
    )
    .min(1, 'Add at least one item to this purchase order.'),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PURCHASES_VIEW)
    const sp = req.nextUrl.searchParams
    const page = parseIntParam(sp.get('page'), 1)
    const pageSize = Math.min(parseIntParam(sp.get('pageSize'), 15), 100)
    const q = sp.get('q')?.trim()
    const where = q ? { OR: [{ referenceNo: { contains: q } }, { supplierName: { contains: q } }] } : {}
    const [total, purchases, agg] = await Promise.all([
      db.purchase.count({ where }),
      db.purchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: { select: { quantity: true } } },
      }),
      db.purchase.aggregate({ where, _sum: { total: true } }),
    ])
    return ok({
      items: purchases.map((p) => ({
        id: p.id,
        referenceNo: p.referenceNo,
        supplierName: p.supplierName,
        total: p.total,
        paidAmount: p.paidAmount,
        status: p.status,
        itemCount: p.items.reduce((n, i) => n + i.quantity, 0),
        createdAt: p.createdAt,
      })),
      total,
      page,
      pageSize,
      grandTotal: agg._sum.total ?? 0,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_MANAGE)
    const data = purchaseSchema.parse(await req.json())
    const branchId = await resolveBranchId(user.branchId, data.branchId)

    let supplierName = data.supplierName || null
    if (data.supplierId) {
      const s = await db.supplier.findUnique({ where: { id: data.supplierId } })
      if (s) supplierName = s.name
    }

    const productIds = data.items.map((i) => i.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds }, active: true } })
    if (products.length !== productIds.length) {
      throw new ApiError(422, 'One or more selected products are no longer available.')
    }
    const pmap = new Map(products.map((p) => [p.id, p]))

    const total = data.items.reduce((s, i) => s + i.cost * i.quantity, 0)
    const paid = Math.min(data.paidAmount, total)
    const status = paid >= total ? 'PAID' : paid <= 0 ? 'UNPAID' : 'PARTIAL'

    const count = await db.purchase.count()
    const referenceNo = `PO-${String(count + 1).padStart(5, '0')}`

    const purchase = await db.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          referenceNo,
          branchId,
          supplierId: data.supplierId || null,
          supplierName,
          total,
          paidAmount: paid,
          status,
          note: data.note || null,
        },
      })
      for (const item of data.items) {
        const p = pmap.get(item.productId)!
        await tx.purchaseItem.create({
          data: {
            purchaseId: created.id,
            productId: p.id,
            name: p.name,
            cost: item.cost,
            quantity: item.quantity,
            lineTotal: item.cost * item.quantity,
          },
        })
        // stock upsert + movement
        const inv = await tx.inventoryItem.upsert({
          where: { branchId_productId: { branchId, productId: p.id } },
          create: { branchId, productId: p.id, stock: item.quantity },
          update: { stock: { increment: item.quantity } },
        })
        await tx.inventoryMovement.create({
          data: {
            itemId: inv.id,
            type: 'PURCHASE',
            quantity: item.quantity,
            balanceAfter: inv.stock,
            reference: referenceNo,
          },
        })
        await tx.product.update({ where: { id: p.id }, data: { purchasePrice: item.cost } })
      }
      return created
    })

    return ok({ purchase }, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
