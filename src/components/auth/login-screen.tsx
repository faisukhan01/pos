'use client'

import { useCallback, useState } from 'react'
import { Store, Loader2, ArrowRight, ShieldCheck, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'

const DEMO_ACCOUNTS = [
  { email: 'owner@pos.local', password: 'owner123', label: 'Owner', name: 'Ali Raza' },
  { email: 'manager@pos.local', password: 'manager123', label: 'Manager', name: 'Fatima Khan' },
  { email: 'cashier@pos.local', password: 'cashier123', label: 'Cashier', name: 'Hamza Ahmed' },
]

export function LoginScreen({ onSuccess, serverDown }: { onSuccess: () => void; serverDown?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = useCallback(
    async (e?: React.FormEvent, creds?: { email: string; password: string }) => {
      e?.preventDefault()
      const useEmail = creds?.email ?? email
      const usePassword = creds?.password ?? password
      if (!useEmail || !usePassword) {
        setError('Please enter both your email and password.')
        return
      }
      setBusy(true)
      setError(null)
      try {
        await api.post('/api/auth/login', { email: useEmail, password: usePassword })
        onSuccess()
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [email, password, onSuccess]
  )

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Brand panel */}
      <div className="relative lg:w-[46%] bg-primary text-primary-foreground flex flex-col justify-between p-8 lg:p-12 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Store className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Ledger POS</p>
              <p className="text-xs text-primary-foreground/70">Retail & Inventory Management</p>
            </div>
          </div>
        </div>
        <div className="relative max-w-md mt-16 lg:mt-0">
          <h1 className="text-3xl lg:text-4xl font-semibold leading-tight tracking-tight">
            The counter, the stockroom and the books — finally on one screen.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">
            Scan or search products, take payments, print receipts and keep your
            inventory honest. Built for shopkeepers, not for sysadmins.
          </p>
          <div className="mt-8 space-y-3 text-sm text-primary-foreground/80">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Role-based access — cashiers see only the till.
            </div>
            <div className="flex items-center gap-2.5">
              <Store className="h-4 w-4 shrink-0" /> Multi-branch stock and pricing, kept separate.
            </div>
          </div>
        </div>
        <p className="relative hidden lg:block text-xs text-primary-foreground/50">
          Ledger POS v1.0 · English · Currency: PKR
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Sign in to your store</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Use your work email. Cashier accounts start on the till screen.
          </p>

          {serverDown && (
            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-sm text-amber-800 dark:text-amber-200">
              <WifiOff className="h-4 w-4 mt-0.5 shrink-0" />
              <span>We couldn&apos;t reach the store server. Check your connection and try again.</span>
            </div>
          )}

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@store.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full h-11 text-[15px] font-medium" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <div className="mt-8">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Demo accounts</p>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email)
                    setPassword(acc.password)
                    submit(undefined, { email: acc.email, password: acc.password })
                  }}
                  disabled={busy}
                  className="rounded-xl border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <p className="text-sm font-medium">{acc.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{acc.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
