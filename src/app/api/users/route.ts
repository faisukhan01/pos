import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { hashPassword } from '@/lib/auth'

const VALID_ROLES = ['OWNER', 'MANAGER', 'CASHIER'] as const

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE)
    const users = await db.user.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { branch: { select: { name: true } } },
    })
    return ok(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        branchId: u.branchId,
        branchName: u.branch?.name ?? null,
        createdAt: u.createdAt,
      }))
    )
  } catch (err) {
    return handleApiError(err)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2, 'Staff name is required').max(80),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(120),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
  role: z.enum(VALID_ROLES).default('CASHIER'),
  branchId: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE)
    const data = createSchema.parse(await req.json())
    const exists = await db.user.findUnique({ where: { email: data.email } })
    if (exists) throw new ApiError(409, 'A staff account with this email already exists.')
    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: hashPassword(data.password),
        role: data.role,
        branchId: data.branchId || null,
      },
    })
    return ok({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active }, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
