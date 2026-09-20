import { createHash, randomBytes, createHmac, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

const SESSION_COOKIE = 'pos_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.DATABASE_URL || 'pos-dev-secret-2024'
}

// ---------- Password hashing (scrypt, no external deps) ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

// ---------- Signed session token (payload.signature) ----------

interface SessionPayload {
  uid: string
  exp: number
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url')
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = { uid: userId, exp: Date.now() + SESSION_TTL_MS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

function parseSessionToken(token: string): SessionPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload
    if (!payload.uid || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ---------- Session helpers for route handlers ----------

export async function setSessionCookie(userId: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // sandbox runs over http
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getSessionUser() {
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return null
    const payload = parseSessionToken(token)
    if (!payload) return null
    const user = await db.user.findUnique({
      where: { id: payload.uid },
      include: { branch: true },
    })
    if (!user || !user.active) return null
    return user
  } catch {
    return null
  }
}

export function sessionCookieName() {
  return SESSION_COOKIE
}
