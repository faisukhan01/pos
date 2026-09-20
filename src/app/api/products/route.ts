import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, parseIntParam, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

export async function resolveBranchId(userBranchId: string | null, requested?: string | null) {
  if (requested) {
    const branch = await db.branch.findUnique({ where: { id: requested } })
    if (branch) return branch.id
  }
  if (userBranchId) return userBranchId
  const main = await db.branch.findFirst({ where: { isMain: true } })
  if (main) return main.id
  const any = await db.branch.findFirst()
  if (any) return any.id
  throw new ApiError(500, 'No branch has been set up yet.')
}

const productSchema = z.object({
  name: z.string().trim().min(2, 'Product name must be at least 2 characters').max(120),
  barcode: z.string().trim().max(64).optional().nullable().transform((v) => (v ? v : null)),
  sku: z.string().trim().max(64).optional().nullable().transform((v) => (v ? v : null)),
  categoryId: z.string().optional().nullable().transform((v) => (v ? v : null)),
  brand: z.string().trim().max(80).optional().nullable().transform((v) => (v ? v : null)),
  unit: z.string().trim().max(20).default('pcs'),
  purchasePrice: z.coerce.number().min(0, 'Purchase price cannot be negative').default(0),
  sellingPrice: z.coerce.number().min(0, 'Selling price cannot be negative').default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  minStock: z.coerce.number().min(0).default(5),
  openingStock: z.coerce.number().min(0).default(0),
  description: z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null)),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_VIEW)
    const sp = req.nextUrl.searchParams
    const q = sp.get('q')?.trim()
    const categoryId = sp.get('categoryId') || undefined
    const lowStock = sp.get('lowStock') === '1'
    const page = parseIntParam(sp.get('page'), 1)
    const pageSize = Math.min(parseIntParam(sp.get('pageSize'), 24), 100)
    const branchId = await resolveBranchId(user.branchId, sp.get('branchId'))

    const where = {
      active: true,
      ...(categoryId ? { categoryId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { barcode: { contains: q } },
              { sku: { contains: q } },
              { brand: { contains: q } },
            ],
          }
        : {}),
    }
    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    const invs = await db.inventoryItem.findMany({ where: { branchId } })
    const stockMap = new Map(invs.map((i) => [i.productId, i.stock]))
    let items = products.map((p) => ({ ...p, stock: stockMap.get(p.id) ?? 0 }))
    if (lowStock) items = items.filter((p) => p.stock <= p.minStock)
    return ok({ items, total, page, pageSize, branchId })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE)
    const body = await req.json()
    const data = productSchema.parse(body)
    const branchId = await resolveBranchId(user.branchId, body.branchId)

    const product = await db.product.create({ data })
    const opening = data.openingStock
    if (opening > 0) {
      const inv = await db.inventoryItem.create({
        data: { branchId, productId: product.id, stock: opening },
      })
      await db.inventoryMovement.create({
        data: { itemId: inv.id, type: 'OPENING', quantity: opening, balanceAfter: opening, note: 'Opening stock' },
      })
    } else {
      await db.inventoryItem.create({ data: { branchId, productId: product.id, stock: 0 } })
    }
    const withCategory = await db.product.findUnique({
      where: { id: product.id },
      include: { category: true },
    })
    return ok({ ...withCategory, stock: opening }, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
