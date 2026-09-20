import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

// GET /api/customers/[id]/history — purchase history + stats for one customer.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMERS_VIEW)
    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true, email: true, address: true, createdAt: true },
    })
    if (!customer) return ok({ customer: null })

    const [sales, creditAgg] = await Promise.all([
      db.sale.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          invoiceNo: true,
          total: true,
          paymentMethod: true,
          status: true,
          createdAt: true,
          cashierName: true,
          items: { select: { name: true, quantity: true, lineTotal: true } },
        },
      }),
      db.creditEntry.aggregate({ where: { customerId: id }, _sum: { amount: true } }),
    ])

    const allTime = await db.sale.aggregate({
      where: { customerId: id, status: 'COMPLETED' },
      _sum: { total: true },
      _count: true,
    })

    // Favorite products across the fetched window (name → qty/revenue/spend count)
    const favMap = new Map<string, { quantity: number; revenue: number; times: number }>()
    for (const s of sales) {
      for (const it of s.items) {
        const e = favMap.get(it.name) ?? { quantity: 0, revenue: 0, times: 0 }
        e.quantity += it.quantity
        e.revenue += it.lineTotal
        e.times += 1
        favMap.set(it.name, e)
      }
    }
    const favoriteProducts = Array.from(favMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4)

    // Payment mix for this customer
    const payMap = new Map<string, { total: number; count: number }>()
    for (const s of sales) {
      const e = payMap.get(s.paymentMethod) ?? { total: 0, count: 0 }
      e.total += s.total
      e.count += 1
      payMap.set(s.paymentMethod, e)
    }
    const paymentMix = Array.from(payMap.entries()).map(([method, v]) => ({ method, ...v }))

    const orders = allTime._count
    const totalSpent = allTime._sum.total ?? 0

    return ok({
      customer,
      stats: {
        orders,
        totalSpent,
        avgBasket: orders > 0 ? totalSpent / orders : 0,
        balance: Math.round((creditAgg._sum.amount ?? 0) * 100) / 100,
        lastVisit: sales[0]?.createdAt ?? null,
      },
      favoriteProducts,
      paymentMix,
      sales: sales.map((s) => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        total: s.total,
        paymentMethod: s.paymentMethod,
        status: s.status,
        createdAt: s.createdAt,
        cashierName: s.cashierName,
        itemCount: s.items.reduce((n, i) => n + i.quantity, 0),
        topItems: [...s.items]
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 3)
          .map((i) => ({ name: i.name, quantity: i.quantity })),
      })),
    })
  } catch (err) {
    return handleApiError(err)
  }
}
