'use client'

import { Store } from 'lucide-react'

export function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <Store className="h-7 w-7" strokeWidth={1.8} />
      </div>
      <p className="mt-5 text-sm font-medium text-muted-foreground">Opening your store…</p>
    </div>
  )
}
