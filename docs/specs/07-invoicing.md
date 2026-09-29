# 7. Invoicing (AR / AP)

**Status:** In progress  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Depends on:** [Sales Orders](05-sales-orders.md), [Purchase Orders](06-purchase-orders.md), [Products & Inventory](01-products-inventory.md) (accounts)

---

## Design principle
Invoicing covers money owed **to** ATC (accounts receivable, AR) and money ATC **owes** (accounts payable, AP). Customer invoices are created from shipped sales order quantities; supplier invoices are matched against purchase orders and goods receipts before payment. Documents are never edited after issue: corrections are made with credit notes (AR) or debit notes (AP). Payment status is always calculated from recorded payments, never set by hand.

## Features
- Customer invoices with a numeric per-tenant id (e.g. `ATC-2207`); invoice date stored as its own field
- Create an invoice directly from a sales order, with items copied and the two documents linked
- Flat tax rate applied to the discounted subtotal (intentionally separate from the order tax model)
- Credit notes for returns, price corrections, and cancellations
- Supplier invoices with three-way match against PO and goods receipt
- Debit notes to suppliers for returns and price differences
- Payment recording, partial payments, and allocation across invoices
- Payment status calculated from amount paid against total
- Aging reports for receivables and payables
- Accounting export or posting (see [Products & Inventory](01-products-inventory.md#accounting-class-per-type-overridable-per-product) for the open decision)

## Document types (`documentType`)

| Value | Side | Definition | When to use |
|---|---|---|---|
| `invoice` | AR | Bill to a customer for goods shipped | Every shipment or completed order, per the invoicing rule |
| `credit_note` | AR | Reduces what a customer owes | Customer returns, price corrections, invoice errors, goodwill allowances |
| `supplier_invoice` | AP | Bill from a supplier | Every supplier bill for goods or services |
| `debit_note` | AP | Reduces what ATC owes a supplier | Returns to supplier, short deliveries already invoiced, price differences in ATC's favor |

## Customer invoice lifecycle (`status`)

| Status | Definition | Allowed next | What happens |
|---|---|---|---|
| `draft` | Being prepared; editable | `sent`, `cancelled` | Lines copied from shipped, uninvoiced sales order quantities |
| `sent` | Issued to the customer; locked | `partial`, `paid`, `cancelled` | Invoice number fixed; revenue and AR recorded; PDF emailed |
| `partial` | Some payment received | `paid` | Set automatically by payments |
| `paid` | Fully paid | — | Set automatically when amount paid ≥ total |
| `cancelled` | Voided; allowed from any non-terminal state | — | For `sent` invoices, a full credit note is created automatically so the audit trail keeps both documents |

**Overdue** is a derived flag, not a status: an invoice is overdue when it is `sent` or `partial` and today is past `dueDate`. `dueDate` = `invoiceDate` + customer `paymentTermsDays`.

## Supplier invoice lifecycle (`status`)

| Status | Definition | Allowed next |
|---|---|---|
| `draft` | Entered, not yet matched | `matched`, `on_hold`, `cancelled` |
| `matched` | Passed three-way match within tolerance | `approved` |
| `on_hold` | Match failed; waiting for resolution | `matched`, `cancelled` |
| `approved` | Approved for payment; GRNI cleared to AP | `partial`, `paid` |
| `partial` | Partly paid | `paid` |
| `paid` | Fully paid | — |
| `cancelled` | Voided | — |

## Three-way match
Each supplier invoice line is compared with its PO line and received quantity:

| Check | Rule | On failure |
|---|---|---|
| Quantity | Invoiced qty ≤ received qty − previously invoiced qty | `on_hold`; wait for receipt or request a debit note |
| Price | Invoice unit price within `priceTolerancePercent` of PO price (tenant default 2%) | `on_hold`; a manager can accept, which posts the difference to Purchase Price Variance or inventory value |
| Total | Invoice total within a small absolute amount of calculated total (rounding) | `on_hold` |

Invoices for services without a goods receipt (e.g. subcontract, utilities) use **two-way match** (PO only) or no match with manager approval.

## Invoicing rule (`invoicingRule`, per customer)

| Value | Definition | When to use |
|---|---|---|
| `per_shipment` | One invoice per posted shipment | Default. Matches Taiwan practice of issuing the invoice with or soon after delivery |
| `per_order` | One invoice when the whole order has shipped | Customers who want one bill per purchase order |
| `periodic` | One invoice per period (e.g. month-end) for all shipments | OEM customers with monthly statement billing |

## Tax and totals
- Invoice tax = (subtotal − discount) × `taxRate`, where `taxRate` is a single rate for the whole invoice (e.g. 5% Taiwan business tax, 0% for zero-rated exports)
- An invoice cannot mix tax rates; lines with different order tax percentages are split into separate invoices
- All amounts stored in minor units; rounding to whole NT$ applied at the total

## Payments

| Field | Definition | When to use |
|---|---|---|
| `direction` | `incoming` (from customer) or `outgoing` (to supplier) | Every payment |
| `method` | `bank_transfer`, `cheque`, `cash`, `offset` | `offset` when a credit or debit note is applied against an invoice without money moving |
| `amount` | Amount received or paid, in document currency | Every payment |
| `bankFee` | Fees deducted by the bank | Overseas transfers where the customer's payment arrives short |
| Allocation | How much of the payment applies to each invoice | One payment can settle several invoices; unallocated amounts stay as customer credit |

Payment status per invoice = sum of allocations ÷ total. A payment can be reversed (bounced cheque) with a reason, which reopens the invoices.

## Multi-currency
Documents in foreign currency store the exchange rate at invoice date. Differences between that rate and the rate on the payment date are recorded as foreign exchange gain or loss in the accounting export.

## Screens
- **AR invoice list** (desktop): filter by status, customer, overdue
- **Create invoice from shipments** (desktop): select uninvoiced shipments, preview, issue
- **Invoice / credit note PDF**
- **Supplier invoice entry and match** (desktop): lines against PO and receipts, match result per line
- **Payments** (desktop): record, allocate, reverse
- **Aging** (desktop): current, 1–30, 31–60, 61–90, 90+ days, for AR and AP

## Data model sketch (Prisma)
```prisma
model Invoice {
  tenantKey        String
  id               Int
  documentType     String   // invoice | credit_note | supplier_invoice | debit_note
  customerId       Int?
  supplierId       Int?
  partySnapshot    Json
  salesOrderId     Int?
  purchaseOrderId  Int?
  relatedInvoiceId Int?     // credit/debit note → original invoice
  supplierInvoiceNo String? // supplier's own number for AP
  status           String   @default("draft")
  invoiceDate      DateTime
  dueDate          DateTime
  currency         String
  exchangeRate     Decimal  @default(1)
  subtotal         Int
  discount         Int      @default(0)
  taxRate          Decimal
  taxTotal         Int
  total            Int
  amountPaid       Int      @default(0)
  createdById      Int
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime?
  lines            InvoiceLine[]
  @@id([tenantKey, id])
  @@index([tenantKey, documentType, status])
  @@index([tenantKey, dueDate])
}

model InvoiceLine {
  tenantKey       String
  id              Int
  invoiceId       Int
  lineNo          Int
  productId       Int?
  description     String
  quantity        Decimal
  unitPrice       Int
  lineTotal       Int
  shipmentLineId  Int?     // AR source
  receiptLineId   Int?     // AP match
  poLineId        Int?
  matchStatus     String?  // matched | qty_mismatch | price_mismatch
  invoice         Invoice  @relation(fields: [tenantKey, invoiceId], references: [tenantKey, id])
  @@id([tenantKey, id])
}

model Payment {
  tenantKey   String
  id          Int
  direction   String   // incoming | outgoing
  customerId  Int?
  supplierId  Int?
  method      String
  amount      Int
  bankFee     Int      @default(0)
  currency    String
  paidAt      DateTime
  reference   String?
  reversedAt  DateTime?
  reversalReason String?
  allocations PaymentAllocation[]
  @@id([tenantKey, id])
}

model PaymentAllocation {
  tenantKey  String
  id         Int
  paymentId  Int
  invoiceId  Int
  amount     Int
  payment    Payment @relation(fields: [tenantKey, paymentId], references: [tenantKey, id])
  @@id([tenantKey, id])
}
```

## Integration points
| Module | Interaction |
|---|---|
| Sales Orders | Invoices created from shipped quantities; order moves to `completed` when fully invoiced |
| Shipping & Logistics | Shipment lines are the source for AR invoice lines; proof of delivery supports disputes |
| Purchase Orders | PO and receipt lines are the basis for three-way match; PO moves to `completed` when fully invoiced |
| Products & Inventory | GRNI cleared on supplier invoice approval; price variances posted |
| Reporting | Aging, DSO, cash forecast, margin by invoice |

## Open decisions
- **Taiwan e-invoicing (電子發票):** whether the ERP must issue government uniform invoices through the Ministry of Finance platform directly, integrate with ATC's current e-invoice provider, or leave legal invoicing in ATC's existing system with the ERP invoice as an internal document. Confirm with ATC's accountant before building the AR side further
- Invoicing rule per customer (per shipment, per order, periodic)
- Accounting export vs. automatic posting

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Credit and debit notes instead of editing | Complete audit trail; meets tax and ISO record requirements | More documents for users to understand |
| Three-way match | Stops paying for goods not received or at the wrong price | Supplier invoices can sit on hold; needs someone to resolve exceptions |
| Single tax rate per invoice | Simple and matches Taiwan invoice rules | Orders with mixed tax rates produce multiple invoices |
