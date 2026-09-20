import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, parseIntParam } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_VIEW)
    const sp = req.nextUrl.searchParams
    const page = parseIntParam(sp.get('page'), 1)
    const pageSize = Math.min(parseIntParam(sp.get('pageSize'), 25), 100)
    const q = sp.get('q')?.trim()
    const filter = sp.get('filter') // low | out | all
    const branchId = await resolveBranchId(user.branchId, sp.get('branchId'))

    const productWhere = {
      active: true,
      ...(q ? { OR: [{ name: { contains: q } }, { barcode: { contains: q } }, { sku: { contains: q } }] } : {}),
    }
    // low/out filters need column-vs-column comparison (stock <= product.minStock),
    // which Prisma can't express in SQL — so we fetch a bounded set and filter in JS.
    const needsPostFilter = filter === 'low' || filter === 'out'
    const [total, items] = await Promise.all([
      db.inventoryItem.count({ where: { branchId, product: productWhere } }),
      db.inventoryItem.findMany({
        where: { branchId, product: productWhere },
        include: { product: { include: { category: true } } },
        orderBy: { stock: 'asc' },
        skip: needsPostFilter ? 0 : (page - 1) * pageSize,
        take: needsPostFilter ? 2000 : pageSize,
      }),
    ])
    const rows = items.map((i) => ({
      id: i.id,
      productId: i.product.id,
      name: i.product.name,
      barcode: i.product.barcode,
      sku: i.product.sku,
      unit: i.product.unit,
      category: i.product.category?.name ?? null,
      stock: i.stock,
      minStock: i.product.minStock,
      purchasePrice: i.product.purchasePrice,
      sellingPrice: i.product.sellingPrice,
      stockValue: i.stock * i.product.purchasePrice,
    }))
    let filtered = rows
    if (filter === 'low') filtered = rows.filter((r) => r.stock > 0 && r.stock <= r.minStock)
    if (filter === 'out') filtered = rows.filter((r) => r.stock <= 0)
    const paged = needsPostFilter
      ? filtered.slice((page - 1) * pageSize, page * pageSize)
      : filtered
    return ok({ items: paged, total: needsPostFilter ? filtered.length : total, page, pageSize, branchId })
  } catch (err) {
    return handleApiError(err)
  }
}
