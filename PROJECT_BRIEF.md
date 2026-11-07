# AstroUnkle — Project Brief (Full Functionality Reference)

> A detailed, self-contained brief of the **gemstone-ecommerce** project ("AstroUnkle").
> Use this to explain to anyone (or to ChatGPT/another AI) exactly what this project is,
> what it does, and how every part works.

---

## 1. What is this project?

**AstroUnkle** is a full-stack **Vedic astrology + gemstone e-commerce platform**.
It combines two things in one website:

1. **An online store** that sells gemstones, rudraksha, and related astrology products.
2. **A suite of free Vedic astrology tools** (Kundli, Kundli matching, dosha checkers,
   nakshatra finder, gemstone recommendations, etc.) that attract visitors and funnel them
   toward relevant products.

It has three major surfaces:
- **Customer storefront** — what shoppers see and use.
- **Admin dashboard** — a full back-office to run the business.
- **REST API (v1)** — the backend powering both of the above.

---

## 2. Tech Stack

| Area | Technology |
|------|-----------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **TypeScript**, **Tailwind CSS v4** |
| Database | **MongoDB** via **Mongoose** |
| File/Media storage | **AWS S3** (presigned uploads) |
| Payments | **Razorpay** (test mode configured) |
| Auth | **JWT** via `jose` — separate admin & customer tokens, bcrypt password hashing |
| Email | **Nodemailer** + **Resend** (pluggable providers) |
| Astrology math | **astronomy-engine** (real planetary calculations) |
| Rich text | **Tiptap** editor (blog/content/product descriptions) |
| Animation | **Framer Motion** |
| Validation | **Zod** |

---

## 3. Architecture (how the code is organized)

The project follows a **clean, modular, layered architecture**. Every business feature
lives in its own module under `src/modules/<feature>/` and follows the same layered pattern:

```
controller  →  service  →  repository  →  model  →  schema  →  types
```

- **controller** — handles HTTP request/response, calls the service.
- **service** — business logic, validation, orchestration (returns a `Result<T>` — success/fail).
- **repository** — data access; talks to the database (or mock).
- **model** — Mongoose schema/model (the DB shape).
- **schema** — Zod schemas (validation of incoming data / DTOs).
- **types** — TypeScript domain types.

### Key folders
| Folder | Purpose |
|--------|---------|
| `src/app/(site)/` | Customer-facing pages (storefront + astrology tools) |
| `src/app/admin/(dashboard)/` | Admin back-office pages |
| `src/app/api/v1/` | Versioned REST API endpoints |
| `src/modules/` | 25+ business modules (products, orders, payments, etc.) |
| `src/core/` | Shared backend utilities (db, jwt, hashing, mailer, cache, rate-limit, razorpay, logging) |
| `src/lib/` | Frontend helpers + API clients + astrology reference data |
| `src/components/` | React UI components (account, astrology, shop, admin, etc.) |
| `src/data/` | Mock/seed data |
| `src/types/` | Shared public types |

### Pluggable data sources
The `.env` file has per-module `DATA_SOURCE_*` flags (e.g. `DATA_SOURCE_PRODUCTS=mongo`).
Each module can independently run against **MongoDB** or **mock data**, which makes
development and testing flexible. Default fallback is `mock`.

---

## 4. Customer Storefront — Features

Located in `src/app/(site)/`.

### E-commerce
- **Home page** — featured products, banners, popups, sections.
- **Shop** (`/shop`) — browse/filter/search the product catalogue (by category, price,
  stock, tag, featured).
- **Product detail page** (`/product/[slug]`) — images gallery, variants, specifications,
  FAQs, gemstone details (stone, planet, benefits, origin, carat, certification, clarity,
  cut, lab/certificate number), reviews, related products, certificate PDF, product
  configurator (pooja/jaap/wear add-ons).
