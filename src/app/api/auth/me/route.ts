import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ user: null })
  const business = await db.business.findFirst()
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      branch: user.branch,
    },
    business: business
      ? { id: business.id, name: business.name, businessType: business.businessType, currency: business.currency }
      : null,
  })
}
