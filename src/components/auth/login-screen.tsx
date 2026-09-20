'use client'

import { useCallback, useState } from 'react'
import { Loader2, ArrowRight, WifiOff, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'

const DEMO_ACCOUNTS = [
  { email: 'owner@pos.local', password: 'owner123', label: 'Owner' },
  { email: 'manager@pos.local', password: 'manager123', label: 'Manager' },
  { email: 'cashier@pos.local', password: 'cashier123', label: 'Cashier' },
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
        setError('Enter your email and password to continue.')
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
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.5] dark:opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--foreground) 16%, transparent) 1px, transparent 0)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)',
          }}
        />
        <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[110px] dark:bg-primary/25" />
        <div className="absolute -bottom-40 right-[8%] h-72 w-72 rounded-full bg-chart-2/10 blur-[100px]" />
      </div>

      {/* Logo */}
      <div className="relative mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <Zap className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </span>
        <span className="text-[19px] font-semibold tracking-tight">Nova POS</span>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-[380px] rounded-2xl border bg-card p-6 shadow-xl shadow-black/[0.04] dark:shadow-black/20">
        <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Sign in to open the counter.</p>

        {serverDown && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-2.5 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
            <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Can&apos;t reach the store server. Check your connection.</span>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px]">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@novamart.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px]">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 bg-background"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="h-10 w-full text-sm font-medium" disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Sign in <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </form>

        {/* Demo accounts */}
        <div className="mt-5 border-t pt-4">
          <p className="mb-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
            Quick demo sign-in
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => submit(undefined, { email: acc.email, password: acc.password })}
                disabled={busy}
                className="rounded-lg border bg-background px-2 py-2 text-[13px] font-medium text-foreground/80 transition-all hover:border-primary/50 hover:bg-accent hover:text-accent-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="relative mt-6 text-xs text-muted-foreground/70">
        Nova POS · Fast, simple selling for every store
      </p>
    </div>
  )
}