- **Cart** — add/update/remove items (state managed client-side).
- **Wishlist** — save products for later.
- **Checkout** — shipping/billing address, coupon application, payment via Razorpay or COD.
- **Order tracking** (`/track-order`) — track an order by number.
- **Account area** (`/account`) — customer login/register, dashboard, order history,
  invoices.

### Content
- **Blog** (`/blog`) — articles (authored in admin with Tiptap).
- **Services** (`/services`) — astrology services offered.
- **FAQ**, **Contact**, **Policies** (shipping, returns, privacy, terms).
- **CMS pages** (`/pages`) — custom pages managed from admin.

### Vedic Astrology Tools (free, lead-generating)
These use the `astronomy-engine` library for real calculations and reference data in
`src/lib/astrology/`:

| Tool | Route | What it does |
|------|-------|--------------|
| Free Kundli | `/free-kundli` | Generates a birth chart from date/time/place |
| Kundli Matching | `/kundli-matching` | Gun-milan compatibility (Ashtakoota 36 points) |
| Nakshatra Finder | `/nakshatra-finder` | Finds birth star (nakshatra) |
| Moon Sign Calculator | `/moon-sign-calculator` | Calculates rashi (moon sign) |
| Dosha Checker | `/dosha-checker` | Checks for doshas (e.g. Mangal dosha) |
| Pitra Dosh Calculator | `/pitra-dosh-calculator` | Checks Pitra dosha |
| Gemstone Recommendation | `/gemstone-recommendation` | Recommends a gemstone from the chart, links to products |
| Gemstone by Zodiac | `/gemstone-by-zodiac` | Suggests stones per zodiac sign |
| Rudraksha Recommendation | `/rudraksha-recommendation` | Suggests rudraksha beads |
| Love Calculator | `/love-calculator` | Fun compatibility tool |
| Lucky Dates Calculator | `/lucky-dates-calculator` | Lucky dates |
| Ask Astrologer | `/ask-astrologer` | Lead/booking form to consult an astrologer |

**Business link:** Astrology tools map planets → gemstones (e.g. Sun→Ruby/Manik,
Moon→Pearl/Moti, Mars→Red Coral/Moonga) and deep-link each recommendation to matching
products in the shop (`shopQuery`/`shopCategory`), turning free tools into sales.

---

## 5. Admin Dashboard — Features

Located in `src/app/admin/(dashboard)/`. A complete back-office with role-based access
(admin login at `/admin/login`, JWT session). Sections:

| Section | What the admin can do |
|---------|----------------------|
| **Dashboard overview** | KPIs and summary of the business |
| **Products** | Create/edit/delete products, variants, SEO, media, gemstone details, scheduling, bulk price/actions, duplicate, trash/restore |
| **Inventory** | Stock levels, low-stock report, stock adjustments |
| **Categories** | Manage product categories |
| **Collections** | Group products into collections |
| **Orders** | View/manage orders, update status (pending→confirmed→packed→shipped→delivered), fulfillment, tracking, notes |
| **Returns** | Handle return requests and refunds |
| **Payments** | Transactions ledger (charges + refunds), summary by method/status, COD pending |
| **Customers** | Manage customer records |
| **Coupons** | Create/manage discount coupons |
| **Reviews** | Moderate product reviews (approved reviews update product rating) |
| **Blog** | Author/manage articles (Tiptap rich text) |
| **Pages** | CMS pages |
| **Banners** | Homepage/marketing banners |
| **Popups** | Site popups (with visitor targeting) |
| **Media** | Upload/manage media (S3) |
| **Bookings** | Astrologer consultation bookings |
| **Leads** | Captured leads (from astrology tools / forms) |
| **Services** | Manage astrology services |
| **Reports** | Business reports/analytics |
| **Email** | Email templates / sending |
| **Users** | Admin users + roles (role-based permissions) |
| **Activity / Audit** | Every create/update/delete is recorded in an audit log |
| **Settings** | Store-wide settings |
| **Health** | System health checks |

---

## 6. REST API (v1)

