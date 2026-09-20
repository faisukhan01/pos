'use client'

import { Zap } from 'lucide-react'

export function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl" aria-hidden />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Zap className="h-6 w-6" strokeWidth={2.2} />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">Opening your store…</p>
    </div>
  )
}
