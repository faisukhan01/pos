'use client'

import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ShortcutRow {
  keys: string[]
  label: string
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ['/'], label: 'Focus the search box — then scan or type' },
  { keys: ['Enter'], label: 'In search: treat input as a barcode and add it to the cart' },
  { keys: ['?'], label: 'Open this shortcuts help' },
  { keys: ['Esc'], label: 'Close dialogs and menus' },
  { keys: ['Ctrl', 'P'], label: 'Print the receipt or report that is open' },
]

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby="shortcuts-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" /> Counter shortcuts
          </DialogTitle>
          <DialogDescription id="shortcuts-desc">
            Built for speed at a busy counter — and for USB keyboard-wedge scanners that type into the search box.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
            >
              <span className="text-[13px]">{s.label}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Tip: held sales (the pause button) park a customer&apos;s cart while you serve the next one.
        </p>
      </DialogContent>
    </Dialog>
  )
}
