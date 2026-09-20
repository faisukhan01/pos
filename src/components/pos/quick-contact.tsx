'use client'

import { Phone, MessageCircle, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/** Digits only, for tel: links. */
export function telDigits(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

/**
 * Normalize to an international number for WhatsApp (wa.me).
 * Local Pakistani mobiles (03XX XXXXXXX) become 92 3XX XXXXXXX; numbers that
 * already start with a country code pass through untouched.
 */
export function waDigits(phone: string): string {
  const d = phone.replace(/\D+/g, '')
  if (d.startsWith('0')) return `92${d.slice(1)}`
  return d
}

/**
 * Phone quick actions: tap-to-dial, WhatsApp deep link, and copy-to-clipboard.
 * Used on Customers and Suppliers rows so staff can reach people in one tap.
 */
export function QuickContact({ phone, name, className, compact = false }: { phone: string; name?: string; className?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      toast.success(`Number copied${name ? ` — ${name}` : ''}`)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Could not copy the number')
    }
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <a
        href={`tel:${telDigits(phone)}`}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm font-price transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`Call ${name ?? phone}`}
        title={`Call ${phone}`}
      >
        <Phone className="h-3 w-3 text-muted-foreground" />
        {!compact && phone}
      </a>
      <a
        href={`https://wa.me/${waDigits(phone)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-ring dark:text-teal-400 dark:hover:bg-teal-950 dark:hover:text-teal-300"
        aria-label={`WhatsApp ${name ?? phone}`}
        title={`WhatsApp ${name ?? phone}`}
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`Copy number ${name ?? phone}`}
        title="Copy number"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}
