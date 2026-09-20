import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET() {
  try {
    await requirePermission()
    const branches = await db.branch.findMany({ orderBy: { isMain: 'desc' } })
    return ok(branches.map((b) => ({ id: b.id, name: b.name, code: b.code, isMain: b.isMain, address: b.address, phone: b.phone })))
  } catch (err) {
    return handleApiError(err)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2, 'Branch name is required').max(100),
  code: z.string().trim().max(10).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const business = await db.business.findFirst()
    if (!business) return handleApiError(new Error('Business not set up'))
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
    const data = createSchema.parse(await req.json())
    const branch = await db.branch.create({ data: { ...data, businessId: business.id } })
    return ok(branch, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
