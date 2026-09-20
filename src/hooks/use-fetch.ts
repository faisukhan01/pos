'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/client-api'

// Minimal data-fetching hook with manual refetch — keeps views honest about
// loading / error / empty states without heavyweight machinery.
export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(!!url)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const tick = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(
    async (silent = false) => {
      if (!url) return
      if (!silent) setLoading(true)
      setError(null)
      const myTick = ++tick.current
      try {
        const d = await api.get<T>(url)
        if (mounted.current && myTick === tick.current) setData(d)
      } catch (e) {
        if (mounted.current && myTick === tick.current) setError((e as Error).message)
      } finally {
        if (mounted.current && myTick === tick.current) setLoading(false)
      }
    },
    [url]
  )

  useEffect(() => {
    load()
  }, [load])

  const refetch = useCallback(() => load(true), [load])

  return { data, loading, error, refetch, reload: () => load(false) }
}
