'use client'

import { useEffect, useState } from 'react'

// Tracks the browser's online/offline state, including a lightweight
// reachability probe — navigator.onLine stays true on some networks that
// drop the server, so we also ping the API when the window regains focus.
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    const onOnline = () => {
      setOnline(true)
      // Confirm actual reachability, not just the interface flag.
      fetch('/api', { cache: 'no-store' })
        .then(() => setOnline(true))
        .catch(() => setOnline(false))
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return online
}
