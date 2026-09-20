import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleApiError, requirePermission, ok, ApiError } from '@/lib/api-utils'
import { PERMISSIONS } from '@/lib/permissions'

async function getBusinessWithSettings() {
  const business = await db.business.findFirst()
  if (!business) throw new ApiError(404, 'Business profile has not been set up yet.')
  const settings = await db.settings.findUnique({ where: { businessId: business.id } })
  return { business, settings }
}

export async function GET() {
  try {
    await requirePermission()
    const { business, settings } = await getBusinessWithSettings()
    const branchCount = await db.branch.count()
    const userCount = await db.user.count({ where: { active: true } })
    return ok({
      business,
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
      branchCount,
      userCount,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

const updateSchema = z.object({
  business: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().max(30).nullable().optional(),
      email: z.string().trim().max(120).nullable().optional(),
      address: z.string().trim().max(220).nullable().optional(),
      businessType: z.enum(['RETAIL', 'RESTAURANT', 'HOTEL']).optional(),
    })
    .optional(),
  settings: z
    .object({
      receiptHeader: z.string().trim().max(200).optional(),
      receiptFooter: z.string().trim().max(200).optional(),
      currencySymbol: z.string().trim().min(1).max(6).optional(),
      showLogo: z.boolean().optional(),
      lowStockAlerts: z.boolean().optional(),
      taxInclusive: z.boolean().optional(),
    })
    .optional(),
})

export async function PUT(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
    const body = updateSchema.parse(await req.json())
    const { business } = await getBusinessWithSettings()
    if (body.business) {
      await db.business.update({ where: { id: business.id }, data: body.business })
    }
    if (body.settings) {
      await db.settings.upsert({
        where: { businessId: business.id },
        create: { businessId: business.id, ...body.settings },
        update: body.settings,
      })
    }
    return await GET()
  } catch (err) {
    return handleApiError(err)
  }
}
