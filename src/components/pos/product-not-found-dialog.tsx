'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScanSearch, PlusCircle, X } from 'lucide-react'

interface ProductNotFoundDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  code: string | null
  onAddProduct: (code: string) => void
}

// Unknown barcode state — never invent product data; offer the next action.
export function ProductNotFoundDialog({ open, onOpenChange, code, onAddProduct }: ProductNotFoundDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby="pnf-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-amber-600" /> Product not found
          </DialogTitle>
          <DialogDescription id="pnf-desc">
            This barcode is not registered in this store. No product was added to the cart.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-muted px-4 py-3">
          <p className="text-xs text-muted-foreground">Scanned code</p>
          <p className="font-price text-lg font-semibold tracking-wide">{code ?? '—'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onOpenChange(false)
              if (code) onAddProduct(code)
            }}
          >
            <PlusCircle className="h-4 w-4" /> Add product
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
