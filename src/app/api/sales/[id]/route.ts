import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW)
    const { id } = await params
    const sale = await db.sale.findUnique({
      where: { id },
      include: { items: true, returns: true, branch: { select: { name: true } } },
    })
    if (!sale) throw new ApiError(404, 'This sale could not be found.')
    return ok(sale)
  } catch (err) {
    return handleApiError(err)
  }
}
