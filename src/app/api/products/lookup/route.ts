import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'

// The single product-lookup service used by BOTH the camera scanner and manual
// barcode entry — one code path, one business rule set.
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.POS_SELL)
    const code = req.nextUrl.searchParams.get('barcode')?.trim()
    if (!code) return ok({ found: false, message: 'No barcode provided.' })

    const branchId = await resolveBranchId(user.branchId, req.nextUrl.searchParams.get('branchId'))
    const product = await db.product.findFirst({
      where: { active: true, OR: [{ barcode: code }, { sku: code }] },
      include: { category: true },
    })
    if (!product) {
      return ok({
        found: false,
        code,
        message: 'This barcode is not registered in this store.',
      })
    }
    const inv = await db.inventoryItem.findUnique({
      where: { branchId_productId: { branchId, productId: product.id } },
    })
    return ok({
      found: true,
      product: { ...product, stock: inv?.stock ?? 0 },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
