// Small client-side CSV helpers — build + download a CSV from rows,
// and page through list APIs (which cap pageSize at 100) to collect
// everything matching the current filters.

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    // Quote when the value contains a comma, quote, newline; double inner quotes.
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function todayStamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Collect every page of a paginated endpoint (pageSize capped at 100 server-side).
export async function fetchAllPages<T>(
  buildUrl: (page: number, pageSize: number) => string,
  readItems: (data: T) => unknown[],
  maxPages = 40
): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(buildUrl(page, 100), { cache: 'no-store' })
    if (!res.ok) throw new Error(`Export failed (page ${page}, status ${res.status})`)
    const data = (await res.json()) as T
    out.push(data)
    const items = readItems(data)
    if (items.length < 100) break
  }
  return out
}
