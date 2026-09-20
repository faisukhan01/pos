# Nova POS — Simple, Fast Selling for Every Store

A production-minded, full-stack point-of-sale and retail management platform for
small and medium local businesses — built for the counter first: **scan → add to
cart → take payment → print receipt**, with inventory that stays honest.

![stack](https://img.shields.io/badge/Next.js-16-black) ![stack](https://img.shields.io/badge/TypeScript-5-blue) ![stack](https://img.shields.io/badge/Prisma-ORM-green) ![stack](https://img.shields.io/badge/TailwindCSS-4-cyan)

## Features

**Point of Sale**
- Camera barcode/QR scanning (ZXing) with permission handling, duplicate-scan
  guard, audio feedback and camera switching — plus manual/SKU entry and
  keyboard-wedge scanner compatibility (press `/`, scan, Enter). Both paths use
  the **same product lookup service**.
- Fast cart: quantity steppers, stock caps, discounts, customer selection
  (Walk-in supported), payment methods (Cash / Card / Mobile) with quick-amount
  buttons and change calculation.
- Professional printable receipt (80mm thermal + A4) with configurable
  header/footer.

**Inventory integrity**
- Every stock change is a transaction with a traceable movement (sale, purchase,
  return, adjustment, opening). Partial-return-safe returns restore stock.
- Low-stock / out-of-stock alerts, manual adjustments with reasons, movement
  timeline per product, stock valuation at cost and retail.

**Back office**
- Products: CRUD, categories, brands, SKUs, barcodes, tax, units + **CSV bulk
  import** with template download, preview, validation and import summary.
- Purchases with supplier history, payment status, automatic stock increase.
- Customers, Suppliers, Expenses (monthly view + category breakdown).
- Reports: daily sales, payment mix, cashier performance, best sellers,
  category sales, inventory valuation, expenses, purchase orders — with date
  filters. Every chart runs on real data.
- Dashboard: today's sales, transactions, average sale, 7-day totals, stock
  alerts, 14-day trend, recent sales.

**Platform**
- Multi-branch data model (Business → Branch → per-branch stock & pricing).
- Role-based access with granular permissions enforced **server-side**:
  Owner, Manager, Cashier — simple roles, real server-side enforcement.
- Secure sessions (scrypt password hashing, HMAC-signed httpOnly cookies),
  Zod validation, idempotency keys for safe sale retries, PKR-first but
  configurable currency.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui ·
Prisma ORM · SQLite (portable to PostgreSQL) · Zod · Zustand ·
@zxing/browser · Recharts

## Getting started

```bash
bun install
bun run db:push     # create the database
bun run dev         # start on http://localhost:3000
```

The database seeds itself on first load with a realistic demo store
(products with EAN-13 barcodes, 14 days of sales history, users, suppliers).

### Demo accounts

| Role            | Email                  | Password        |
| --------------- | ---------------------- | --------------- |
| Owner           | owner@pos.local        | owner123        |
| Manager         | manager@pos.local      | manager123      |
| Cashier         | cashier@pos.local      | cashier123      |

### Testing the scanner without hardware

No physical scanner needed: use the **Scan** button → manual entry, or type a
seeded barcode into the search box and press Enter, e.g.:

```
8964000000001  → Basmati Rice 5kg
8964000000253  → Face Wash 150ml
9999999999999  → unknown barcode (Product Not Found flow)
```

## Roadmap

- Urdu (اردو) localization alongside English
- Offline-first sale queue (idempotency keys already in place)
- Restaurant/cafe & hotel modules (tables, kitchen display, room charges) —
  business-type hooks are already in the schema
- SaaS super-admin panel, plans & subscription limits
