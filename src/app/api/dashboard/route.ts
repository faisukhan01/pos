import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, parseIntParam } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'
import { daysAgo } from '@/lib/format'

const HOUR_LABELS = [
  '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
  '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM',
]

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.DASHBOARD_VIEW)
    const branchId = await resolveBranchId(user.branchId, req.nextUrl.searchParams.get('branchId'))
    // Range preset in days: 1 (today, hourly series), 7, or 30. Clamped to sane bounds.
    const rangeDays = Math.min(Math.max(parseIntParam(req.nextUrl.searchParams.get('days'), 1), 1), 90)
    const rangeStart = daysAgo(rangeDays - 1)
    const prevStart = daysAgo(rangeDays * 2 - 1)

    const [rangeAgg, prevAgg, lowStockItems, recentSales, rangeExpenses, rangePurchases] = await Promise.all([
      db.sale.aggregate({ where: { branchId, createdAt: { gte: rangeStart } }, _sum: { total: true }, _count: true }),
      db.sale.aggregate({ where: { branchId, createdAt: { gte: prevStart, lt: rangeStart } }, _sum: { total: true } }),
      db.inventoryItem.findMany({
        where: { branchId, product: { active: true } },
        include: { product: { select: { name: true, minStock: true, unit: true, barcode: true } } },
        orderBy: { stock: 'asc' },
      }),
      db.sale.findMany({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, invoiceNo: true, customerName: true, total: true, paymentMethod: true, createdAt: true, cashierName: true, status: true },
      }),
      db.expense.aggregate({ where: { date: { gte: rangeStart } }, _sum: { amount: true } }),
      db.purchase.aggregate({ where: { branchId, createdAt: { gte: rangeStart } }, _sum: { total: true } }),
    ])

    const lowStock = lowStockItems
      .filter((i) => i.stock <= i.product.minStock)
      .slice(0, 8)
      .map((i) => ({ id: i.id, name: i.product.name, stock: i.stock, minStock: i.product.minStock, unit: i.product.unit, barcode: i.product.barcode }))
    const outOfStockCount = lowStockItems.filter((i) => i.stock <= 0).length

    // Sales series — hourly buckets for "today", daily buckets otherwise.
    let salesSeries: { date: string; label: string; total: number; count: number }[]
    if (rangeDays === 1) {
      const sales = await db.sale.findMany({
        where: { branchId, createdAt: { gte: rangeStart } },
        select: { createdAt: true, total: true },
      })
      const buckets = HOUR_LABELS.map((label, hour) => ({
        date: `hour-${hour}`,
        label,
        total: 0,
        count: 0,
      }))
      const nowHour = new Date().getHours()
      for (const s of sales) {
        const h = new Date(s.createdAt).getHours()
        buckets[h].total += s.total
        buckets[h].count += 1
      }
      // Drop future hours so "today" doesn't trail off into empty space.
      salesSeries = buckets.slice(0, nowHour + 1)
    } else {
      const sales = await db.sale.findMany({
        where: { branchId, createdAt: { gte: rangeStart } },
        select: { createdAt: true, total: true },
      })
      const seriesMap = new Map<string, { total: number; count: number }>()
      for (let d = rangeDays - 1; d >= 0; d--) {
        const day = daysAgo(d)
        seriesMap.set(day.toISOString().slice(0, 10), { total: 0, count: 0 })
      }
      for (const s of sales) {
        const key = new Date(s.createdAt).toISOString().slice(0, 10)
        const entry = seriesMap.get(key)
        if (entry) {
          entry.total += s.total
          entry.count += 1
        }
      }
      salesSeries = Array.from(seriesMap.entries()).map(([date, v]) => ({
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        ...v,
      }))
    }

    // Payment breakdown + top products across the selected range
    const [payRows, rangeItems] = await Promise.all([
      db.sale.groupBy({
        by: ['paymentMethod'],
        where: { branchId, createdAt: { gte: rangeStart } },
        _sum: { total: true },
        _count: true,
      }),
      db.saleItem.findMany({
        where: { sale: { branchId, createdAt: { gte: rangeStart } } },
        select: { name: true, quantity: true, lineTotal: true },
      }),
    ])
    const paymentBreakdown = payRows.map((r) => ({ method: r.paymentMethod, total: r._sum.total ?? 0, count: r._count }))

    const topMap = new Map<string, { quantity: number; revenue: number }>()
    for (const it of rangeItems) {
      const e = topMap.get(it.name) ?? { quantity: 0, revenue: 0 }
      e.quantity += it.quantity
      e.revenue += it.lineTotal
      topMap.set(it.name, e)
    }
    const topProducts = Array.from(topMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    const rangeSales = rangeAgg._sum.total ?? 0
    const rangeTransactions = rangeAgg._count
    const prevSales = prevAgg._sum.total ?? 0
    const salesChange = prevSales > 0 ? ((rangeSales - prevSales) / prevSales) * 100 : null

    return ok({
      rangeDays,
      rangeSales,
      rangeTransactions,
      avgSale: rangeTransactions > 0 ? rangeSales / rangeTransactions : 0,
      salesChange,
      lowStockCount: lowStockItems.filter((i) => i.stock > 0 && i.stock <= i.product.minStock).length,
      outOfStockCount,
      rangeExpenses: rangeExpenses._sum.amount ?? 0,
      rangePurchases: rangePurchases._sum.total ?? 0,
      salesSeries,
      paymentBreakdown,
      topProducts,
      lowStock,
      recentSales,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
