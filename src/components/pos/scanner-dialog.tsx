'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera, CameraOff, RefreshCcw, Keyboard, Loader2, ScanBarcode } from 'lucide-react'
import { cn } from '@/lib/utils'

type ScannerState = 'idle' | 'starting' | 'scanning' | 'denied' | 'error' | 'nocamera'

const RETAIL_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
]

function playBeep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = ok ? 1046 : 320
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.09, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16)
    osc.start()
    osc.stop(ctx.currentTime + 0.17)
    osc.onended = () => ctx.close()
  } catch {
    // audio is a nicety, never a blocker
  }
}

interface ScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Decoded identifier — parent performs the same lookup as manual entry. */
  onDecoded: (code: string) => 'added' | 'not_found' | 'out_of_stock'
}

export function ScannerDialog({ open, onOpenChange, onDecoded }: ScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const [state, setState] = useState<ScannerState>('idle')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceIdx, setDeviceIdx] = useState(0)
  const [manual, setManual] = useState('')
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop()
    } catch {
      // already stopped
    }
    controlsRef.current = null
  }, [])

  const startCamera = useCallback(
    async (idx: number) => {
      if (!open || controlsRef.current) return
      setState('starting')
      setHint(null)
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, RETAIL_FORMATS)
      hints.set(DecodeHintType.TRY_HARDER, true)
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 180 })
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices()
        setDevices(list)
        if (!list.length) {
          setState('nocamera')
          return
        }
        const target = list[idx % list.length]
        controlsRef.current = await reader.decodeFromVideoDevice(
          target?.deviceId ?? undefined,
          videoRef.current!,
          (result) => {
            if (!result) return
            const code = result.getText().trim()
            const now = Date.now()
            // duplicate-scan guard: same code within 2.2s is ignored
            if (lastScanRef.current.code === code && now - lastScanRef.current.at < 2200) return
            lastScanRef.current = { code, at: now }
            const outcome = onDecoded(code)
            if (outcome === 'added') {
              playBeep(true)
              setFlash('ok')
              setHint(`Added ${code}`)
            } else if (outcome === 'out_of_stock') {
              playBeep(false)
              setFlash('bad')
              setHint('Not enough stock on the shelf')
            } else {
              playBeep(false)
              setFlash('bad')
              setHint(`Unknown barcode ${code}`)
            }
            setTimeout(() => setFlash(null), 900)
            setTimeout(() => setHint(null), 2200)
          }
        )
        setState('scanning')
      } catch (err) {
        const msg = String((err as Error)?.message ?? err)
        if (/permission|denied|NotAllowed/i.test(msg)) setState('denied')
        else if (/NotFound|no camera|Requested device/i.test(msg)) setState('nocamera')
        else setState('error')
      }
    },
    [open, onDecoded]
  )

  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) {
        stopCamera()
        setState('idle')
        lastScanRef.current = { code: '', at: 0 }
        setManual('')
        setHint(null)
        setFlash(null)
      }
      onOpenChange(o)
    },
    [onOpenChange, stopCamera]
  )

  // Start with dialog lifecycle; stop on close/unmount via cleanup
  useEffect(() => {
    if (!open) return
    // slight delay lets the <video> mount first
    const t = setTimeout(() => startCamera(deviceIdx), 120)
    return () => {
      clearTimeout(t)
      stopCamera()
    }
  }, [open, deviceIdx, startCamera, stopCamera])

  // stop when leaving the page
  useEffect(() => () => stopCamera(), [stopCamera])

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manual.trim()
    if (!code) return
    const outcome = onDecoded(code)
    if (outcome === 'added') playBeep(true)
    else playBeep(false)
    setHint(outcome === 'added' ? `Added ${code}` : outcome === 'out_of_stock' ? 'Not enough stock' : `Unknown barcode ${code}`)
    setTimeout(() => setHint(null), 2200)
    setManual('')
  }

  const cycleCamera = () => {
    if (devices.length < 2) return
    stopCamera()
    setDeviceIdx((i) => (i + 1) % devices.length)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" aria-describedby="scanner-desc">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanBarcode className="h-4.5 w-4.5" /> Scan barcode
          </DialogTitle>
          <DialogDescription id="scanner-desc">
            Point the camera at the product barcode. Each scan beeps and lands in the cart.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-5 overflow-hidden rounded-xl border bg-black aspect-[4/3]">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {state === 'scanning' && (
            <>
              {/* scan guide */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-[46%] w-[78%] rounded-lg border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <div className="absolute inset-x-3 top-1/2 h-px bg-teal-300/80" />
                </div>
              </div>
              {flash && (
                <div
                  className={cn(
                    'pointer-events-none absolute inset-0 transition-opacity',
                    flash === 'ok' ? 'bg-teal-500/30' : 'bg-destructive/40'
                  )}
                />
              )}
              {hint && (
                <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/70 px-3 py-1.5 text-center text-xs font-medium text-white">
                  {hint}
                </div>
              )}
            </>
          )}
          {(state === 'starting' || state === 'idle') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/90">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Starting camera…</p>
            </div>
          )}
          {(state === 'denied' || state === 'nocamera' || state === 'error') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/90">
              <CameraOff className="h-7 w-7" />
              <p className="text-sm font-medium">
                {state === 'denied'
                  ? 'Camera permission was declined'
                  : state === 'nocamera'
                    ? 'No camera found on this device'
                    : 'The camera could not be started'}
              </p>
              <p className="text-xs text-white/70">
                {state === 'denied'
                  ? 'Allow camera access in your browser settings, then press retry. You can always type the barcode below.'
                  : 'Type the barcode manually below — both paths use the same product lookup.'}
              </p>
              <Button size="sm" variant="secondary" className="mt-1" onClick={() => { stopCamera(); setState('idle'); setTimeout(() => startCamera(deviceIdx), 50) }}>
                <RefreshCcw className="h-3.5 w-3.5" /> Retry camera
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 pt-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            {devices.length > 1 ? `Camera ${deviceIdx + 1} of ${devices.length}` : 'Main camera'}
          </p>
          <Button variant="ghost" size="sm" onClick={cycleCamera} disabled={devices.length < 2}>
            <RefreshCcw className="h-3.5 w-3.5" /> Switch
          </Button>
        </div>

        <form onSubmit={submitManual} className="flex gap-2 px-5 pb-5 pt-3">
          <div className="relative flex-1">
            <Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Or type a barcode / SKU…"
              className="pl-9 h-10"
              inputMode="numeric"
              aria-label="Manual barcode entry"
            />
          </div>
          <Button type="submit" disabled={!manual.trim()} className="h-10">Add</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
