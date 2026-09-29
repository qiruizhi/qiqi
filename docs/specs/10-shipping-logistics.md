# 10. Shipping & Logistics

**Status:** Planned  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Depends on:** [Sales Orders](05-sales-orders.md), [Products & Inventory](01-products-inventory.md), [Purchase Orders](06-purchase-orders.md) (inbound)  
**Used by:** [Invoicing](07-invoicing.md), [Quality](08-quality.md)

---

## Design principle
A **shipment** is the physical dispatch of goods to a customer. It is built from open sales order lines, picked by lot according to FEFO/FIFO, packed into cartons and pallets, labeled to the customer's requirements, and posted. Posting the shipment is the single point where stock leaves (`shipment` entries), the sales order's shipped quantities update, and the lines become invoiceable. Inbound logistics uses expected receipts from purchase orders to plan the receiving dock.

## Features
- Shipments created from one or more open sales order lines for the same customer and address
- Pick lists with suggested lots (FEFO/FIFO) and mobile scan-to-pick
- Packing into cartons and pallets, with lot numbers on every shipment line
- Configurable label templates per customer (part number, lot, quantity, barcode) for OEM requirements
- Packing list, delivery note, CoC, and export documents
- Carrier assignment, tracking numbers, estimated vs. actual delivery dates
- Proof of delivery linked back to the sales order for AR and dispute resolution
- Inbound: expected supplier deliveries matched to open POs, with dock scheduling

## Shipment lifecycle (`status`)

| Status | Definition | Allowed next | What happens |
|---|---|---|---|
| `draft` | Lines selected; editable | `picking`, `cancelled` | Quantities default to open order quantities |
| `picking` | Pick list released to the warehouse | `packed`, `cancelled` | Lots suggested; picked stock moved to the `shipping` location with `transfer` entries |
| `packed` | All lines picked and packed; labels printed | `shipped`, `picking` | Package weights and counts recorded |
| `shipped` | Left the building | `delivered` | `shipment` entries posted from `shipping`; sales order `shippedQty` updated; invoice can be created |
| `delivered` | Proof of delivery received | — | Actual delivery date recorded |
| `cancelled` | Stopped before dispatch | — | Picked stock returned to storage with `transfer` entries |

Once `shipped`, a shipment cannot be edited. Errors are corrected with a customer return.

## Picking
- Suggested lots follow the product's `pickingRule`; only `available` lots in `storage` locations are offered
- Picker scans location, lot, and quantity; a different lot from the suggestion requires a `reasonCode`
- Customers can have a **minimum remaining shelf life** (`minShelfLifeDays`); lots expiring sooner are excluded for that customer
- Short picks leave the order line open for a later shipment

## Packages (`packageType`)

| Value | Definition | When to use |
|---|---|---|
| `carton` | A box of product | Standard packing unit; usually one product and one lot per carton for traceability |
| `pallet` | A pallet holding cartons | Full-truck and export shipments; pallet label lists all cartons |
| `bag` | Poly bag inside a carton | Small gaskets counted into bags of a standard quantity |
| `returnable` | Customer-owned returnable container | OEM customers who supply their own bins; the container id is recorded |

Packages can be nested (bags in cartons, cartons on pallets). Each package gets a full id printed on its label so scanning a pallet shows everything on it.

## Label templates
A label template defines the label size and fields printed. Templates are assigned per customer (default on the customer, overridable per customer item).

### Label level (`labelLevel`)

| Value | Definition | When to use |
|---|---|---|
| `part` | Label on the product or bag | Customers requiring part-level identification |
| `carton` | Label on each carton | Default for all customers |
| `pallet` | Label on each pallet, summarizing contents | Pallet shipments; required by most OEM receiving docks |

### Available fields
Customer part number, customer part name, ATC product full id, lot full id, supplier lot (where required), quantity and unit, production date, expiry date, customer PO number, shipment full id, package count (e.g. 3 of 12), gross and net weight, country of origin, and barcode or QR code encoding a configurable combination of these. Templates are rendered as PDF for thermal label printers (e.g. 100 × 150 mm).

## Carriers and shipping method

### Shipping method (`shippingMethod`)

| Value | Definition | When to use |
|---|---|---|
| `own_truck` | ATC's own vehicle | Local deliveries in central Taiwan |
| `courier` | Parcel or express service with tracking numbers | Samples and small urgent orders |
| `freight` | Trucking company or freight forwarder | Full-pallet domestic shipments and exports |
| `customer_pickup` | Customer collects from ATC | Customers who arrange their own transport; proof of delivery is the pickup signature |

Carrier master data: name, shipping methods offered, tracking URL pattern (so tracking numbers become links).

### Incoterms (`incoterm`, export shipments)

