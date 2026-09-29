# 6. Purchase Orders & Procurement

**Status:** In progress  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Depends on:** [Products & Inventory](01-products-inventory.md)  
**Used by:** [Invoicing](07-invoicing.md) (supplier invoices), [Quality](08-quality.md) (incoming inspection), [Kanban & TPS](04-kanban-tps.md), [Shipping & Logistics](10-shipping-logistics.md) (inbound)

---

## Design principle
Procurement runs **supplier → purchase order → goods receipt → supplier invoice**. A purchase order commits ATC to buy; a goods receipt records what physically arrived, creates lots, and posts `receipt` entries; the supplier invoice is matched against both before payment (three-way match). Suppliers are controlled through an approved supplier list, since ISO 9001 requires evaluated suppliers for materials that affect product quality.

## Features
- Supplier master with approval status, lead times, and supplier item codes
- Approved supplier list and supplier scorecard (on-time delivery, quality)
- Purchase orders with a numeric per-tenant id (e.g. `ATC-118`)
- Standard, blanket, and subcontract purchase orders
- Purchase suggestions from reorder points, BOM explosion, and kanban signals
- Goods receipt on mobile: scan PO → count → capture supplier lot and expiry → put away
- Partial receipts per line, with over- and under-receipt tolerance
- Incoming inspection routing to quarantine
- Returns to supplier
- Supplier lead time management

## Suppliers (`Supplier`)

| Field | Definition | When to use |
|---|---|---|
| `approvalStatus` | Whether the supplier may be used (see below) | Every supplier |
| `taxId` | Supplier business registration number (統一編號) | Required for matching Taiwanese supplier invoices |
| `currency` | Currency the supplier bills in | Default TWD |
| `paymentTermsDays` | Days after invoice date payment is due | Every supplier |
| `defaultLeadTimeDays` | Typical days from PO to delivery | Used when the supplier item has no specific lead time |
| `requiresCoA` | Supplier must send a certificate of analysis with each lot | Rubber compound and adhesive suppliers |

### Approval status (`approvalStatus`)

| Value | Definition | When to use |
|---|---|---|
| `prospect` | Being evaluated; POs allowed only for samples | New suppliers before qualification |
| `approved` | Qualified; POs allowed | Suppliers that passed evaluation |
| `conditional` | Approved with open quality issues; POs allowed with a warning, receipts always inspected | Suppliers with an open NCR or CAPA |
| `blocked` | No new POs allowed | Suppliers that failed evaluation or repeated quality problems |

### Supplier items (`SupplierItem`)
Links a supplier to a product with the supplier's own code, price, minimum order quantity (`moq`), order multiple, and lead time. A product can have several suppliers; one is marked `isPreferred` and pre-fills on purchase suggestions.

### Supplier scorecard
Calculated monthly per supplier: on-time delivery % (received by promised date), quantity accuracy %, quality acceptance % (lots passed ÷ lots inspected), and open NCR count. Used in the annual supplier evaluation required by ISO 9001.

## Purchase order types (`poType`)

| Value | Definition | When to use |
|---|---|---|
| `standard` | One-time order for set quantities and dates | Default |
| `blanket` | Long-term agreement for an item at a fixed price, with quantities called off over time | High-volume materials under annual price agreements, and supplier kanban loops. Each call-off is a release line with its own date |
| `subcontract` | Order for a service performed on ATC's own material by an outside supplier | Outsourced plating, coating, or heat treatment. Material is sent out with a `transfer` to a subcontractor location and received back as the processed item |

## Lifecycle (`status`)
Purchase orders use the same status set as sales orders, defined from the buying side:

| Status | Definition | Allowed next | What happens |
|---|---|---|---|
| `draft` | Being prepared; editable; deletable | `pending`, `cancelled` | Prices default from supplier items |
| `pending` | Awaiting internal approval; still editable | `confirmed`, `cancelled` | Approval required above a tenant-set amount |
| `confirmed` | Approved and sent to the supplier | `processing`, `cancelled` | PO PDF emailed; lines appear as expected receipts |
| `processing` | Supplier has acknowledged and is preparing | `shipped`, `delivered`, `cancelled` | Supplier's promised date recorded |
| `shipped` | Supplier has dispatched | `delivered` | Optional; set when an advance shipping notice or tracking number is received |
| `delivered` | All lines fully received (or remainders cancelled) | `completed` | Receipt totals final |
| `completed` | Supplier invoice matched and closed | — | Terminal |
| `cancelled` | Stopped; allowed from any non-terminal state | — | Open quantities released. Received lines must be returned first |

Lines track `orderedQty`, `receivedQty`, `rejectedQty`, and `cancelledQty`. The order stays in `processing` or `shipped` while any line is partly received.

## Purchase suggestions
A planner screen lists items needing purchase, from three sources:

| Source | Definition | When it applies |
|---|---|---|
| `reorder_point` | Available + open PO quantity is below `reorderPoint` | Items not under kanban |
| `bom_explosion` | Shortage from confirmed and scheduled production orders | Materials for planned production |
| `kanban` | A supplier kanban card is signaled | Items under supplier kanban |

Suggested quantity is rounded up to the supplier's `moq` and order multiple, capped at `maxStockLevel` where set. The planner selects suggestions and converts them into draft POs grouped by supplier.

