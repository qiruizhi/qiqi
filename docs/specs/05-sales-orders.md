# 5. Sales Orders

**Status:** In progress  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Depends on:** [Products & Inventory](01-products-inventory.md)  
**Used by:** [Invoicing](07-invoicing.md), [Shipping & Logistics](10-shipping-logistics.md), [Production Orders](03-production-orders.md)

---

## Design principle
The sales flow runs **customer → quote → sales order → shipment → invoice**. Each document copies what it needs from the one before it and keeps a **snapshot** of customer and product details, so historical documents stay accurate when master data changes. A confirmed sales order **reserves** stock; stock only leaves when a shipment is posted. Pricing is resolved from price lists at the time of entry and stored on the line.

## Features
- Customer master with billing and shipping addresses, payment terms, and customer part numbers
- Price lists with quantity breaks and validity dates
- Quotes that convert into sales orders
- Sales orders with a numeric per-tenant id (e.g. `ATC-305`)
- Per-line tax percentage
- Customer and product snapshot on each order
- Stock availability check at entry and reservation at confirmation
- Partial shipments tracked per line
- Make-to-order link to production orders
- Soft delete; only draft orders can be deleted

## Customers (`Customer`)

| Field | Definition | When to use |
|---|---|---|
| `customerType` | `oem`, `aftermarket`, `distributor`, or `other` | `oem` for vehicle and engine manufacturers with strict labeling and traceability; `aftermarket` for replacement-part buyers; `distributor` for resellers |
| `taxId` | Customer's business registration or VAT number (統一編號 in Taiwan) | Required for B2B invoices |
| `paymentTermsDays` | Days after invoice date payment is due | Every customer; defaults from tenant setting (e.g. 30) |
| `creditLimit` | Maximum unpaid balance allowed, in minor units | Customers who buy on credit. Confirming an order that would exceed it requires manager approval |
| `currency` | Currency the customer is billed in | Export customers billed in USD, EUR, or JPY; default TWD |
| `labelTemplateId` | Default shipping label template | OEM customers with label requirements (see [Shipping](10-shipping-logistics.md)) |
| `requiresCoC` | Customer requires a certificate of conformance with each shipment | OEM customers under ISO 9001 or automotive supplier requirements |

**Customer part numbers (`CustomerItem`):** maps the customer's own part number and description to ATC's product. Printed on order confirmations, packing lists, and labels. Use for every OEM customer, since they order by their part numbers.

## Price lists

| Field | Definition | When to use |
|---|---|---|
| `priceListType` | `standard` or `customer` | `standard` for the default list; `customer` for negotiated prices for one customer |
| `validFrom` / `validTo` | Dates the list applies | Annual OEM price agreements |
| `minQty` (per line) | Quantity from which the price applies | Quantity break pricing |
| `unitPrice` (per line) | Price per `uom`, in minor units of the list currency | Every line |

**Price resolution order:** customer price list (valid, highest `minQty` ≤ order qty) → standard price list → manual entry. The resolved price is stored on the order line; changing a price list never changes existing orders. Manual prices below the resolved price require a manager role.

## Quotes

| Status | Definition | Allowed next |
|---|---|---|
| `draft` | Being prepared | `sent`, `cancelled` |
| `sent` | Issued to the customer | `accepted`, `rejected`, `expired` |
| `accepted` | Customer agreed; converted to a sales order | — |
| `rejected` | Customer declined; `lostReason` recorded (price, lead time, spec, other) | — |
| `expired` | Past `validUntil` without a decision; set by a scheduled job | — |
| `cancelled` | Withdrawn by ATC | — |

Converting an accepted quote copies lines, prices, and terms into a new sales order in `draft`.

## Sales order lifecycle (`status`)

| Status | Definition | Allowed next | What happens |
|---|---|---|---|
| `draft` | Being entered; editable; deletable | `pending`, `cancelled` | Price and tax resolved per line; availability shown but not reserved |
| `pending` | Submitted, awaiting internal approval or customer confirmation; still editable | `confirmed`, `cancelled` | Credit limit checked |
| `confirmed` | Accepted and committed | `processing`, `cancelled` | Stock reserved per line; shortages can create production orders; order confirmation sent |
| `processing` | Being picked, packed, or produced | `shipped`, `cancelled` | Pick lists and production linked |
| `shipped` | All lines fully shipped | `delivered` | `shipment` entries posted; invoice can be created |
| `delivered` | Proof of delivery recorded for all shipments | `completed` | Delivery date recorded |
| `completed` | Invoiced and closed | — | Terminal |
| `cancelled` | Stopped; allowed from any non-terminal state | — | Reservations released. Lines already shipped must be returned first |

Orders are editable only in `draft` and `pending`. Changes after confirmation are handled by cancelling lines (reducing `orderedQty` down to `shippedQty`) with a reason, which is logged.

**Partial shipment:** lines track `orderedQty`, `reservedQty`, and `shippedQty`. The order stays in `processing` while some lines are open; it moves to `shipped` only when every line is fully shipped or its remainder is cancelled.

