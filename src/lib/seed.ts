import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// Deterministic RNG so seeded demo data is stable between runs.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface SeedProduct {
  name: string
  category: string
  brand?: string
  unit?: string
  cost: number
  price: number
  taxRate?: number
}

const CATEGORIES = [
  { name: 'Groceries', color: '#166b4e' },
  { name: 'Beverages', color: '#8a5a1e' },
  { name: 'Snacks', color: '#b5541c' },
  { name: 'Dairy & Eggs', color: '#3178a6' },
  { name: 'Bakery', color: '#9d5c9d' },
  { name: 'Household', color: '#5a6b7a' },
  { name: 'Personal Care', color: '#c04f6d' },
]

const PRODUCTS: SeedProduct[] = [
  // Groceries
  { name: 'Basmati Rice 5kg', category: 'Groceries', brand: 'Guard', cost: 2150, price: 2450 },
  { name: 'Sunflower Cooking Oil 5L', category: 'Groceries', brand: 'Sufi', cost: 3450, price: 3890 },
  { name: 'White Sugar 1kg', category: 'Groceries', cost: 140, price: 165 },
  { name: 'Red Lentils (Masoor) 1kg', category: 'Groceries', cost: 320, price: 380 },
  { name: 'Wheat Flour 10kg', category: 'Groceries', brand: 'Sunridge', cost: 1090, price: 1250 },
  { name: 'Tea Leaves 950g', category: 'Groceries', brand: 'Tapal Danedar', cost: 990, price: 1180 },
  { name: 'Iodized Salt 800g', category: 'Groceries', brand: 'National', cost: 48, price: 65 },
  { name: 'Red Chilli Powder 200g', category: 'Groceries', brand: 'National', cost: 165, price: 210 },
  // Beverages
  { name: 'Coca-Cola 1.5L', category: 'Beverages', cost: 180, price: 220 },
  { name: 'Pepsi 1.5L', category: 'Beverages', cost: 170, price: 210 },
  { name: 'Mineral Water 1.5L', category: 'Beverages', brand: 'Aquafina', cost: 55, price: 70 },
  { name: 'Yellow Label Tea 475g', category: 'Beverages', brand: 'Lipton', cost: 1240, price: 1450 },
  { name: 'Milk Pack 1L', category: 'Dairy & Eggs', brand: 'Nestlé', cost: 280, price: 320 },
  { name: 'Mango Nectar 1L', category: 'Beverages', brand: 'Shezan', cost: 205, price: 250 },
  // Snacks
  { name: 'Lays Masala 30g', category: 'Snacks', cost: 48, price: 60 },
  { name: 'Kurkure Masala Munch', category: 'Snacks', cost: 42, price: 55 },
  { name: 'Tuc Biscuit Family Pack', category: 'Snacks', brand: 'LU', cost: 24, price: 30 },
  { name: 'Dairy Milk Chocolate 60g', category: 'Snacks', brand: 'Cadbury', cost: 205, price: 250 },
  { name: 'Slanty Sticks', category: 'Snacks', cost: 40, price: 50 },
  { name: 'Popcorn Butter 100g', category: 'Snacks', cost: 92, price: 120 },
  // Dairy & Eggs
  { name: 'Fresh Yogurt 1kg', category: 'Dairy & Eggs', brand: 'Nurpur', cost: 180, price: 220 },
  { name: 'Butter 500g', category: 'Dairy & Eggs', brand: 'Nurpur', cost: 640, price: 750 },
  { name: 'Cheese Slices 12pc', category: 'Dairy & Eggs', brand: 'Adams', cost: 395, price: 480 },
  { name: 'Farm Eggs (Dozen)', category: 'Dairy & Eggs', cost: 290, price: 340 },
  // Bakery
  { name: 'Milk Bread Large', category: 'Bakery', brand: 'Bunbury', cost: 115, price: 140 },
  { name: 'Burger Buns 6pc', category: 'Bakery', cost: 72, price: 90 },
  { name: 'Cake Rusk 500g', category: 'Bakery', brand: 'English Biscuits', cost: 260, price: 320 },
  // Household
  { name: 'Detergent Powder 1kg', category: 'Household', brand: 'Surf Excel', cost: 540, price: 640 },
  { name: 'Dishwashing Liquid 500ml', category: 'Household', brand: 'Teepol', cost: 150, price: 190 },
  { name: 'Bleach 500ml', category: 'Household', cost: 165, price: 210 },
  { name: 'Facial Tissue Box', category: 'Household', brand: 'Fine', cost: 145, price: 180 },
  { name: 'Garbage Bags (10pc)', category: 'Household', cost: 195, price: 250 },
  // Personal Care
  { name: 'Shampoo 400ml', category: 'Personal Care', brand: 'Head & Shoulders', cost: 740, price: 890 },
  { name: 'Toothpaste 190g', category: 'Personal Care', brand: 'Medicom', cost: 260, price: 320 },
  { name: 'Beauty Soap 4-pack', category: 'Personal Care', brand: 'Lifebuoy', cost: 88, price: 110 },
  { name: 'Hand Sanitizer 250ml', category: 'Personal Care', cost: 205, price: 260 },
  { name: 'Face Wash 150ml', category: 'Personal Care', brand: 'Ponds', cost: 430, price: 540 },
]

