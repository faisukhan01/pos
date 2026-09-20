import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, parseIntParam, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'

async function nextInvoiceNo(): Promise<string> {
  const count = await db.sale.count()
  return `INV-${String(count + 1).padStart(6, '0')}`
}

const saleSchema = z.object({
  branchId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE']).default('CASH'),
  amountReceived: z.coerce.number().min(0).default(0),
  note: z.string().trim().max(300).optional().nullable(),
  clientRef: z.string().trim().max(80).optional().nullable(),
  lines: z
    .array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1') }))
    .min(1, 'The cart is empty — add at least one product.'),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.SALES_VIEW)
    const sp = req.nextUrl.searchParams
    const page = parseIntParam(sp.get('page'), 1)
    const pageSize = Math.min(parseIntParam(sp.get('pageSize'), 20), 100)
    const method = sp.get('method') || undefined
    const q = sp.get('q')?.trim()
    const from = sp.get('from') ? new Date(sp.get('from')!) : undefined
    const to = sp.get('to') ? new Date(sp.get('to') + 'T23:59:59.999') : undefined
    const branchId = sp.get('branchId') || undefined

    const where = {
      ...(method ? { paymentMethod: method } : {}),
      ...(branchId ? { branchId } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(q
        ? {
            OR: [
              { invoiceNo: { contains: q } },
              { customerName: { contains: q } },
              { cashierName: { contains: q } },
            ],
          }
        : {}),
    }
    const [total, sales, agg] = await Promise.all([
      db.sale.count({ where }),
      db.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: { select: { quantity: true } } },
      }),
      db.sale.aggregate({ where, _sum: { total: true } }),
    ])
    return ok({
      items: sales.map((s) => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        customerName: s.customerName,
        cashierName: s.cashierName,
        paymentMethod: s.paymentMethod,
        total: s.total,
        status: s.status,
        itemCount: s.items.reduce((n, i) => n + i.quantity, 0),
        createdAt: s.createdAt,
      })),
      total,
      page,
      pageSize,
      grandTotal: agg._sum.total ?? 0,
      scopedBranch: branchId ?? null,
      viewerBranch: user.branchId,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.POS_SELL)
    const body = await req.json()
    const data = saleSchema.parse(body)
    const branchId = await resolveBranchId(user.branchId, data.branchId)

    // Idempotency: safe retries (offline queue / flaky network) never double-sell.
    if (data.clientRef) {
      const existing = await db.sale.findUnique({ where: { clientRef: data.clientRef } })
      if (existing) {
        const full = await db.sale.findUnique({ where: { id: existing.id }, include: { items: true } })
        return ok({ sale: full, duplicate: true })
      }
    }

    const productIds = data.lines.map((l) => l.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds }, active: true } })
    if (products.length !== productIds.length) {
      throw new ApiError(422, 'One or more products in the cart are no longer available.')
    }
    const productMap = new Map(products.map((p) => [p.id, p]))

    let customerId: string | null = null
    let customerName = 'Walk-in Customer'
    if (data.customerId) {
      const c = await db.customer.findUnique({ where: { id: data.customerId } })
      if (c) {
        customerId = c.id
        customerName = c.name
      }
    }

    // Compute totals server-side from database prices — never trust the client.
    const priced = data.lines.map((l) => {
      const p = productMap.get(l.productId)!
      const unitPrice = p.sellingPrice
      const lineTotal = unitPrice * l.quantity
      return { p, quantity: l.quantity, unitPrice, lineTotal, taxRate: p.taxRate }
    })
    const subtotal = priced.reduce((s, l) => s + l.lineTotal, 0)
    const tax = priced.reduce((s, l) => s + (l.lineTotal * l.taxRate) / 100, 0)
    const discount = Math.min(data.discount, subtotal + tax)
    const total = Math.max(0, subtotal + tax - discount)
    if (total <= 0) throw new ApiError(422, 'Sale total must be greater than zero.')

    const method = data.paymentMethod
    let amountReceived = data.amountReceived
    let changeDue = 0
    if (method === 'CASH') {
      if (amountReceived < total) {
        throw new ApiError(422, 'Amount received is less than the total due.')
      }
      changeDue = amountReceived - total
    } else {
      amountReceived = total
    }

    const sale = await db.$transaction(async (tx) => {
      // Lock-check stock for every line first
      for (const l of priced) {
        const inv = await tx.inventoryItem.findUnique({
          where: { branchId_productId: { branchId, productId: l.p.id } },
        })
        const available = inv?.stock ?? 0
        if (available < l.quantity) {
          throw new ApiError(409, `Only ${available} ${l.p.unit} of ${l.p.name} left in stock.`)
        }
      }

      let invoiceNo = await nextInvoiceNo()
      let attempt = 0
      while (attempt < 5) {
        const clash = await tx.sale.findUnique({ where: { invoiceNo } })
        if (!clash) break
        attempt++
        const c = await tx.sale.count()
        invoiceNo = `INV-${String(c + 1 + attempt).padStart(6, '0')}`
      }

      const created = await tx.sale.create({
        data: {
          invoiceNo,
          clientRef: data.clientRef || null,
          branchId,
          cashierId: user.id,
          cashierName: user.name,
          customerId,
          customerName,
          subtotal,
          discount,
          tax,
          total,
          paymentMethod: method,
          amountReceived,
          changeDue,
          note: data.note || null,
        },
      })

      for (const l of priced) {
        await tx.saleItem.create({
          data: {
            saleId: created.id,
            productId: l.p.id,
            name: l.p.name,
            barcode: l.p.barcode,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            taxRate: l.taxRate,
            lineTotal: l.lineTotal,
          },
        })
        const inv = await tx.inventoryItem.update({
          where: { branchId_productId: { branchId, productId: l.p.id } },
          data: { stock: { decrement: l.quantity } },
        })
        await tx.inventoryMovement.create({
          data: {
            itemId: inv.id,
            type: 'SALE',
            quantity: -l.quantity,
            balanceAfter: inv.stock,
            reference: invoiceNo,
          },
        })
      }
      return created
    })

    const full = await db.sale.findUnique({ where: { id: sale.id }, include: { items: true } })
    return ok({ sale: full, duplicate: false }, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
