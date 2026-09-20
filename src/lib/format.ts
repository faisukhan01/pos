// Shared money / date formatting — PKR-first but configurable via settings.

export function formatMoney(amount: number | null | undefined, symbol = 'Rs'): string {
  const n = Number(amount ?? 0)
  const formatted = n.toLocaleString('en-PK', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${symbol} ${formatted}`
}

export function formatNumber(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString('en-PK')
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return `${formatDate(date)}, ${formatTime(date)}`
}

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(date)
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysAgo(n: number): Date {
  const d = startOfToday()
  d.setDate(d.getDate() - n)
  return d
}
