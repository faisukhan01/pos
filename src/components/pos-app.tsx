'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/client-api'
import { useAuthStore } from '@/lib/store'
import type { SessionUser, Settings } from '@/lib/types'
import { SplashScreen } from '@/components/auth/splash-screen'
import { LoginScreen } from '@/components/auth/login-screen'
import { AppShell } from '@/components/layout/app-shell'

interface BootstrapResponse {
  user: SessionUser | null
  business: { id: string; name: string; businessType: string; currency: string; phone: string | null; address: string | null } | null
  branches: { id: string; name: string; isMain: boolean; code: string | null; address: string | null }[]
  settings: Settings | null
}

export function PosApp() {
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading')
  const [serverSeeded, setServerSeeded] = useState(true)
  const { user, setSession, clear } = useAuthStore()

  const bootstrap = useCallback(async () => {
    try {
      const d = await api.get<BootstrapResponse>('/api/bootstrap')
      setServerSeeded(true)
      if (d.user && d.business) {
        setSession({
          user: d.user,
          business: { id: d.business.id, name: d.business.name },
          branches: d.branches,
          settings: d.settings,
        })
      } else {
        clear()
      }
    } catch {
      setServerSeeded(false)
      clear()
    } finally {
      setPhase('ready')
    }
  }, [setSession, clear])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  if (phase === 'loading') return <SplashScreen />
  if (!user || !serverSeeded) return <LoginScreen onSuccess={bootstrap} serverDown={!serverSeeded} />
  return <AppShell onSignOut={bootstrap} />
}
