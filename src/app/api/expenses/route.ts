import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, parseIntParam } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

const expenseSchema = z.object({
  category: z.string().trim().min(2, 'Please choose a category').max(60),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE']).default('CASH'),
  description: z.string().trim().max(300).optional().nullable().transform((v) => (v ? v : null)),
  date: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSES_VIEW)
    const sp = req.nextUrl.searchParams
    const page = parseIntParam(sp.get('page'), 1)
    const pageSize = Math.min(parseIntParam(sp.get('pageSize'), 15), 100)
    const from = sp.get('from') ? new Date(sp.get('from')!) : undefined
    const to = sp.get('to') ? new Date(sp.get('to') + 'T23:59:59.999') : undefined
    const where = {
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    }
    const [total, expenses, agg] = await Promise.all([
      db.expense.count({ where }),
      db.expense.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      db.expense.aggregate({ where, _sum: { amount: true } }),
    ])
    return ok({ items: expenses, total, page, pageSize, grandTotal: agg._sum.amount ?? 0 })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSES_MANAGE)
    const data = expenseSchema.parse(await req.json())
    const expense = await db.expense.create({
      data: {
        category: data.category,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        description: data.description,
        date: data.date ? new Date(data.date) : new Date(),
      },
    })
    return ok(expense, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
