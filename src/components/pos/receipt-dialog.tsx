'use client'

import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Printer, PlusCircle, CheckCircle2 } from 'lucide-react'
import { formatMoney, formatDateTime } from '@/lib/format'
import { paymentLabel, type SaleDto } from '@/lib/types'

interface ReceiptDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  sale: SaleDto | null
  businessName: string
  branchName: string
  cashierName: string
  receiptHeader: string
  receiptFooter: string
  currencySymbol: string
  onNewSale: () => void
}

// Printable receipt — 80mm thermal layout, also prints fine on A4.
export function ReceiptDialog({
  open,
  onOpenChange,
  sale,
  businessName,
  branchName,
  cashierName,
  receiptHeader,
  receiptFooter,
  currencySymbol,
  onNewSale,
}: ReceiptDialogProps) {
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !sale) return
    // Give the dialog a moment to mount, then trigger the browser print dialog
    const t = setTimeout(() => {
      printRef.current?.scrollIntoView({ block: 'start' })
    }, 150)
    return () => clearTimeout(t)
  }, [open, sale])

  if (!sale) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Sale completed
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[52vh] overflow-y-auto scrollbar-thin rounded-xl border bg-white text-black">
          <div ref={printRef} className="receipt-print bg-white">
            <div className="receipt-sheet font-mono px-5 py-5 text-[12px] leading-relaxed">
              <div className="text-center">
                <p className="text-[15px] font-bold uppercase tracking-wide">{businessName}</p>
                <p className="text-[11px]">{branchName}</p>
                <p className="mt-1 text-[11px]">{receiptHeader}</p>
              </div>

              <div className="my-3 border-t border-dashed border-black/60" />

              <div className="grid grid-cols-2 gap-x-3 text-[11px]">
                <span>Invoice</span><span className="text-right font-bold">{sale.invoiceNo}</span>
                <span>Date</span><span className="text-right">{formatDateTime(sale.createdAt)}</span>
                <span>Cashier</span><span className="text-right">{cashierName}</span>
                <span>Customer</span><span className="text-right">{sale.customerName}</span>
              </div>

              <div className="my-3 border-t border-dashed border-black/60" />

              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-black/60 text-left">
                    <th className="pb-1 font-semibold">Item</th>
                    <th className="pb-1 text-center font-semibold">Qty</th>
                    <th className="pb-1 text-right font-semibold">Rate</th>
                    <th className="pb-1 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((it) => (
                    <tr key={it.id} className="align-top">
                      <td className="py-1 pr-2">
                        {it.name}
                        {it.returnedQty > 0 && <span className="block text-[10px] italic">({it.returnedQty} returned)</span>}
                      </td>
                      <td className="py-1 text-center">{it.quantity}</td>
                      <td className="py-1 text-right">{formatMoney(it.unitPrice, currencySymbol)}</td>
                      <td className="py-1 text-right">{formatMoney(it.lineTotal, currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="my-3 border-t border-dashed border-black/60" />

              <div className="space-y-0.5 text-[11.5px]">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(sale.subtotal, currencySymbol)}</span></div>
                {sale.discount > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span>-{formatMoney(sale.discount, currencySymbol)}</span></div>
                )}
                {sale.tax > 0 && (
                  <div className="flex justify-between"><span>Tax</span><span>{formatMoney(sale.tax, currencySymbol)}</span></div>
                )}
                <div className="mt-1 flex justify-between border-t border-black pt-1 text-[14px] font-bold">
                  <span>TOTAL</span><span>{formatMoney(sale.total, currencySymbol)}</span>
                </div>
                <div className="flex justify-between"><span>Paid ({paymentLabel(sale.paymentMethod)})</span><span>{formatMoney(sale.amountReceived, currencySymbol)}</span></div>
                <div className="flex justify-between"><span>Change</span><span>{formatMoney(sale.changeDue, currencySymbol)}</span></div>
              </div>

              <div className="my-3 border-t border-dashed border-black/60" />
              <p className="text-center text-[11px]">{receiptFooter}</p>
              <p className="mt-1 text-center text-[10px]">Printed by Ledger POS</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
          <Button className="flex-1" onClick={onNewSale}>
            <PlusCircle className="h-4 w-4" /> Next customer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
