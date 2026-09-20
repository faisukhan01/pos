import { NextResponse } from 'next/server'
import { ensureSeeded } from '@/lib/seed'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/api-utils'

// Single entry point the app calls on load:
//  - seeds demo data on first ever run (idempotent)
//  - returns the current session + business + branches + settings
export async function GET() {
  try {
    await ensureSeeded()
    const user = await getSessionUser()
    const business = await db.business.findFirst()
    const branches = await db.branch.findMany({ orderBy: { isMain: 'desc' } })
    const settings = business
      ? await db.settings.findUnique({ where: { businessId: business.id } })
      : null
    return NextResponse.json({
      seeded: true,
      user: user
        ? { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId }
        : null,
      business: business
        ? { id: business.id, name: business.name, businessType: business.businessType, currency: business.currency, phone: business.phone, address: business.address }
        : null,
      branches: branches.map((b) => ({ id: b.id, name: b.name, isMain: b.isMain, code: b.code, address: b.address })),
      settings: settings
        ? {
            receiptHeader: settings.receiptHeader,
            receiptFooter: settings.receiptFooter,
            currencySymbol: settings.currencySymbol,
            showLogo: settings.showLogo,
            lowStockAlerts: settings.lowStockAlerts,
            taxInclusive: settings.taxInclusive,
          }
        : null,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
