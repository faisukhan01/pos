import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { hashPassword } from '@/lib/auth'

const VALID_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_STAFF', 'ACCOUNTANT'] as const

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(VALID_ROLES).optional(),
  active: z.boolean().optional(),
  branchId: z.string().nullable().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72).optional(),
})

async function activeAdminCount(): Promise<number> {
  return db.user.count({ where: { active: true, role: { in: ['OWNER', 'ADMIN'] } } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(PERMISSIONS.USERS_MANAGE)
    const { id } = await params
    const data = patchSchema.parse(await req.json())

    const target = await db.user.findUnique({ where: { id } })
    if (!target) throw new ApiError(404, 'Staff account not found.')

    const losingAdmin =
      target.active &&
      ['OWNER', 'ADMIN'].includes(target.role) &&
      ((data.active === false) || (data.role && !['OWNER', 'ADMIN'].includes(data.role)))

    if (losingAdmin && (await activeAdminCount()) <= 1) {
      throw new ApiError(409, 'At least one active Owner/Admin must remain.')
    }
    if (actor.id === id && data.active === false) {
      throw new ApiError(409, 'You cannot deactivate your own account while signed in.')
    }
    if (actor.id === id && data.role && data.role !== actor.role) {
      throw new ApiError(409, 'You cannot change your own role while signed in.')
    }

    const user = await db.user.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId || null } : {}),
        ...(data.password ? { passwordHash: hashPassword(data.password) } : {}),
      },
    })
    return ok({ id: user.id, name: user.name, role: user.role, active: user.active, branchId: user.branchId })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(PERMISSIONS.USERS_MANAGE)
    const { id } = await params
    if (actor.id === id) throw new ApiError(409, 'You cannot remove your own account while signed in.')

    const target = await db.user.findUnique({ where: { id } })
    if (!target) throw new ApiError(404, 'Staff account not found.')

    if (['OWNER', 'ADMIN'].includes(target.role) && target.active && (await activeAdminCount()) <= 1) {
      throw new ApiError(409, 'At least one active Owner/Admin must remain — deactivate instead.')
    }

    // Past sales keep the cashier name snapshot, so hard delete is safe.
    await db.user.delete({ where: { id } })
    return ok({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE)
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, active: true, branchId: true, createdAt: true },
    })
    if (!user) throw new ApiError(404, 'Staff account not found.')
    return ok(user)
  } catch (err) {
    return handleApiError(err)
  }
}