## Tax
- Each line carries `taxPercent`, defaulting from the product or customer (e.g. 5% Taiwan business tax, 0% for zero-rated exports)
- Line tax = (line quantity × unit price − line discount) × `taxPercent`
- Order totals: subtotal, discount, tax, total — all stored in minor units

Invoices use a flat tax rate on the discounted subtotal (see [Invoicing](07-invoicing.md)). Order and invoice totals can therefore differ slightly through rounding; the invoice amount is the legal amount.

## Snapshot fields
At creation the order stores: customer name, tax id, billing and shipping addresses, payment terms; and per line: product name, customer part number, unit of measure. Snapshots are refreshed only while the order is in `draft`.

## Availability and reservation
- At entry: available = `onHand` − `reserved` across `storage` locations for the product; shortages shown in red
- At confirmation: reservation created in `StockBalance`; lots are not fixed until picking, so FEFO still applies at shipment
- Shortage handling options on confirm: create a production order (`canManufacture` items), create a PO suggestion (`canPurchase` items), or confirm with a backorder

## Screens
- **Customer list / detail** (desktop): addresses, terms, part numbers, open orders, balance
- **Price lists** (desktop)
- **Quote editor** (desktop), with PDF output
- **Sales order list** (desktop): filter by status, customer, due date, shortage
- **Sales order editor** (desktop): lines with live availability, price source shown per line
- **Order confirmation PDF** in the customer's language (Traditional Chinese or English)

## Data model sketch (Prisma)
```prisma
model Customer {
  tenantKey        String
  id               Int
  name             String
  customerType     String   @default("oem")
  taxId            String?
  currency         String   @default("TWD")
  paymentTermsDays Int      @default(30)
  creditLimit      Int?
  requiresCoC      Boolean  @default(false)
  labelTemplateId  Int?
  deletedAt        DateTime?
  @@id([tenantKey, id])
}

model CustomerItem {
  tenantKey          String
  id                 Int
  customerId         Int
  productId          Int
  customerPartNo     String
  customerPartName   String?
  @@id([tenantKey, id])
  @@unique([tenantKey, customerId, customerPartNo])
}

model PriceList {
  tenantKey     String
  id            Int
  priceListType String   // standard | customer
  customerId    Int?
  currency      String
  validFrom     DateTime
  validTo       DateTime?
  @@id([tenantKey, id])
}

model PriceListLine {
  tenantKey   String
  id          Int
  priceListId Int
  productId   Int
  minQty      Decimal @default(1)
  unitPrice   Int
  @@id([tenantKey, id])
  @@index([tenantKey, priceListId, productId])
}

model SalesOrder {
  tenantKey         String
  id                Int
  quoteId           Int?
  customerId        Int
  customerSnapshot  Json
  status            String   @default("draft")
  currency          String
  orderDate         DateTime
  requestedDate     DateTime?
  customerPoNo      String?
  subtotal          Int
  discountTotal     Int      @default(0)
  taxTotal          Int
  total             Int
  createdById       Int
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?
  lines             SalesOrderLine[]
  @@id([tenantKey, id])
  @@index([tenantKey, status])
  @@index([tenantKey, customerId])
}

model SalesOrderLine {
  tenantKey       String
  id              Int
  orderId         Int
  lineNo          Int
  productId       Int
  productSnapshot Json
  orderedQty      Decimal
  reservedQty     Decimal @default(0)
  shippedQty      Decimal @default(0)
  cancelledQty    Decimal @default(0)
  unitPrice       Int
  priceSource     String  // customer_list | standard_list | manual
  discount        Int     @default(0)
  taxPercent      Decimal
  lineTotal       Int
  order           SalesOrder @relation(fields: [tenantKey, orderId], references: [tenantKey, id])
  @@id([tenantKey, id])
}
```
Quotes (`Quote`, `QuoteLine`) mirror the order tables with `validUntil` and `lostReason`.

## Integration points
| Module | Interaction |
|---|---|
| Products & Inventory | Availability, reservations, `shipment` and `return` entries |
| Production Orders | Shortages on confirmation can create linked production orders |
| Shipping & Logistics | Shipments are created from open order lines; shipment posting updates `shippedQty` |
| Invoicing | Invoices are created from shipped quantities |
| Quality | Customer complaints link to the sales order and shipped lots |
| Reporting | Order intake, backlog, on-time delivery, margin by customer |

## Open decisions
- Whether `pending` means internal approval, customer confirmation, or both
- Whether invoices are raised per shipment or per order
- Multi-currency: whether exchange rates are stored per order or fetched at invoice date

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Reserve at confirmation, pick lots at shipment | Protects committed stock while keeping FEFO accurate | Reserved stock is not tied to a lot, so short-dated lots can still expire before picking |
| Price lists with quantity breaks | Consistent pricing and fewer manual errors | Setup work for each OEM agreement |
| Customer part numbers | Orders and labels match what OEMs expect | One more mapping to maintain per customer |
