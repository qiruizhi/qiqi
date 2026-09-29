# Davall Limit ERP — Overview

> Consolidated from past planning and build conversations (March–September 2026).
> Status labels reflect the last recorded state of the codebase (CLAUDE.md, 14 Mar 2026) unless noted.

---

## 1. What It Is

Davall Limit is a cross-platform ERP application for desktop and mobile, built for small and mid-sized manufacturers. The first customer is **ATC**, an automotive oil gasket manufacturer in Changhua, Taiwan, producing rubber and metal gaskets for passenger, commercial, and military vehicle engines.

ATC operates under **ISO 9001**, runs on **Toyota Production System (TPS)** principles, and supplies automotive OEMs with tight tolerance requirements. The ERP is designed around three operational priorities that follow from that: traceability, quality control, and process consistency.

**Current target:** MVP, demo-ready for ATC. Every record is keyed by a unique `tenantKey` from the start, so additional customers can be added without restructuring the data.

**Market direction:** an affordable ERP for Taiwanese SMEs, positioned as a lower-cost alternative to incumbents such as 鼎新 (Digiwin). Company name candidates under consideration include 惠通 and 精算, pending a TIPO trademark and domain check.

---

## 2. Primary Users

| Role | What they do in the system | Primary device |
|---|---|---|
| Plant Manager | Oversees production, reviews KPIs | Desktop |
| Production Supervisor | Manages work orders and the shop floor | Desktop + Mobile |
| Shop Floor Operator | Logs work, scans barcodes | Mobile |
| QC Inspector | Records inspections, flags defects | Mobile |
| Inventory Clerk | Manages stock, receives materials | Desktop + Mobile |
| Finance / Accounting | AP, AR, reporting | Desktop |
| Sales Manager | Quotes, orders, customer management | Desktop |
| System Admin | Users, roles, configuration | Desktop |

---

## 3. Modules

Each module has its own specification document. Every module file follows the same structure: design principle, features, option tables (definition and when to use), lifecycle, business rules, screens, data model sketch, integration points, open decisions, and cost/benefit.

| # | Module | Status |
|---|---|---|
| 1 | [Products & Inventory](modules/01-products-inventory.md) | In progress (redesign planned for the Postgres migration) |
| 2 | [Bill of Materials (BOM)](modules/02-bill-of-materials.md) | In progress |
| 3 | [Production Orders](modules/03-production-orders.md) | In progress |
| 4 | [Kanban & TPS](modules/04-kanban-tps.md) | Planned |
| 5 | [Sales Orders](modules/05-sales-orders.md) | In progress |
| 6 | [Purchase Orders & Procurement](modules/06-purchase-orders.md) | In progress |
| 7 | [Invoicing (AR / AP)](modules/07-invoicing.md) | In progress |
| 8 | [Quality (ISO 9001)](modules/08-quality.md) | Planned |
| 9 | [Workforce & Floor Management](modules/09-workforce.md) | Planned (Basic scope) |
| 10 | [Shipping & Logistics](modules/10-shipping-logistics.md) | Planned |
| 11 | [Reporting](modules/11-reporting.md) | Planned |
| 12 | [Admin, Auth & Security](modules/12-admin-auth-security.md) | In progress (auth stable) |

---

## 4. Cross-Cutting Design Rules

- **Single product master, separated by type and flags;** stock held per product + lot + location, changed only through the stock ledger
- **Universal document status set:** `draft | submitted | approved | rejected | cancelled | closed`, with explicit state machines per document type that code must not skip
- **Snapshot pattern** on orders and invoices
- **Soft deletes** on all tables (`deletedAt`)
- **Money stored as integers** in minor currency units
- **Dates stored as ISO 8601 UTC**, converted only in the UI
- **Identifiers:** every business table has a numeric `id` and a `tenantKey`; the primary key is `(tenantKey, id)`
  - `id` is a per-tenant, per-entity integer sequence starting at 1, allocated from the `IdCounter` table inside the same transaction as the insert (row-locked with `UPDATE … RETURNING`), so there are no gaps from races and no reuse
  - The **full id** is `{tenantKey}-{id}` (e.g. `ATC-1042`) and is what users see, search, print, and scan
  - Codes carry no type or date prefixes; item type, document type, and dates live in their own columns
  - `tenantKey` is short, unique, and immutable once assigned
  - All foreign keys are composite `(tenantKey, xxxId)`, which blocks cross-tenant references at the database level
  - Row-level security policies filter on `tenantKey`