## Goods receipt
A goods receipt (`GoodsReceipt`) records one delivery against one PO.

1. Scan or select the PO; open lines are shown
2. For each line: enter quantity received, supplier lot number, expiry date (or it is calculated from `shelfLifeDays`), and attach the CoA if required
3. The system creates a lot per supplier lot and posts `receipt` entries into the `receiving` location
4. If the product or supplier requires incoming inspection, the lot is set to `quarantine`; otherwise to `available` and a put-away task is created

**Receiving tolerance:** receipts over `orderedQty` × (1 + `overReceiptPercent`) are blocked; the tenant default is 5%. Short deliveries leave the line open until the remainder is received or cancelled.

**Incoming inspection required when:** the product has `requiresIncomingInspection` on, the supplier is `conditional` or `prospect`, or the lot is the first from a new supplier item.

## Returns to supplier
Rejected or excess material is returned with a return document linked to the PO and lot. It posts a `return` entry out of stock, updates `rejectedQty`, and creates a debit note request for [Invoicing](07-invoicing.md). Quality-related returns link to an NCR.

## Screens
- **Supplier list / detail** (desktop): approval status, items and prices, scorecard, open POs
- **Purchase suggestions** (desktop)
- **Purchase order list and editor** (desktop), with PDF output in English or Traditional Chinese
- **Expected receipts** (desktop and mobile): open lines by expected date
- **Goods receipt** (mobile-first): scan, count, lot, expiry, photo of CoA
- **Return to supplier** (desktop)

## Data model sketch (Prisma)
```prisma
model Supplier {
  tenantKey           String
  id                  Int
  name                String
  approvalStatus      String  @default("prospect") // prospect | approved | conditional | blocked
  taxId               String?
  currency            String  @default("TWD")
  paymentTermsDays    Int     @default(30)
  defaultLeadTimeDays Int?
  requiresCoA         Boolean @default(false)
  deletedAt           DateTime?
  @@id([tenantKey, id])
}

model SupplierItem {
  tenantKey       String
  id              Int
  supplierId      Int
  productId       Int
  supplierItemCode String?
  unitPrice       Int
  currency        String
  moq             Decimal @default(0)
  orderMultiple   Decimal @default(1)
  leadTimeDays    Int?
  isPreferred     Boolean @default(false)
  @@id([tenantKey, id])
  @@unique([tenantKey, supplierId, productId])
}

model PurchaseOrder {
  tenantKey        String
  id               Int
  poType           String   @default("standard") // standard | blanket | subcontract
  supplierId       Int
  supplierSnapshot Json
  status           String   @default("draft")
  currency         String
  orderDate        DateTime
  promisedDate     DateTime?
  subtotal         Int
  taxTotal         Int
  total            Int
  approvedById     Int?
  createdById      Int
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime?
  lines            PurchaseOrderLine[]
  @@id([tenantKey, id])
  @@index([tenantKey, status])
  @@index([tenantKey, supplierId])
}

model PurchaseOrderLine {
  tenantKey     String
  id            Int
  poId          Int
  lineNo        Int
  productId     Int
  orderedQty    Decimal
  receivedQty   Decimal @default(0)
  rejectedQty   Decimal @default(0)
  cancelledQty  Decimal @default(0)
  unitPrice     Int
  taxPercent    Decimal
  expectedDate  DateTime?
  source        String?  // reorder_point | bom_explosion | kanban | manual
  po            PurchaseOrder @relation(fields: [tenantKey, poId], references: [tenantKey, id])
  @@id([tenantKey, id])
}

model GoodsReceipt {
  tenantKey     String
  id            Int
  poId          Int
  receivedAt    DateTime @default(now())
  receivedById  Int
  deliveryNoteNo String?
  lines         GoodsReceiptLine[]
  @@id([tenantKey, id])
}

model GoodsReceiptLine {
  tenantKey      String
  id             Int
  receiptId      Int
  poLineId       Int
  lotId          Int
  quantity       Decimal
  inspectionRequired Boolean @default(false)
  receipt        GoodsReceipt @relation(fields: [tenantKey, receiptId], references: [tenantKey, id])
  @@id([tenantKey, id])
}
```
`Product` gains `requiresIncomingInspection Boolean @default(false)`.

## Integration points
| Module | Interaction |
|---|---|
| Products & Inventory | Lots created at receipt; `receipt` and `return` entries; GRNI posting |
| BOM / Production | Shortages feed purchase suggestions |
| Kanban & TPS | Supplier kanban signals create blanket PO release lines; receipt sets cards to `full` |
| Quality | Incoming inspection, supplier NCRs, supplier approval status |
| Invoicing | Supplier invoices matched against PO price and received quantity |
| Shipping & Logistics | Expected receipts feed dock scheduling |
| Reporting | Spend by supplier, open PO value, supplier scorecard |

## Open decisions
- PO approval thresholds and who approves
- Whether suppliers receive POs only by email PDF or through a supplier portal later

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Approved supplier list enforced in the system | Meets ISO 9001 supplier control; blocks accidental orders from unqualified suppliers | Setup and annual review of every supplier's status |
| Lot and expiry captured at receipt | Makes FEFO and supplier-lot traceability work downstream | Slower receiving; relies on suppliers labeling lots clearly |
| Blanket POs for kanban | Fewer POs to approve; fixed prices | Commitments must be tracked against the agreement total |
