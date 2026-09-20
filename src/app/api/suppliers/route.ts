import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, parseIntParam } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name is required').max(100),
  phone: z.string().trim().max(24).optional().nullable().transform((v) => (v ? v : null)),
  email: z.string().trim().max(120).optional().nullable().transform((v) => (v ? v : null)),
  address: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
  note: z.string().trim().max(300).optional().nullable().transform((v) => (v ? v : null)),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SUPPLIERS_VIEW)
    const sp = req.nextUrl.searchParams
    const q = sp.get('q')?.trim()
    const page = parseIntParam(sp.get('page'), 1)
    const pageSize = Math.min(parseIntParam(sp.get('pageSize'), 20), 100)
    const where = q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}
    const [total, suppliers] = await Promise.all([
      db.supplier.count({ where }),
      db.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { purchases: { select: { total: true } } },
      }),
    ])
    return ok({
      items: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        note: s.note,
        createdAt: s.createdAt,
        purchases: s.purchases.length,
        purchaseTotal: s.purchases.reduce((n, p) => n + p.total, 0),
      })),
      total,
      page,
      pageSize,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE)
    const data = supplierSchema.parse(await req.json())
    const supplier = await db.supplier.create({ data })
    return ok(supplier, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