export async function ensureSeeded(): Promise<boolean> {
  const existing = await db.business.count()
  if (existing > 0) return false

  const rand = mulberry32(20240614)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]

  const business = await db.business.create({
    data: {
      name: 'Mehran Traders',
      businessType: 'RETAIL',
      currency: 'PKR',
      phone: '+92 21 3456 7890',
      email: 'hello@mehrantraders.pk',
      address: 'Shop 12, Saddar Bazaar, Karachi',
    },
  })

  await db.settings.create({
    data: {
      businessId: business.id,
      receiptHeader: 'Mehran Traders — Saddar Bazaar, Karachi',
      receiptFooter: 'Goods can be exchanged within 7 days with this receipt.',
      currencySymbol: 'Rs',
    },
  })

  const branch = await db.branch.create({
    data: {
      businessId: business.id,
      name: 'Main Store — Saddar',
      code: 'MAIN',
      phone: '+92 21 3456 7890',
      address: 'Shop 12, Saddar Bazaar, Karachi',
      isMain: true,
    },
  })

  const users = await Promise.all(
    [
      { name: 'Ali Raza', email: 'owner@pos.local', password: 'owner123', role: 'OWNER' },
      { name: 'Fatima Khan', email: 'manager@pos.local', password: 'manager123', role: 'MANAGER' },
      { name: 'Hamza Ahmed', email: 'cashier@pos.local', password: 'cashier123', role: 'CASHIER' },
      { name: 'Sana Malik', email: 'inventory@pos.local', password: 'inventory123', role: 'INVENTORY_STAFF' },
      { name: 'Bilal Hassan', email: 'accountant@pos.local', password: 'accountant123', role: 'ACCOUNTANT' },
    ].map((u) =>
      db.user.create({
        data: {
          name: u.name,
          email: u.email,
          passwordHash: hashPassword(u.password),
          role: u.role,
          branchId: branch.id,
          businessId: business.id,
        },
      })
    )
  )
  const cashiers = users.filter((u) => ['OWNER', 'MANAGER', 'CASHIER'].includes(u.role))

  const catMap = new Map<string, string>()
  for (const c of CATEGORIES) {
    const cat = await db.category.create({ data: c })
    catMap.set(c.name, cat.id)
  }

  // Products with realistic EAN-style barcodes (896 = Pakistan GS1 prefix)
  const products: { id: string; price: number; name: string }[] = []
  let bc = 8964000000001n
  for (const p of PRODUCTS) {
    const prod = await db.product.create({
      data: {
        name: p.name,
        barcode: bc.toString(),
        sku: `${p.category.slice(0, 3).toUpperCase()}-${bc.toString().slice(-4)}`,
        categoryId: catMap.get(p.category)!,
        brand: p.brand ?? null,
        unit: p.unit ?? 'pcs',
        purchasePrice: p.cost,
        sellingPrice: p.price,
        taxRate: p.taxRate ?? 0,
        minStock: 6,
        description: `${p.brand ? p.brand + ' ' : ''}${p.name} sold per ${p.unit ?? 'pcs'}.`,
      },
    })
    bc += 7n
    products.push({ id: prod.id, price: p.price, name: p.name })
  }

  // Opening stock — deterministic, generous enough for seeded sales history
  const opening: Record<string, number> = {}
  for (let i = 0; i < products.length; i++) {
    const stock = 40 + Math.floor(rand() * 160)
    opening[products[i].id] = stock
    const inv = await db.inventoryItem.create({
      data: { branchId: branch.id, productId: products[i].id, stock },
    })
    await db.inventoryMovement.create({
      data: {
        itemId: inv.id,
        type: 'OPENING',
        quantity: stock,
        balanceAfter: stock,
        note: 'Opening stock',
      },
    })
  }

  // Suppliers, customers
  await db.supplier.createMany({
    data: [
      { name: 'National Distributors', phone: '+92 21 3452 1100', address: 'Jodia Bazaar, Karachi', note: 'Beverages & snacks' },
      { name: 'Al-Karam Wholesale', phone: '+92 21 3452 8822', address: 'Ranchore Line, Karachi', note: 'Groceries & rice' },
      { name: 'Fresh Farms Co', phone: '+92 21 3453 4455', address: 'Korangi, Karachi', note: 'Dairy & bakery' },
    ],
  })
  await db.customer.createMany({
    data: [
      { name: 'Ahmed Store (Wholesale)', phone: '+92 300 8212345', address: 'Saddar, Karachi' },
      { name: 'Kiran Bibi', phone: '+92 331 4455901' },
      { name: 'Usman Traders', phone: '+92 345 1223344', address: 'Garden East, Karachi' },
    ],
  })
  const customers = await db.customer.findMany()

  // Expenses for the last 2 weeks
  const expenseCats = ['Rent', 'Utilities', 'Transport', 'Supplies', 'Salaries']
  for (let d = 13; d >= 0; d -= 2) {
    const date = new Date()
    date.setDate(date.getDate() - d)
    date.setHours(11, 30, 0, 0)
    await db.expense.create({
      data: {
        category: pick(expenseCats),
        amount: 800 + Math.floor(rand() * 4200),
        paymentMethod: rand() > 0.5 ? 'CASH' : 'MOBILE',
        description: 'Routine shop expense',
        date,
      },
    })
  }

  // Historical sales for the last 14 days — real rows, real stock movements
  let saleSeq = 1
  for (let d = 13; d >= 0; d--) {
    const perDay = 3 + Math.floor(rand() * 5)
    for (let s = 0; s < perDay; s++) {
      const when = new Date()
      when.setDate(when.getDate() - d)
      when.setHours(9 + Math.floor(rand() * 13), Math.floor(rand() * 60), 0, 0)
      const lineCount = 1 + Math.floor(rand() * 4)
      const chosen: typeof products = []
      for (let i = 0; i < lineCount; i++) {
        const p = pick(products)
        if (!chosen.find((c) => c.id === p.id)) chosen.push(p)
      }
      const items = chosen.map((p) => {
        const qty = 1 + Math.floor(rand() * 3)
        return { product: p, qty, lineTotal: p.price * qty }
      })
      const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
      const method = rand() > 0.72 ? (rand() > 0.5 ? 'CARD' : 'MOBILE') : 'CASH'
      const received = method === 'CASH' ? Math.ceil(subtotal / 50) * 50 : subtotal
      const sale = await db.sale.create({
        data: {
          invoiceNo: `INV-${String(saleSeq++).padStart(6, '0')}`,
          branchId: branch.id,
          cashierId: pick(cashiers).id,
          cashierName: pick(cashiers).name,
          customerId: rand() > 0.6 ? pick(customers).id : null,
          customerName: 'Walk-in Customer',
          subtotal,
          discount: 0,
          tax: 0,
          total: subtotal,
          paymentMethod: method,
          amountReceived: received,
          changeDue: received - subtotal,
          status: 'COMPLETED',
          createdAt: when,
        },
      })
      for (const it of items) {
        await db.saleItem.create({
          data: {
            saleId: sale.id,
            productId: it.product.id,
            name: it.product.name,
            unitPrice: it.product.price,
            quantity: it.qty,
            lineTotal: it.lineTotal,
          },
        })
        const inv = await db.inventoryItem.findUnique({
          where: { branchId_productId: { branchId: branch.id, productId: it.product.id } },
        })
        if (inv) {
          await db.inventoryItem.update({
            where: { id: inv.id },
            data: { stock: inv.stock - it.qty },
          })
          await db.inventoryMovement.create({
            data: {
              itemId: inv.id,
              type: 'SALE',
              quantity: -it.qty,
              balanceAfter: inv.stock - it.qty,
              reference: sale.invoiceNo,
              createdAt: when,
            },
          })
        }
      }
    }
  }

  // A few purchase orders
  const suppliers = await db.supplier.findMany()
  let poSeq = 1
  for (const sup of suppliers.slice(0, 2)) {
    const p1 = pick(products)
    const p2 = pick(products)
    const items = [p1, p2]
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
      .map((p) => {
        const qty = 10 + Math.floor(rand() * 20)
        return { product: p, qty, cost: Math.round(p.price * 0.82) }
      })
    const total = items.reduce((s, i) => s + i.qty * i.cost, 0)
    const when = new Date()
    when.setDate(when.getDate() - Math.floor(rand() * 10))
    const po = await db.purchase.create({
      data: {
        referenceNo: `PO-${String(poSeq++).padStart(5, '0')}`,
        branchId: branch.id,
        supplierId: sup.id,
        supplierName: sup.name,
        total,
        paidAmount: total,
        status: 'PAID',
        note: 'Routine restock',
        createdAt: when,
      },
    })
    for (const it of items) {
      await db.purchaseItem.create({
        data: {
          purchaseId: po.id,
          productId: it.product.id,
          name: it.product.name,
          cost: it.cost,
          quantity: it.qty,
          lineTotal: it.qty * it.cost,
        },
      })
      const inv = await db.inventoryItem.findUnique({
        where: { branchId_productId: { branchId: branch.id, productId: it.product.id } },
      })
      if (inv) {
        await db.inventoryItem.update({ where: { id: inv.id }, data: { stock: inv.stock + it.qty } })
        await db.inventoryMovement.create({
          data: {
            itemId: inv.id,
            type: 'PURCHASE',
            quantity: it.qty,
            balanceAfter: inv.stock + it.qty,
            reference: po.referenceNo,
            createdAt: when,
          },
        })
      }
    }
  }

  // Make 3 products intentionally low/out of stock so alerts are visible
  const lowTargets = products.slice(0, 3)
  for (const p of lowTargets) {
    const inv = await db.inventoryItem.findUnique({
      where: { branchId_productId: { branchId: branch.id, productId: p.id } },
    })
    if (inv) {
      await db.inventoryItem.update({ where: { id: inv.id }, data: { stock: p === lowTargets[2] ? 0 : 3 } })
    }
  }

  return true
}
