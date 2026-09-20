import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveBranchId } from '@/app/api/products/route'

interface ImportRow {
  name?: string
  barcode?: string
  sku?: string
  category?: string
  brand?: string
  unit?: string
  purchasePrice?: string | number
  sellingPrice?: string | number
  taxRate?: string | number
  openingStock?: string | number
  minStock?: string | number
}

function num(v: string | number | undefined): number {
  if (v === undefined || v === null || v === '') return 0
  const n = Number(String(v).replace(/[, ]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_MANAGE)
    const body = await req.json()
    const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : []
    const branchId = await resolveBranchId(user.branchId, body.branchId)

    const errors: { row: number; name: string; message: string }[] = []
    const validRows: (ImportRow & { name: string })[] = []
    const seenBarcodes = new Set<string>()

    const existingProducts = await db.product.findMany({
      select: { barcode: true, sku: true },
    })
    const dbBarcodes = new Set(existingProducts.map((p) => p.barcode).filter(Boolean))
    const dbSkus = new Set(existingProducts.map((p) => p.sku).filter(Boolean))
    const categories = await db.category.findMany()
    const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))

    rows.forEach((row, idx) => {
      const rowNo = idx + 1
      const name = String(row.name || '').trim()
      if (!name) {
        errors.push({ row: rowNo, name: name || '—', message: 'Product name is required.' })
        return
      }
      const barcode = String(row.barcode || '').trim() || null
      const sku = String(row.sku || '').trim() || null
      if (barcode) {
        if (seenBarcodes.has(barcode)) {
          errors.push({ row: rowNo, name, message: `Barcode ${barcode} is duplicated within this file.` })
          return
        }
        if (dbBarcodes.has(barcode)) {
          errors.push({ row: rowNo, name, message: `Barcode ${barcode} already exists in your catalog — skipped.` })
          return
        }
        seenBarcodes.add(barcode)
      }
      if (sku && dbSkus.has(sku)) {
        errors.push({ row: rowNo, name, message: `SKU ${sku} already exists — skipped.` })
        return
      }
      const cost = num(row.purchasePrice)
      const price = num(row.sellingPrice)
      if (Number.isNaN(cost) || Number.isNaN(price)) {
        errors.push({ row: rowNo, name, message: 'Prices must be valid numbers.' })
        return
      }
      const opening = num(row.openingStock) || 0
      if (Number.isNaN(opening)) {
        errors.push({ row: rowNo, name, message: 'Opening stock must be a valid number.' })
        return
      }
      validRows.push({
        ...row,
        name,
        barcode,
        sku,
        purchasePrice: cost,
        sellingPrice: price,
        openingStock: opening,
      })
    })

    let created = 0
    for (const row of validRows) {
      const catId = row.category ? catByName.get(String(row.category).trim().toLowerCase()) ?? null : null
      const product = await db.product.create({
        data: {
          name: row.name,
          barcode: row.barcode || null,
          sku: row.sku || null,
          categoryId: catId,
          brand: row.brand ? String(row.brand).trim() : null,
          unit: row.unit ? String(row.unit).trim() : 'pcs',
          purchasePrice: row.purchasePrice as number,
          sellingPrice: row.sellingPrice as number,
          minStock: num(row.minStock) || 5,
        },
      })
      const inv = await db.inventoryItem.create({
        data: { branchId, productId: product.id, stock: row.openingStock as number },
      })
      if ((row.openingStock as number) > 0) {
        await db.inventoryMovement.create({
          data: {
            itemId: inv.id,
            type: 'OPENING',
            quantity: row.openingStock as number,
            balanceAfter: row.openingStock as number,
            note: 'Imported opening stock',
          },
        })
      }
      created++
    }

    return ok({ created, skipped: errors.length, total: rows.length, errors })
  } catch (err) {
    return handleApiError(err)
  }
}
