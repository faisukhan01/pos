import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.PRODUCTS_VIEW)
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { active: true } } } } },
    })
    return ok(categories.map((c) => ({ id: c.id, name: c.name, color: c.color, productCount: c._count.products })))
  } catch (err) {
    return handleApiError(err)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2, 'Category name is required').max(60),
  color: z.string().trim().max(20).default('#166b4e'),
})

export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTS_MANAGE)
    const data = createSchema.parse(await req.json())
    const category = await db.category.create({ data })
    return ok(category, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
