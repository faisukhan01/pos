'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, Download, CheckCircle2, AlertTriangle, Loader2, Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/client-api'
import { cn } from '@/lib/utils'

interface ImportRow {
  name?: string
  barcode?: string
  sku?: string
  category?: string
  brand?: string
  unit?: string
  purchasePrice?: string | number
  sellingPrice?: string | number
  taxRate?: string | number
  openingStock?: string | number
  minStock?: string | number
}

interface ImportResult {
  created: number
  skipped: number
  total: number
  errors: { row: number; name: string; message: string }[]
}

// Minimal RFC-4180-ish CSV parser (handles quotes and commas inside quotes)
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

function rowsToObjects(rows: string[][]): { headers: string[]; objects: ImportRow[] } {
  if (!rows.length) return { headers: [], objects: [] }
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ''))
  const objects = rows.slice(1).map((cells) => {
    const obj: ImportRow = {}
    headers.forEach((h, i) => {
      ;(obj as Record<string, string>)[h] = (cells[i] ?? '').trim()
    })
    return obj
  })
  return { headers, objects }
}

export function ImportDialog({
  open,
  onOpenChange,
  categories,
  onImported,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  categories: string[]
  onImported: () => void
}) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const knownCategories = useMemo(() => new Set(categories.map((c) => c.toLowerCase())), [categories])

  const reset = () => {
    setRows([])
    setFileName(null)
    setResult(null)
  }

  const onFile = async (file: File) => {
    setResult(null)
    setFileName(file.name)
    const text = await file.text()
    const { objects } = rowsToObjects(parseCsv(text))
    if (!objects.length) {
      toast.error('The file appears to be empty or not a CSV.')
      return
    }
    setRows(objects.slice(0, 500))
  }

  const rowIssues = (r: ImportRow, idx: number): string | null => {
    if (!r.name || r.name.length < 2) return 'Missing product name'
    if (r.sellingPrice === undefined || r.sellingPrice === '' || Number.isNaN(Number(r.sellingPrice))) return 'Invalid selling price'
    if (r.purchasePrice && Number.isNaN(Number(r.purchasePrice))) return 'Invalid purchase price'
    if (r.category && !knownCategories.has(r.category.toLowerCase())) return `Unknown category “${r.category}” (will import as uncategorized)`
    void idx
    return null
  }

  const doImport = async () => {
    setBusy(true)
    try {
      const res = await api.post<ImportResult>('/api/products/import', { rows })
      setResult(res)
      onImported()
      toast.success(`Import finished — ${res.created} products added`, {
        description: res.skipped > 0 ? `${res.skipped} rows were skipped (see the summary).` : 'All rows imported cleanly.',
      })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const validCount = rows.filter((r, i) => !rowIssues(r, i)?.startsWith('Missing') && !rowIssues(r, i)?.startsWith('Invalid')).length

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] flex flex-col" aria-describedby="import-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Import products from CSV
          </DialogTitle>
          <DialogDescription id="import-desc">
            Download the template, fill it with your supplier list, then preview before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 overflow-hidden min-h-0 flex-1">
          {/* Step 1 — template + file pick */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const a = document.createElement('a')
              a.href = '/api/products/import-template'
              a.download = 'product-import-template.csv'
              a.click()
              toast.success('Template downloaded')
            }}>
              <Download className="h-4 w-4" /> Sample template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Choose CSV file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
            {fileName && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{fileName}</span>}
          </div>

          {/* Preview */}
          {rows.length > 0 && !result && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="border-emerald-300 text-emerald-700">{validCount} ready</Badge>
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  {rows.length - validCount} with warnings
                </Badge>
                <span className="text-xs text-muted-foreground">First 100 rows shown</span>
              </div>
              <ScrollArea className="min-h-0 flex-1 rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">#</th>
                      <th className="px-2 py-2 text-left font-medium">Name</th>
                      <th className="px-2 py-2 text-left font-medium">Barcode</th>
                      <th className="px-2 py-2 text-left font-medium">Category</th>
                      <th className="px-2 py-2 text-right font-medium">Cost</th>
                      <th className="px-2 py-2 text-right font-medium">Price</th>
                      <th className="px-2 py-2 text-right font-medium">Stock</th>
                      <th className="px-2 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => {
                      const issue = rowIssues(r, i)
                      return (
                        <tr key={i} className={cn('border-t', issue?.startsWith('Missing') || issue?.startsWith('Invalid') ? 'bg-destructive/5' : '')}>
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1.5 font-medium">{r.name || '—'}</td>
                          <td className="px-2 py-1.5 font-price">{r.barcode || '—'}</td>
                          <td className="px-2 py-1.5">{r.category || '—'}</td>
                          <td className="px-2 py-1.5 text-right font-price">{r.purchasePrice || '—'}</td>
                          <td className="px-2 py-1.5 text-right font-price">{r.sellingPrice || '—'}</td>
                          <td className="px-2 py-1.5 text-right font-price">{r.openingStock || '0'}</td>
                          <td className="px-2 py-1.5">
                            {issue ? (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertTriangle className="h-3 w-3" /> {issue}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" /> OK
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}

          {/* Result summary */}
          {result && (
            <div className="flex-1 min-h-0 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/50 py-3">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{result.created}</p>
                  <p className="text-xs text-muted-foreground">products added</p>
                </div>
                <div className="rounded-xl border py-3">
                  <p className="text-2xl font-bold">{result.total}</p>
                  <p className="text-xs text-muted-foreground">rows in file</p>
                </div>
                <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/50 py-3">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">skipped</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <ScrollArea className="max-h-44 rounded-xl border">
                  <ul className="divide-y text-xs">
                    {result.errors.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 px-3 py-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span>
                          <strong>Row {e.row}</strong> ({e.name}): {e.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
              <Button variant="outline" className="w-full" onClick={reset}>
                Import another file
              </Button>
            </div>
          )}

          {rows.length === 0 && !result && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No file chosen yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Columns we read: name*, barcode, sku, category, brand, unit, purchasePrice, sellingPrice*, taxRate,
                openingStock, minStock. Only the product name and selling price are required.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={doImport} disabled={rows.length === 0 || busy || !!result}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Import ${validCount} products`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
