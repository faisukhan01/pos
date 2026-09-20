import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'
import { daysAgo } from '@/lib/format'

// Report builder — every number comes from real sale/purchase/expense rows.
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.REPORTS_VIEW)
    const sp = req.nextUrl.searchParams
    const type = sp.get('type') || 'sales'
    const from = sp.get('from') ? new Date(sp.get('from') + 'T00:00:00') : daysAgo(29)
    const to = sp.get('to') ? new Date(sp.get('to') + 'T23:59:59.999') : new Date()
    const branchId = await resolveBranchId(user.branchId, sp.get('branchId'))

    if (type === 'sales') {
      const sales = await db.sale.findMany({
        where: { branchId, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, total: true, paymentMethod: true, cashierName: true, discount: true },
      })
      const byDay = new Map<string, { total: number; count: number }>()
      const byCashier = new Map<string, { total: number; count: number }>()
      const byMethod = new Map<string, { total: number; count: number }>()
      let gross = 0
      let discounts = 0
      for (const s of sales) {
        gross += s.total
        discounts += s.discount
        const key = new Date(s.createdAt).toISOString().slice(0, 10)
        const d = byDay.get(key) ?? { total: 0, count: 0 }
        d.total += s.total
        d.count += 1
        byDay.set(key, d)
        const c = byCashier.get(s.cashierName) ?? { total: 0, count: 0 }
        c.total += s.total
        c.count += 1
        byCashier.set(s.cashierName, c)
        const m = byMethod.get(s.paymentMethod) ?? { total: 0, count: 0 }
        m.total += s.total
        m.count += 1
        byMethod.set(s.paymentMethod, m)
      }
      const daily = Array.from(byDay.entries())
        .map(([date, v]) => ({ date, label: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), ...v }))
        .sort((a, b) => a.date.localeCompare(b.date))
      return ok({
        type,
        summary: { gross, net: gross, discounts, transactions: sales.length, avg: sales.length ? gross / sales.length : 0 },
        daily,
        byCashier: Array.from(byCashier.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
        byMethod: Array.from(byMethod.entries()).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.total - a.total),
      })
    }

    if (type === 'products') {
      const items = await db.saleItem.findMany({
        where: { sale: { branchId, createdAt: { gte: from, lte: to } } },
        select: { name: true, quantity: true, lineTotal: true, product: { select: { category: { select: { name: true } } } } },
      })
      const byProduct = new Map<string, { quantity: number; revenue: number }>()
      const byCategory = new Map<string, { quantity: number; revenue: number }>()
      for (const it of items) {
        const p = byProduct.get(it.name) ?? { quantity: 0, revenue: 0 }
        p.quantity += it.quantity
        p.revenue += it.lineTotal
        byProduct.set(it.name, p)
        const catName = it.product?.category?.name ?? 'Uncategorized'
        const c = byCategory.get(catName) ?? { quantity: 0, revenue: 0 }
        c.quantity += it.quantity
        c.revenue += it.lineTotal
        byCategory.set(catName, c)
      }
      return ok({
        type,
        byProduct: Array.from(byProduct.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 25),
        byCategory: Array.from(byCategory.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue),
      })
    }

    if (type === 'inventory') {
      const items = await db.inventoryItem.findMany({
        where: { branchId, product: { active: true } },
        include: { product: { select: { name: true, sku: true, unit: true, minStock: true, purchasePrice: true, sellingPrice: true, category: { select: { name: true } } } } },
        orderBy: { stock: 'asc' },
      })
      const rows = items.map((i) => ({
        name: i.product.name,
        sku: i.product.sku,
        category: i.product.category?.name ?? 'Uncategorized',
        unit: i.product.unit,
        stock: i.stock,
        minStock: i.product.minStock,
        costValue: i.stock * i.product.purchasePrice,
        retailValue: i.stock * i.product.sellingPrice,
        low: i.stock <= i.product.minStock,
      }))
      return ok({
        type,
        rows,
        summary: {
          skuCount: rows.length,
          units: rows.reduce((s, r) => s + r.stock, 0),
          costValue: rows.reduce((s, r) => s + r.costValue, 0),
          retailValue: rows.reduce((s, r) => s + r.retailValue, 0),
          lowCount: rows.filter((r) => r.low).length,
        },
      })
    }

    if (type === 'expenses') {
      const expenses = await db.expense.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: 'desc' } })
      const byCategory = new Map<string, number>()
      for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
      return ok({
        type,
        items: expenses,
        total: expenses.reduce((s, e) => s + e.amount, 0),
        byCategory: Array.from(byCategory.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
      })
    }

    if (type === 'purchases') {
      const purchases = await db.purchase.findMany({
        where: { branchId, createdAt: { gte: from, lte: to } },
        include: { items: { select: { quantity: true, lineTotal: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return ok({
        type,
        items: purchases.map((p) => ({
          id: p.id,
          referenceNo: p.referenceNo,
          supplierName: p.supplierName,
          total: p.total,
          status: p.status,
          itemCount: p.items.reduce((n, i) => n + i.quantity, 0),
          createdAt: p.createdAt,
        })),
        total: purchases.reduce((s, p) => s + p.total, 0),
      })
    }

    return ok({ type: 'unknown' })
  } catch (err) {
    return handleApiError(err)
  }
}