| Value | Definition | When to use |
|---|---|---|
| `EXW` | Customer takes over at ATC's premises and handles all transport and export | Customers with their own forwarders |
| `FCA` | ATC delivers, export-cleared, to the customer's carrier at a named place | Common for containerized exports where the buyer nominates the forwarder |
| `FOB` | ATC delivers goods on board the vessel at the named port (e.g. Taichung Port) | Sea freight where the buyer arranges the vessel |
| `CIF` | ATC pays freight and insurance to the destination port | Customers who want a delivered price at their port |
| `DAP` | ATC delivers to the customer's named place, not unloaded; buyer pays import duties | Delivered sales where the customer handles import clearance |
| `DDP` | ATC delivers with all duties paid | Rare; only when agreed, since ATC takes import risk |

The incoterm is recorded on the sales order and copied to the shipment; it appears on the commercial invoice and decides who pays freight.

## Shipping documents
| Document | Definition | When produced |
|---|---|---|
| Packing list | Packages, contents, lots, weights | Every shipment |
| Delivery note | Goods and quantities for the customer to sign | Every domestic shipment; the signed copy is proof of delivery |
| Certificate of conformance | Lots and inspection results (see [Quality](08-quality.md)) | Customers with `requiresCoC` |
| Commercial invoice | Customs value document for export | Export shipments |

## Proof of delivery
Recorded as a signed delivery note photo, a courier tracking "delivered" status, or a customer pickup signature. The proof is attached to the shipment and visible from the sales order and invoice for disputes.

## Inbound logistics
- **Expected receipts:** open PO lines by expected date, with supplier shipping notices and tracking numbers where provided
- **Dock appointments:** receiving slots per day; status `scheduled`, `arrived`, `unloading`, `done`, `no_show`
- Arrivals link directly to the goods receipt screen in [Purchase Orders](06-purchase-orders.md)

## Screens
- **Shipment planning** (desktop): open order lines by due date and customer, create shipments
- **Pick list** (mobile-first): scan location, lot, quantity
- **Packing** (tablet or desktop): build cartons and pallets, print labels
- **Shipment detail** (desktop): documents, tracking, proof of delivery
- **Label template editor** (desktop), with preview
- **Dock schedule** (desktop)

## Data model sketch (Prisma)
```prisma
model Shipment {
  tenantKey        String
  id               Int
  customerId       Int
  shipToSnapshot   Json
  status           String   @default("draft")
  shippingMethod   String   // own_truck | courier | freight | customer_pickup
  carrierId        Int?
  trackingNo       String?
  incoterm         String?
  plannedShipDate  DateTime?
  shippedAt        DateTime?
  estimatedDelivery DateTime?
  deliveredAt      DateTime?
  podFileUrl       String?
  grossWeightKg    Decimal?
  createdById      Int
  createdAt        DateTime @default(now())
  lines            ShipmentLine[]
  @@id([tenantKey, id])
  @@index([tenantKey, status])
}

model ShipmentLine {
  tenantKey      String
  id             Int
  shipmentId     Int
  salesOrderLineId Int
  productId      Int
  lotId          Int
  quantity       Decimal
  packageId      Int?
  shipment       Shipment @relation(fields: [tenantKey, shipmentId], references: [tenantKey, id])
  @@id([tenantKey, id])
  @@index([tenantKey, lotId])
}

model Package {
  tenantKey       String
  id              Int              // full id printed on label
  shipmentId      Int
  parentPackageId Int?             // nesting
  packageType     String           // carton | pallet | bag | returnable
  containerRef    String?          // customer's returnable container id
  grossWeightKg   Decimal?
  @@id([tenantKey, id])
}

model LabelTemplate {
  tenantKey  String
  id         Int
  name       String
  labelLevel String   // part | carton | pallet
  widthMm    Int
  heightMm   Int
  layout     Json     // fields, positions, barcode content
  @@id([tenantKey, id])
}

model Carrier {
  tenantKey          String
  id                 Int
  name               String
  trackingUrlPattern String?
  @@id([tenantKey, id])
}

model DockAppointment {
  tenantKey    String
  id           Int
  poId         Int
  scheduledAt  DateTime
  status       String @default("scheduled") // scheduled | arrived | unloading | done | no_show
  @@id([tenantKey, id])
}
```
`Customer` gains `minShelfLifeDays Int?`.

## Integration points
| Module | Interaction |
|---|---|
| Sales Orders | Shipments built from open lines; posting updates `shippedQty` and order status |
| Products & Inventory | Picks post `transfer` entries; dispatch posts `shipment` entries by lot |
| Invoicing | Shipped lines are the source of AR invoice lines; proof of delivery supports collections |
| Quality | CoC per shipment; complaints trace back through shipment lines and lots |
| Purchase Orders | Expected receipts and dock appointments lead into goods receipt |
| Reporting | On-time delivery, fill rate, shipments by carrier |

## Open decisions
- Which label printers ATC uses and each OEM customer's label specification
- Whether to integrate with Taiwanese courier APIs for tracking or record tracking numbers manually
- Whether mixed-lot cartons are allowed for any customer

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Posting stock only at dispatch | Stock, sales order, and invoice stay in step at one clear moment | Picked stock sits in the `shipping` location until the truck leaves; late posting shows it as still on hand |
| Label templates per customer | Meets OEM dock requirements without separate label software | Each OEM specification must be set up and tested |
| One lot per carton | Simpler traceability and recalls | More cartons and partial cartons |
