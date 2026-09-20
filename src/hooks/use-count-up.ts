'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Smoothly animates a numeric value toward its target whenever the target
 * changes. Used for dashboard KPIs — subtle ease-out count, and it respects
 * the user's reduced-motion preference (snaps instantly instead).
 */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  const prev = useRef(0)
  const reduceMotion = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }, [])

  useEffect(() => {
    const from = prev.current
    prev.current = target
    if (from === target) return
    const d = reduceMotion.current ? 0 : duration
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = d === 0 ? 1 : Math.min(1, (t - start) / d)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setValue(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
