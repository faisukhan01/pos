import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { computeShiftAggregates, serializeShift } from '@/lib/shifts'

// GET /api/shifts?branchId=… → { active, history }
// `active` includes live aggregates for the open drawer window.
export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SHIFTS_VIEW)
    const branchId = req.nextUrl.searchParams.get('branchId')
    if (!branchId) throw new ApiError(400, 'branchId is required.')

    const branch = await db.branch.findUnique({ where: { id: branchId } })
    if (!branch) throw new ApiError(404, 'Branch not found.')

    const [active, history] = await Promise.all([
      db.shift.findFirst({
        where: { branchId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
        include: { branch: { select: { name: true } } },
      }),
      db.shift.findMany({
        where: { branchId, status: 'CLOSED' },
        orderBy: { openedAt: 'desc' },
        take: 20,
        include: { branch: { select: { name: true } } },
      }),
    ])

    const activeDto = active
      ? serializeShift(active, await computeShiftAggregates(branchId, active.openedAt, active.openingFloat))
      : null

    return ok({ active: activeDto, history: history.map((s) => serializeShift(s)) })
  } catch (err) {
    return handleApiError(err)
  }
}

const openSchema = z.object({
  branchId: z.string().min(1),
  openingFloat: z.number().min(0, 'Opening float cannot be negative').max(10_000_000),
  note: z.string().trim().max(300).optional().nullable(),
})

// POST /api/shifts → open a new drawer shift (one active shift per branch)
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.SHIFTS_MANAGE)
    const data = openSchema.parse(await req.json())

    const branch = await db.branch.findUnique({ where: { id: data.branchId } })
    if (!branch) throw new ApiError(404, 'Branch not found.')

    const existing = await db.shift.findFirst({ where: { branchId: data.branchId, status: 'OPEN' } })
    if (existing) {
      throw new ApiError(409, 'This branch already has an open drawer. Close it before opening a new shift.')
    }

    const business = await db.business.findFirst()
    if (!business) throw new ApiError(500, 'Business is not set up.')

    const shift = await db.shift.create({
      data: {
        businessId: business.id,
        branchId: data.branchId,
        openedById: user.id,
        openedByName: user.name,
        openingFloat: data.openingFloat,
        note: data.note || null,
        status: 'OPEN',
      },
    })

    return ok(
      serializeShift(shift, await computeShiftAggregates(data.branchId, shift.openedAt, shift.openingFloat)),
      201
    )
  } catch (err) {
    return handleApiError(err)
  }
}
