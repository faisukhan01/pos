import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { hasPermission, type Permission } from '@/lib/permissions'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) return jsonError(err.message, err.status)
  if (err instanceof ZodError) {
    const first = err.issues?.[0]
    const field = first?.path?.join('.') || 'input'
    return jsonError(`${field}: ${first?.message || 'is invalid'}`, 422)
  }
  // Prisma unique constraint
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002') {
    return jsonError('That value already exists. Please use a different barcode, SKU or name.', 409)
  }
  console.error('[api]', err)
  return jsonError('Something went wrong on our side. Please try again.', 500)
}

export async function requireUser() {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'Please sign in to continue.')
  return user
}

export async function requirePermission(permission?: Permission) {
  const user = await requireUser()
  if (permission && !hasPermission(user.role, permission)) {
    throw new ApiError(403, "You don't have permission to perform this action.")
  }
  return user
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function parseIntParam(value: string | null, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}
