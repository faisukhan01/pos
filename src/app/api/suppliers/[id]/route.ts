import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(24).nullable().optional(),
  email: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE)
    const { id } = await params
    const data = updateSchema.parse(await req.json())
    const supplier = await db.supplier.update({ where: { id }, data })
    return ok(supplier)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE)
    const { id } = await params
    await db.supplier.delete({ where: { id } })
    return ok({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
