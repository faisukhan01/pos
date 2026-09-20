'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartLine, SessionUser, Settings } from '@/lib/types'

// ---------------- Auth session ----------------

interface AuthState {
  user: SessionUser | null
  business: { id: string; name: string } | null
  branches: { id: string; name: string; isMain: boolean }[]
  activeBranchId: string | null
  settings: Settings | null
  setSession: (s: {
    user: SessionUser
    business: { id: string; name: string } | null
    branches: { id: string; name: string; isMain: boolean }[]
    settings: Settings | null
  }) => void
  setActiveBranch: (id: string) => void
  updateSettings: (s: Settings) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      business: null,
      branches: [],
      activeBranchId: null,
      settings: null,
      setSession: ({ user, business, branches, settings }) =>
        set((st) => ({
          user,
          business,
          branches,
          settings,
          activeBranchId:
            user.branchId ?? st.activeBranchId ?? branches.find((b) => b.isMain)?.id ?? branches[0]?.id ?? null,
        })),
      setActiveBranch: (id) => set({ activeBranchId: id }),
      updateSettings: (s) => set({ settings: s }),
      clear: () => set({ user: null, business: null, branches: [], settings: null, activeBranchId: null }),
    }),
    { name: 'pos-session' }
  )
)

// ---------------- POS Cart ----------------

export interface CartState {
  lines: CartLine[]
  customerId: string | null
  customerName: string
  discount: number // absolute amount in currency
  note: string
  add: (line: Omit<CartLine, 'quantity'>, qty?: number) => 'added' | 'increased' | 'out_of_stock' | 'max_reached'
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  setCustomer: (id: string | null, name: string) => void
  setDiscount: (v: number) => void
  setNote: (v: string) => void
  clear: () => void
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  customerId: null,
  customerName: 'Walk-in Customer',
  discount: 0,
  note: '',
  add: (line, qty = 1) => {
    const existing = get().lines.find((l) => l.productId === line.productId)
    if (existing) {
      if (existing.quantity + qty > line.maxStock) {
        return existing.quantity >= line.maxStock ? 'max_reached' : 'out_of_stock'
      }
      set({
        lines: get().lines.map((l) =>
          l.productId === line.productId ? { ...l, quantity: l.quantity + qty } : l
        ),
      })
      return 'increased'
    }
    if (qty > line.maxStock) return 'out_of_stock'
    set({ lines: [...get().lines, { ...line, quantity: qty }] })
    return 'added'
  },
  setQty: (productId, qty) => {
    set({
      lines: get()
        .lines.map((l) =>
          l.productId === productId ? { ...l, quantity: Math.max(0, Math.min(qty, l.maxStock)) } : l
        )
        .filter((l) => l.quantity > 0),
    })
  },
  remove: (productId) =>
    set({ lines: get().lines.filter((l) => l.productId !== productId) }),
  setCustomer: (id, name) => set({ customerId: id, customerName: name }),
  setDiscount: (v) => set({ discount: Math.max(0, v || 0) }),
  setNote: (v) => set({ note: v }),
  clear: () => set({ lines: [], customerId: null, customerName: 'Walk-in Customer', discount: 0, note: '' }),
}))

export function cartTotals(lines: CartLine[], discount: number) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const tax = lines.reduce((s, l) => s + l.unitPrice * l.quantity * (l.taxRate / 100), 0)
  const cappedDiscount = Math.min(discount || 0, subtotal + tax)
  const total = Math.max(0, subtotal + tax - cappedDiscount)
  return { subtotal, tax, discount: cappedDiscount, total, itemCount: lines.reduce((s, l) => s + l.quantity, 0) }
}
