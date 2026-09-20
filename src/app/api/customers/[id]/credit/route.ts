import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

// Customer balance = sum of signed credit entry amounts (> 0 → customer owes the shop).

async function customerBalance(customerId: string): Promise<number> {
  const agg = await db.creditEntry.aggregate({
    where: { customerId },
    _sum: { amount: true },
  })
  return Math.round((agg._sum.amount ?? 0) * 100) / 100
}

// GET /api/customers/[id]/credit → { customer, balance, entries }
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMERS_VIEW)
    const { id } = await ctx.params
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) throw new ApiError(404, 'Customer not found.')

    const entries = await db.creditEntry.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return ok({
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      balance: await customerBalance(id),
      entries,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

const entrySchema = z.object({
  type: z.enum(['PAYMENT', 'CHARGE', 'ADJUST']),
  amount: z.coerce
    .number()
    .refine((v) => v !== 0, 'Amount cannot be zero.')
    .transform((v) => Math.round(v * 100) / 100),
  note: z.string().trim().max(300).optional().nullable(),
})

// POST /api/customers/[id]/credit → record a manual ledger entry (payment, charge or adjustment)
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE)
    const { id } = await ctx.params
    const data = entrySchema.parse(await req.json())

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) throw new ApiError(404, 'Customer not found.')

    let signed = data.amount
    if (data.type === 'PAYMENT') signed = -Math.abs(data.amount)
    if (data.type === 'CHARGE') signed = Math.abs(data.amount)

    const entry = await db.$transaction(async (tx) => {
      const current = await tx.creditEntry.aggregate({
        where: { customerId: id },
        _sum: { amount: true },
      })
      const balanceAfter = Math.round(((current._sum.amount ?? 0) + signed) * 100) / 100

      // Payments cannot push the balance below zero (customer paid more than they owe)
      // unless it's an explicit ADJUST — shops sometimes hand out change/refunds.
      if (data.type === 'PAYMENT' && balanceAfter < 0) {
        const owed = Math.abs(current._sum.amount ?? 0)
        throw new ApiError(
          422,
          owed === 0
            ? `${customer.name} has no udhaar balance to settle.`
            : `That is more than ${customer.name} owes (Rs ${Math.abs(owed).toLocaleString('en-PK')}). Record the extra as an adjustment instead.`
        )
      }

      return tx.creditEntry.create({
        data: {
          customerId: id,
          type: data.type,
          amount: signed,
          balanceAfter,
          note: data.note || null,
          createdByName: user.name,
        },
      })
    })

    return ok({ entry, balance: await customerBalance(id) }, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
