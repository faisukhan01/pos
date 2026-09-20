import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'

// Sample CSV template for bulk product import
export async function GET() {
  try {
    const rows = [
      ['name', 'barcode', 'sku', 'category', 'brand', 'unit', 'purchasePrice', 'sellingPrice', 'taxRate', 'openingStock', 'minStock'],
      ['Chickpeas 1kg', '8964000009999', 'GRO-9999', 'Groceries', '', 'pcs', '310', '395', '0', '40', '5'],
      ['Green Tea 100g', '8964000009882', 'BEV-9882', 'Beverages', 'Tapal', 'pcs', '280', '349', '0', '25', '5'],
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="product-import-template.csv"',
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
