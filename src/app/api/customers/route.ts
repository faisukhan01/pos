import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, parseIntParam } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Customer name is required').max(100),
  phone: z.string().trim().max(24).optional().nullable().transform((v) => (v ? v : null)),
  email: z.string().trim().max(120).optional().nullable().transform((v) => (v ? v : null)),
  address: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
  note: z.string().trim().max(300).optional().nullable().transform((v) => (v ? v : null)),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMERS_VIEW)
    const sp = req.nextUrl.searchParams
    const q = sp.get('q')?.trim()
    const page = parseIntParam(sp.get('page'), 1)
    const pageSize = Math.min(parseIntParam(sp.get('pageSize'), 20), 100)
    const where = q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}
    const [total, customers, balances] = await Promise.all([
      db.customer.count({ where }),
      db.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { sales: { select: { total: true } } },
      }),
      db.creditEntry.groupBy({ by: ['customerId'], _sum: { amount: true } }),
    ])
    const balanceMap = new Map(balances.map((b) => [b.customerId, Math.round((b._sum.amount ?? 0) * 100) / 100]))
    return ok({
      items: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        createdAt: c.createdAt,
        orders: c.sales.length,
        totalSpent: c.sales.reduce((s, x) => s + x.total, 0),
        balance: balanceMap.get(c.id) ?? 0,
      })),
      total,
      page,
      pageSize,
      receivables: Math.round(
        Array.from(balanceMap.values()).filter((v) => v > 0).reduce((s, v) => s + v, 0) * 100
      ) / 100,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE)
    const data = customerSchema.parse(await req.json())
    const customer = await db.customer.create({ data })
    return ok(customer, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
