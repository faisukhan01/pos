import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.EXPENSES_MANAGE)
    const { id } = await params
    await db.expense.delete({ where: { id } })
    return ok({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
