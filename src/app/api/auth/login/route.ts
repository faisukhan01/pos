import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, setSessionCookie } from '@/lib/auth'
import { handleApiError, ApiError } from '@/lib/api-utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!email || !password) {
      throw new ApiError(422, 'Please enter your email and password.')
    }
    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, 'Incorrect email or password. Please try again.')
    }
    if (!user.active) {
      throw new ApiError(403, 'This account has been deactivated. Contact your store owner.')
    }
    await setSessionCookie(user.id)
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