- **Paginated list endpoints**, no unbounded queries
- **Service return shape** `{ success, data?, error?, statusCode? }`; services never throw

### Mobile vs. desktop split
| Desktop-first | Mobile-first |
|---|---|
| Financial reports, invoicing, GL | Shop floor work order execution |
| Production scheduling, MRP, kanban management | Barcode / QR inventory movements |
| BOM management and versioning | QC inspection checklists |
| User and role administration | Goods receipt |
| Complex multi-step forms | Attendance clock-in / clock-out |

Mobile rules: 44×44px minimum touch targets; tables collapse to cards below 768px.

---

## 5. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript 5 strict, Tailwind CSS 4, Radix UI, React Hook Form + Zod |
| Mobile | PWA via Next.js |
| Backend | Node.js, Express 5, TypeScript, REST |
| Database | PostgreSQL 16 via Prisma (migrated from MongoDB / Mongoose before launch) |
| Hosting | DigitalOcean (app + Managed PostgreSQL), Nginx, Docker, GitHub Actions CI/CD. Supabase was also in use as of April 2026 — confirm which is the current DB host |
| Planned additions | Redis cache, background job runner, DigitalOcean Spaces for files, Resend or SendGrid for email, Sentry for monitoring |

---

## 6. Known Gaps (as of last record)

- Sales and purchase orders do not yet move inventory on status transitions (addressed by the [Products & Inventory](modules/01-products-inventory.md) redesign)
- Lot traceability not yet enforced at goods issue (addressed by the [Products & Inventory](modules/01-products-inventory.md) redesign)
- `stockQuantity` on `Product` to be demoted to a cached total once `StockBalance` is live
- Email verification and password reset are stubbed (no email provider)
- Pagination incomplete on some list endpoints
- No background job runner for exports and email
- `countDocuments`-based code sequences to be replaced by the per-tenant `IdCounter` table (see Section 4); existing prefixed codes (IFG, SO-, INV-, etc.) to be migrated to numeric ids
- Production secrets strategy undecided

---

## 7. Out of Scope for Now

- Maintenance / TPM module
- Full HR (skills, performance, training) — workforce stays at attendance and shifts
- IATF 16949 and ISO 14001 — ISO 9001 is the only certification designed around

---

## 8. Cost / Benefit Considerations

Platform-level decisions are below. Each module file ends with its own cost/benefit table.

| Decision | Benefit | Cost / Risk |
|---|---|---|
| Custom build instead of NetSuite / Digiwin | Fits ATC's gasket, TPS, and FEFO workflows closely; becomes a sellable product for Taiwanese SMEs | Custom ERPs typically carry 3–4× the five-year TCO of a bought stack; you own tax, compliance, and security updates indefinitely |
| Numeric per-tenant ids with `tenantKey` in every key | Tenant isolation built in from day one; short, human-friendly, scannable ids; one consistent format across all entities | Composite keys on every table and join make Prisma relations more verbose; the counter table is a hot row under heavy concurrent inserts; the same full id (e.g. `ATC-1042`) can refer to different entity types, so screens and labels must always show the entity type alongside it |
| Planned modules (Quality, Workforce, Shipping, Kanban) | Quality and traceability are what ISO 9001 auditors and OEM customers check; strong differentiator vs. generic SME ERPs | Roughly doubles scope before a paying customer is live; sequencing Quality before Kanban protects the compliance story |
| PWA instead of native mobile apps | One codebase; no app store overhead | Weaker offline support and camera/scanner integration on the shop floor, which is where mobile use concentrates |
| Lot / location stock model ([Products & Inventory](modules/01-products-inventory.md)) | Enables FEFO, lot genealogy, multi-location stock, and ISO 9001 traceability; closes the order–inventory gap | Reverses the earlier "Product IS inventory" rule; touches inventory, production, order, and receiving services; more tables to keep consistent in transactions |
| Accounting integration (open decision: export vs. automatic posting) | Export needs no general ledger and fits ATC's existing accountant; automatic posting gives real-time inventory and COGS. Posting rules and chart of accounts are defined for either path | Export leaves book inventory updated monthly with manual reconciliation; automatic posting adds a general ledger, overhead rates, and period close to scope |
| Affordable-ERP positioning | Clear wedge against Digiwin on price | Low price limits budget for implementation support, which is where SME ERP projects usually fail |