Located in `src/app/api/v1/`. Versioned endpoints, one group per module:

```
account    admin      articles   astrology  audit      banners
blog       bookings   categories collections coupons   customers
email      health     leads      orders     pages      payments
popups     products   reports    returns    reviews    roles
search     services   settings   storage    users
```

- **astrology** sub-routes: `cities` (place lookup), `kundli` (chart generation),
  `matching` (gun-milan), `report` (full astrology report).
- **storage** — S3 presigned upload URLs.
- **search** — global catalogue/content search.
- **health** — liveness/readiness.

---

## 7. Important Domain Logic (key behaviors)

### Products
- Auto-generates unique **slug** and **SKU**.
- **Lifecycle**: `draft` → `active` → `archived`; **scheduled publishing** (a product
  with a future `publishAt` auto-activates when the time passes).
- **Stock status** derived automatically: `in_stock` / `low_stock` / `out_of_stock` /
  `backorder` based on quantity + threshold + backorder flag.
- Supports **variants** (options like size/color), per-variant stock/price/SKU.
- Rich fields: SEO meta, content sections, videos, certificate PDF, specifications,
  FAQs, gemstone attributes, tax class (GST), HSN code, shipping class, making charges,
  dimensions, weight.
- **Soft delete** with trash/restore.
- Writes are **cached** (60s) and **audited**.

### Orders
- Order number format: `NK-2026-XXXX`.
- Each order item stores a **product snapshot** (name/image/price at purchase time) so
  editing/deleting a product later never changes historical orders.
- Customer is referenced by id **and** snapshotted (name/email/phone).
- **Stock is decremented** when an order becomes `confirmed`, and **restocked** on
  cancel/refund.
- Pricing breakdown: subtotal, discount (+coupon), shipping, tax, grand total.
- Status pipeline: `pending → confirmed → packed → shipped → delivered`
  (+ terminal `cancelled` / `refunded`).
- Supports **guest orders** (no customer id).
- Order emails sent on key events.

### Payments
- Razorpay integration (order create + signature verification + webhook secret).
- Payment methods: `cod`, `card`, `upi`, `netbanking`, `manual`, `razorpay`.
- The **payments report** is derived read-only from orders (charges) and returns
  (refunds): computes received, pending, COD pending, refunded, and a by-method breakdown.

### Reviews
- Customer reviews are **moderated** in admin; once approved they update the product's
  visible `rating` and `reviewCount`.

### Audit
- A shared `auditService` records every meaningful create/update/delete/status action
  across modules (entity, entityId, label, summary) — visible in the admin Activity log.

---

## 8. Security / Config notes

- Admin and customer auth use **separate JWT tokens**; passwords hashed with **bcrypt**.
- **Rate limiting** utility in `src/core/rate-limit.ts`.
- Email provider secrets are kept in env (never in DB); the send engine falls back
  across providers (SMTP → Resend → log).
- S3 uses neutral `S3_*` env var names (Vercel reserves `AWS_`-prefixed names), with
  legacy `AWS_*`/`REGION`/`BUCKET_NAME` kept as fallback.

> ⚠️ **Security warning:** the committed `.env` contains **live secrets** (MongoDB URI with
> password, S3 access keys, Razorpay keys, admin password `admin123`). These should be
> removed from version control, rotated, and kept only in a local/secret manager.

---

## 9. Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run seed` | Seed MongoDB with initial data (`scripts/seed-mongo.ts`) |

Helper script: `scripts/check-bucket-region.mjs` (verifies S3 bucket region).

---

## 10. One-line summary

> AstroUnkle is a production-grade, modular Next.js platform that sells gemstones and
> rudraksha online while offering a full suite of Vedic astrology calculators — using the
> astrology tools to recommend and sell the right gemstone to each visitor — backed by a
> complete admin dashboard (products, orders, payments, inventory, CMS, marketing, users,
> audit) and a versioned REST API over MongoDB, S3, and Razorpay.
