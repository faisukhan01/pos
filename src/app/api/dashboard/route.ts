import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'
import { daysAgo } from '@/lib/format'

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.DASHBOARD_VIEW)
    const branchId = await resolveBranchId(user.branchId, req.nextUrl.searchParams.get('branchId'))
    const today = daysAgo(0)
    const weekAgo = daysAgo(6)

    const [todayAgg, weekAgg, lowStockItems, recentSales, todayExpenses, todayPurchases] = await Promise.all([
      db.sale.aggregate({ where: { branchId, createdAt: { gte: today } }, _sum: { total: true }, _count: true }),
      db.sale.aggregate({ where: { branchId, createdAt: { gte: weekAgo } }, _sum: { total: true }, _count: true }),
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
      db.expense.aggregate({ where: { date: { gte: today } }, _sum: { amount: true } }),
      db.purchase.aggregate({ where: { branchId, createdAt: { gte: today } }, _sum: { total: true } }),
    ])

    const lowStock = lowStockItems
      .filter((i) => i.stock <= i.product.minStock)
      .slice(0, 8)
      .map((i) => ({ id: i.id, name: i.product.name, stock: i.stock, minStock: i.product.minStock, unit: i.product.unit, barcode: i.product.barcode }))
    const outOfStockCount = lowStockItems.filter((i) => i.stock <= 0).length

    // 14-day sales series
    const since = daysAgo(13)
    const sales = await db.sale.findMany({
      where: { branchId, createdAt: { gte: since } },
      select: { createdAt: true, total: true },
    })
    const seriesMap = new Map<string, { total: number; count: number }>()
    for (let d = 13; d >= 0; d--) {
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
    const salesSeries = Array.from(seriesMap.entries()).map(([date, v]) => ({
      date,
      label: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      ...v,
    }))

    // Payment breakdown — last 7 days for a meaningful sample
    const payRows = await db.sale.groupBy({
      by: ['paymentMethod'],
      where: { branchId, createdAt: { gte: weekAgo } },
      _sum: { total: true },
      _count: true,
    })
    const paymentBreakdown = payRows.map((r) => ({ method: r.paymentMethod, total: r._sum.total ?? 0, count: r._count }))

    // Top products — last 7 days
    const weekItems = await db.saleItem.findMany({
      where: { sale: { branchId, createdAt: { gte: weekAgo } } },
      select: { name: true, quantity: true, lineTotal: true },
    })
    const topMap = new Map<string, { quantity: number; revenue: number }>()
    for (const it of weekItems) {
      const e = topMap.get(it.name) ?? { quantity: 0, revenue: 0 }
      e.quantity += it.quantity
      e.revenue += it.lineTotal
      topMap.set(it.name, e)
    }
    const topProducts = Array.from(topMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    const todaySales = todayAgg._sum.total ?? 0
    const todayTransactions = todayAgg._count

    return ok({
      todaySales,
      todayTransactions,
      avgSale: todayTransactions > 0 ? todaySales / todayTransactions : 0,
      weekSales: weekAgg._sum.total ?? 0,
      lowStockCount: lowStockItems.filter((i) => i.stock > 0 && i.stock <= i.product.minStock).length,
      outOfStockCount,
      todayExpenses: todayExpenses._sum.amount ?? 0,
      todayPurchases: todayPurchases._sum.total ?? 0,
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
