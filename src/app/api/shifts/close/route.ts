import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { computeShiftAggregates, serializeShift } from '@/lib/shifts'

const closeSchema = z.object({
  shiftId: z.string().min(1),
  countedCash: z.number().min(0, 'Counted cash cannot be negative').max(10_000_000),
  note: z.string().trim().max(300).optional().nullable(),
})

// POST /api/shifts/close → count the drawer, snapshot totals, close the shift.
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.SHIFTS_MANAGE)
    const data = closeSchema.parse(await req.json())

    const shift = await db.shift.findUnique({ where: { id: data.shiftId } })
    if (!shift) throw new ApiError(404, 'Shift not found.')
    if (shift.status !== 'OPEN') throw new ApiError(409, 'This shift is already closed.')

    const aggregates = await computeShiftAggregates(shift.branchId, shift.openedAt, shift.openingFloat)
    const variance = Math.round((data.countedCash - aggregates.cashExpected) * 100) / 100

    const closed = await db.shift.update({
      where: { id: shift.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: user.id,
        closedByName: user.name,
        countedCash: data.countedCash,
        cashExpected: Math.round(aggregates.cashExpected * 100) / 100,
        variance,
        note: data.note || shift.note,
      },
      include: { branch: { select: { name: true } } },
    })

    return ok(serializeShift(closed, aggregates))
  } catch (err) {
    return handleApiError(err)
  }
}
