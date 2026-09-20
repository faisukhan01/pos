import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  sku: z.string().trim().max(64).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  brand: z.string().trim().max(80).nullable().optional(),
  unit: z.string().trim().max(20).optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  minStock: z.coerce.number().min(0).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTS_MANAGE)
    const { id } = await params
    const body = await req.json()
    const data = updateSchema.parse(body)
    const product = await db.product.update({ where: { id }, data })
    return ok(product)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTS_MANAGE)
    const { id } = await params
    // Soft-delete keeps historical sales/returns intact.
    const product = await db.product.update({ where: { id }, data: { active: false } })
    if (!product) throw new ApiError(404, 'Product not found.')
    return ok({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTS_VIEW)
    const { id } = await params
    const product = await db.product.findUnique({ where: { id }, include: { category: true } })
    if (!product) throw new ApiError(404, 'Product not found.')
    return ok(product)
  } catch (err) {
    return handleApiError(err)
  }
}
