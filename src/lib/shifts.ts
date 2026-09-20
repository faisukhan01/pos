// Server-side helpers for cash-drawer shift accounting.
// Cash expected = opening float + cash sales − cash expenses paid out − returns
// (returns are assumed to be refunded in cash; this is stated on the report).

import { db } from '@/lib/db'
import type { ShiftAggregates, ShiftDto } from '@/lib/types'

export async function computeShiftAggregates(
  branchId: string,
  since: Date,
  openingFloat = 0
): Promise<ShiftAggregates> {
  const [byMethod, returns, cashExpenses] = await Promise.all([
    db.sale.groupBy({
      by: ['paymentMethod'],
      where: {
        branchId,
        createdAt: { gte: since },
        status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
      },
      _sum: { total: true, discount: true },
      _count: { _all: true },
    }),
    db.saleReturn.aggregate({
      where: { createdAt: { gte: since }, sale: { branchId } },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { date: { gte: since }, paymentMethod: 'CASH' },
      _sum: { amount: true },
    }),
  ])

  const cashSales = byMethod.find((m) => m.paymentMethod === 'CASH')?._sum.total ?? 0
  const cardSales = byMethod.find((m) => m.paymentMethod === 'CARD')?._sum.total ?? 0
  const mobileSales = byMethod.find((m) => m.paymentMethod === 'MOBILE')?._sum.total ?? 0
  const creditSales = byMethod.find((m) => m.paymentMethod === 'CREDIT')?._sum.total ?? 0
  const transactions = byMethod.reduce((s, m) => s + m._count._all, 0)
  const grossSales = byMethod.reduce((s, m) => s + (m._sum.total ?? 0), 0)
  const discounts = byMethod.reduce((s, m) => s + (m._sum.discount ?? 0), 0)
  const returnsTotal = returns._sum.amount ?? 0
  const cashExpenseTotal = cashExpenses._sum.amount ?? 0

  return {
    from: since.toISOString(),
    cashSales,
    cardSales,
    mobileSales,
    creditSales,
    transactions,
    grossSales,
    discounts,
    returnsTotal,
    cashExpenses: cashExpenseTotal,
    cashExpected: openingFloat + cashSales - cashExpenseTotal - returnsTotal,
  }
}

export function serializeShift(
  shift: {
    id: string
    branchId: string
    branch?: { name: string } | null
    openedByName: string
    closedByName: string | null
    openingFloat: number
    status: string
    countedCash: number | null
    cashExpected: number | null
    variance: number | null
    note: string | null
    openedAt: Date
    closedAt: Date | null
  },
  aggregates: ShiftAggregates | null = null
): ShiftDto {
  return {
    id: shift.id,
    branchId: shift.branchId,
    branchName: shift.branch?.name ?? null,
    openedByName: shift.openedByName,
    closedByName: shift.closedByName,
    openingFloat: shift.openingFloat,
    status: shift.status,
    countedCash: shift.countedCash,
    cashExpected: shift.cashExpected,
    variance: shift.variance,
    note: shift.note,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    aggregates,
  }
}
