# 1. Products & Inventory

**Status:** In progress (redesign planned for the Postgres migration)  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Used by:** every other module

---

## Design principle
One **product master** holds every item the company buys, makes, stores, or sells. Items are separated by **type**, **capability flags**, **accounting class**, and **storage location** — not by separate tables. Stock quantities live in a **stock balance table** keyed by product + lot + location, derived from an append-only **stock ledger**.

This replaces the earlier "Product IS inventory" rule. `Product` remains the single item master; `Product.stockQuantity` is kept only as a cached total for the UI.

## Item types (`itemType`)
Set once when the product is created. The type drives default flags, default locations, the inventory account, and valuation. Changing it later requires a zero stock balance.

| Value | Definition | When to use | Example full id | Default flags | Valuation |
|---|---|---|---|---|---|
| `finished_good` | A completed product ready to ship to a customer | Anything that passes final inspection and is sold: individual gaskets, boxed gasket sets | `ATC-1` | `canSell`, `canManufacture` | Rolled-up production cost |
| `raw_material` | A purchased input that becomes part of the finished product | Rubber compounds, metal stampings, adhesives — anything that appears as a line on a BOM and is bought from a supplier | `ATC-2` | `canPurchase` | Purchase cost |
| `consumable` | A purchased item used up in production or operations but not part of the product | Release agents, cleaning solvent, packaging, gloves, labels | `ATC-3` | `canPurchase` | Purchase cost; usually expensed on receipt (`isStocked` off) unless it needs stock control |
| `spare` | A replacement part for machines, molds, or tooling | Heater elements, mold inserts, press seals — items maintenance keeps on hand | `ATC-4` | `canPurchase` | Purchase cost |
| `wip` | A partly finished item that is stocked between production steps | Vulcanized but uninspected gaskets, sub-assemblies waiting to be kitted into a set. Use only when the item is physically stored or counted between steps; if it moves straight to the next operation, track it on the production order instead | `ATC-5` | `canManufacture` | Accumulated production cost |

## Capability flags
Each product carries independent flags, defaulted from its type and overridable per item. Flags handle dual-role items without duplicating the record.

| Flag | Definition | When to turn on |
|---|---|---|
| `canPurchase` | The item can appear on purchase orders and goods receipts | Anything bought from a supplier, including finished goods bought for resale |
| `canSell` | The item can appear on quotes, sales orders, and invoices | Anything sold to a customer. Turn on for a raw material or component that is also sold as an aftermarket spare |
| `canManufacture` | The item can be the output of a BOM and a production order | Anything the plant makes, including WIP and sub-assemblies |
| `isStocked` | Quantities are tracked in the stock ledger and balances | On for nearly everything. Turn off for services (e.g. outsourced plating billed per job) and low-value consumables expensed on receipt |

## Tracking and shelf-life settings (per product)

**`trackingMode`** — how individual units are identified in stock.

| Value | Definition | When to use |
|---|---|---|
| `none` | Stock is tracked as a single quantity per location, with no lot or serial | Low-value, non-critical items where traceability adds no value: gloves, cleaning supplies, generic packaging |
| `lot` | Units received or produced together share a lot id; every movement records the lot | Default for ATC. Required for raw materials, WIP, and finished goods, since ISO 9001 and OEM customers expect trace from supplier lot to customer shipment |
| `serial` | Every single unit has its own id | High-value individual units that need unit-level history, such as molds or tooling tracked as spares. Rarely needed for gaskets |

**`hasShelfLife`** (`true | false`) and **`shelfLifeDays`** (integer)
- **Definition:** whether the item expires, and how many days after the start date it expires. The expiry date is calculated at goods receipt (purchased items) or at production output (manufactured items) and stored on the lot.
- **When to use:** turn on for rubber compounds, adhesives, and any material whose properties degrade over time. Requires `trackingMode` = `lot` or `serial`, since expiry is stored per lot.

**`pickingRule`** — the order in which lots are suggested when stock is issued or picked.

| Value | Definition | When to use |
|---|---|---|
| `FEFO` | First Expired, First Out — the lot with the earliest expiry date is suggested first | Required when `hasShelfLife` is true. Prevents older material from expiring on the shelf while newer lots are used |
| `FIFO` | First In, First Out — the lot with the earliest received or produced date is suggested first | Default for items without expiry. Keeps stock rotating and makes costing and traceability easier to follow |

**Units of measure**
- `uom` — the unit stock is held and issued in (e.g. `g`, `kg`, `pcs`, `m`). Choose the smallest unit production actually uses, since BOM quantities are expressed in it.
- `purchaseUom` and `purchaseUomFactor` — the unit the supplier sells in, and how many stock units it equals. Use when the buying unit differs from the stock unit, e.g. rubber bought in 25 kg drums (`purchaseUom` = `drum`, factor = `25000` when `uom` = `g`). Leave empty when they are the same.

## Planning settings (per product, optionally per location)

| Field | Definition | When to use |
|---|---|---|
| `safetyStock` | Buffer quantity kept to cover demand spikes or late deliveries; not planned for normal use | Items with unreliable supplier lead times or where a stockout stops the line (key rubber compounds) |
| `reorderPoint` | Stock level that triggers a replenishment alert or suggested PO / production order. Usually = expected usage during lead time + safety stock | All stocked items that are replenished regularly |
| `minStockLevel` | Lowest acceptable on-hand quantity; falling below it raises an alert | Items where you want a hard warning separate from the reorder trigger |
| `maxStockLevel` | Upper limit; suggested order quantities won't exceed it | Items with limited storage space, short shelf life, or high carrying cost |
| `leadTimeDays` | Days from order to availability: supplier lead time for purchased items, production lead time for manufactured items | All replenished items; drives reorder point and MRP timing |
| Default supplier | The supplier pre-filled on purchase orders | Purchased items with a primary source |

Under the [Kanban & TPS](04-kanban-tps.md) module, reorder point and max stock level can be replaced by kanban card quantities for pull-controlled items.

## Accounting class (per type, overridable per product)

**How it works.** Every stock movement either moves value between inventory accounts or moves it out of inventory into COGS or another expense account. The accounting class on each product tells the system which accounts to use, so operational screens (receipts, production, shipments) can be turned into journal entries without an accountant coding each transaction.

- **Inventory account (balance sheet)** — holds the value of stock the company still owns. Purchased and produced goods are assets until they are sold or written off. Each item type points to its own inventory account, so the balance sheet shows how much value sits in raw materials, partly made goods, and finished goods. The balance of each inventory account should always equal the value of the matching stock in `StockBalance` (quantity × unit cost).
- **COGS account (income statement)** — records the cost of goods as an expense at the moment they are sold. Recording cost at sale, rather than at purchase, matches each sale with its cost in the same period. Revenue − COGS = gross profit. Needed for anything with `canSell` on.
- **Variance account** — records the difference between standard and actual cost. Needed only once standard costing is introduced.

Defaults come from `itemType`. The per-product override covers exceptions, such as finished gaskets bought from another supplier for resale, which can use Merchandise Inventory and COGS – Merchandise so resale margin is reported separately from manufacturing margin.

**Worked example — value flow through production**

100 kg of rubber at NT$200/kg, made into 1,000 gaskets, 600 sold at NT$50 each.

| Step | Stock movement | Debit | Credit | Amount (NT$) |
|---|---|---|---|---|
| 1. Receive rubber | `receipt` | Raw Materials Inventory | Goods Received Not Invoiced | 20,000 |
| 2. Supplier invoice arrives | (AP invoice) | Goods Received Not Invoiced | Accounts Payable | 20,000 |
| 3. Issue rubber to production | `issue_to_production` | WIP Inventory | Raw Materials Inventory | 20,000 |
| 4. Absorb labor and machine cost | (production order) | WIP Inventory | Applied Labor / Applied Overhead | 10,000 |
| 5. Complete 1,000 gaskets | `production_output` | Finished Goods Inventory | WIP Inventory | 30,000 |
| 6. Ship 600 gaskets | `shipment` | COGS – Manufactured | Finished Goods Inventory | 18,000 |
| 7. Invoice the customer | (AR invoice) | Accounts Receivable | Sales Revenue | 30,000 |

After step 7, Finished Goods Inventory holds NT$12,000 for the 400 unsold gaskets, and gross profit on the shipped goods is NT$12,000 (30,000 − 18,000). The purchase never touched the income statement; it sat in inventory until the goods were sold.

**Posting rules by movement type**

| Movement | Debit | Credit | Notes |
|---|---|---|---|
| `receipt` | Item's inventory account | Goods Received Not Invoiced | At PO price. Price differences on the supplier invoice go to Purchase Price Variance (standard costing) or adjust inventory value (moving average) |
| `issue_to_production` | WIP Inventory | Item's inventory account | At current unit cost |
| `production_output` | Output item's inventory account | WIP Inventory | At accumulated production cost |
| `transfer` | — | — | No posting; value stays in the same account |
| `adjustment` (increase) | Item's inventory account | Inventory Adjustment | Requires `reasonCode` |
| `adjustment` (decrease) | Inventory Adjustment | Item's inventory account | Requires `reasonCode` |
| `scrap` | Scrap Expense | Item's inventory account | Kept out of COGS so defect cost stays visible for kaizen |
| `shipment` | Item's COGS account | Item's inventory account | At current unit cost |
| `return` (from customer) | Item's inventory account | Item's COGS account | At the cost of the original shipment; the credit note posts Sales Returns separately |
| `return` (to supplier) | Accounts Payable / GRNI | Item's inventory account | At original receipt cost |
| Receipt of item with `isStocked` off | Consumables Expense | Goods Received Not Invoiced | Skips inventory entirely |

The unit cost used in each posting comes from `costingMethod`. Under moving average, a later rubber delivery at NT$220/kg moves the average to about NT$210/kg, and later issues post at that rate. Under standard costing, movements post at `standardCost` and the gap to actual cost goes to a variance account.

**`costingMethod`** — how the unit cost of stock is calculated.

| Value | Definition | When to use |
|---|---|---|
| `moving_average` | Unit cost is recalculated as a weighted average each time stock is received or produced | MVP default for all items. Simple, needs no cost setup, and smooths out supplier price changes |
| `standard` | Each item has a fixed planned cost (`standardCost`); differences from actual cost go to the variance account | Later phase, once BOMs and routings are stable. Useful for finished goods where management wants to see production cost variances |

**Chart of accounts (inventory-related)**

Each tenant gets this default set, which it can rename or map to its existing account numbers.

| Account | Type | Definition | When to use |
|---|---|---|---|
| Raw Materials Inventory | Asset | Value of purchased inputs that become part of the product | Default inventory account for `raw_material` |
| WIP Inventory | Asset | Value of materials, labor, and overhead in production that is not yet finished | Default for `wip` items, and the holding account for all open production orders |
| Finished Goods Inventory | Asset | Value of completed products the company made and has not yet sold | Default for `finished_good` |
| Merchandise Inventory | Asset | Value of finished products bought ready-made for resale | Override for resale items, so resale and manufacturing margins can be reported apart |
| Consumables Inventory | Asset | Value of stocked supplies used in production but not part of the product | `consumable` items with `isStocked` on |
| Spares Inventory | Asset | Value of machine, mold, and tooling spare parts on hand | Default for `spare` |
| Goods Received Not Invoiced (GRNI) | Liability | Temporary account for goods received before the supplier invoice arrives | Credited at every `receipt`; cleared when the supplier invoice is matched. A balance left open signals unmatched receipts |
| Accounts Payable | Liability | Amounts owed to suppliers | Credited when a supplier invoice is approved |
| Accounts Receivable | Asset | Amounts owed by customers | Debited when a customer invoice is issued |
| Sales Revenue | Income | Income from selling goods | Credited on customer invoices |
| Sales Returns | Contra-income | Reduction in revenue for goods returned by customers | Debited on customer credit notes |
| COGS – Manufactured | Expense | Cost of the company's own products that were sold | Default COGS account for `finished_good` |
| COGS – Merchandise | Expense | Cost of resale products that were sold | Paired with Merchandise Inventory |
| Applied Labor | Expense (contra) | Offsets labor cost charged into WIP from production orders | Credited when labor cost is absorbed into production. Compared with actual payroll to see under- or over-absorption |
| Applied Overhead | Expense (contra) | Offsets machine and plant overhead charged into WIP | Credited when overhead is absorbed into production, at a set rate per machine hour or per unit |
| Scrap Expense | Expense | Cost of stock written off as unusable | Every `scrap` movement, including expired lots |
| Inventory Adjustment | Expense | Gains and losses from stock count differences | Every `adjustment` movement |
| Consumables Expense | Expense | Cost of supplies expensed on receipt without stock control | Receipts of items with `isStocked` off |
| Purchase Price Variance | Expense | Difference between standard cost and actual purchase price | Standard costing only; posted when the supplier invoice price differs from standard |
| Production Variance | Expense | Difference between standard and actual production cost | Standard costing only; posted when a production order closes |

**Posting approach — open decision**

| Option | What it means | Benefit | Cost |
|---|---|---|---|
| A. Export for the accountant (MVP) | Every ledger row already stores unit cost; the ERP produces monthly inventory movement, valuation, and COGS summaries by account for ATC's accountant to post in their existing accounting system | No general ledger module needed; fits ATC's current accounting process; accounts above are used as report groupings only | Inventory value in the books is updated monthly instead of in real time; reconciliation is manual |
| B. Automatic posting | Each movement and invoice generates a journal entry using the rules above | Real-time inventory and COGS; faster month-end close; automatic reconciliation against `StockBalance` | Requires a general ledger module, a chart of accounts per tenant, an overhead absorption rate, and a period-close process |

## Locations
- Hierarchy: **Warehouse → Location** (e.g. Main Plant → Raw Material Store, Production Floor, QC Hold, Finished Goods Store, Shipping Dock)
- Default locations per item type, so receipts land in Receiving or the Raw Material Store and completed production lands in QC Hold

**`locationType`** — what the location is used for. The type controls which movements can start or end there.

| Value | Definition | When to use |
|---|---|---|
| `receiving` | Where supplier deliveries land before put-away or incoming inspection | Dock or staging area for goods receipts |
| `storage` | General storage for available stock | Raw material store, finished goods store, spares cabinet |
| `production` | Stock issued to the floor and held at machines or lines | Line-side stock and WIP between operations |
| `qc_hold` | Stock awaiting inspection; cannot be picked or shipped | Incoming inspection area and final inspection area. Newly produced lots land here until they pass |
| `shipping` | Picked stock staged for dispatch | Packing and shipping dock |
| `scrap` | Stock written off as unusable | Scrap bin or rejected-material cage. Moving stock here posts a `scrap` entry |

## Lots
- Lot record per product: numeric lot id (full id used as the lot number on labels), supplier lot number, received or produced date, expiry date, status
- Expired lots move to `expired` automatically via a scheduled job
- Genealogy links: which input lots were consumed into which output lot, enabling forward trace (supplier lot → customer shipment) and backward trace (customer complaint → supplier lot)

**Lot `status`** — only `available`, unexpired lots can be issued, picked, or shipped.

| Value | Definition | When to use |
|---|---|---|
| `available` | Usable stock | Default once a lot passes any required inspection |
| `quarantine` | Blocked pending inspection or investigation | Set automatically on receipt for items needing incoming inspection, or manually when a defect is suspected. Released to `available` or moved to scrap after QC decision |
| `on_hold` | Blocked for a non-quality reason | Customer-reserved stock, disputed deliveries, stock-count discrepancies under review |
| `expired` | Past its expiry date | Set by the scheduled job; can only be scrapped, or returned to `available` with a documented QC re-test and new expiry |
| `consumed` | Fully used or shipped; balance is zero | Set automatically when the last quantity leaves; kept for traceability |

## Stock ledger (`StockEntry`)
Every quantity change is an immutable ledger row. No direct edits to balances. Each row records product, lot, from-location, to-location, quantity, unit cost, reference document, user, and timestamp. Corrections are made with a reversing entry (`reversesId`), preserving the ISO 9001 audit trail.

**`movementType`**

| Value | Definition | When to use |
|---|---|---|
| `receipt` | Stock enters from a supplier | Goods receipt against a purchase order |
| `issue_to_production` | Materials leave stock and are consumed by a production order | Kitting or line-side issue when a production order starts or during the run |
| `production_output` | Finished goods or WIP enter stock from a production order | Reporting completed quantity; creates the output lot |
| `transfer` | Stock moves between locations with no change in total | Put-away, moving stock to line-side, releasing from QC hold to storage |
| `adjustment` | Quantity corrected up or down with no source document | Cycle count variances, found or lost stock. Requires a reason code |
| `scrap` | Stock written off as unusable | Failed inspection, damage, expired material |
| `shipment` | Stock leaves to a customer | Dispatch against a sales order |
| `return` | Stock comes back in, or goes back to a supplier | Customer returns (usually into `qc_hold`) and returns to supplier |

**`referenceType`** — the document that caused the movement: `purchase_order`, `production_order`, `sales_order`, `shipment`, or `stock_count`. Empty only for manual adjustments, which must carry a `reasonCode` instead.

**`reasonCode`** — a short code explaining a manual action (e.g. `count_variance`, `damaged`, `found`, `fefo_override`). Required on adjustments, scrap, and any FEFO/FIFO override.

## Stock balance (`StockBalance`)
- One row per product + lot + location, updated in the same database transaction as the ledger entry
- `onHand` — physical quantity at the location
- `reserved` — quantity promised to a confirmed sales order or scheduled production order but not yet moved
- Available = `onHand` − `reserved`
- Reservations are released on cancel or fulfilment

## Picking logic
- Issue to production and sales picking suggest lots according to the product's `pickingRule`
- Users can override the suggestion with a `reasonCode`, which is logged
- Lots with status `quarantine`, `on_hold`, or `expired`, and stock in `qc_hold` or `scrap` locations, are excluded

## Screens
- **Product list** (desktop): filter by type, flags, stock status (below reorder point, expiring soon)
- **Product detail** (desktop): master data, flags, tracking, planning, accounting tabs; stock by location and lot; movement history; where-used in BOMs
- **Lot detail**: status, expiry, balances by location, genealogy trace view
- **Stock movements** (mobile-first): scan product/lot barcode → pick location → enter quantity
- **Stock count / cycle count** (mobile-first): count by location, system posts adjustments for variances
- **Alerts**: below reorder point, lots expiring within N days, negative stock attempts

## Data model sketch (Prisma)
Every business table uses the composite primary key `(tenantKey, id)`, where `id` is a per-tenant, per-entity integer sequence. Foreign keys are composite as well, so a row can only reference rows in its own tenant.

```prisma
model Tenant {
  tenantKey  String   @id              // short, unique, immutable, e.g. "ATC"
  name       String
  createdAt  DateTime @default(now())
}

model IdCounter {
  tenantKey  String
  entity     String                    // product | sales_order | purchase_order | invoice | production_order | bom | lot | warehouse | location | stock_entry …
  nextValue  Int      @default(1)
  @@id([tenantKey, entity])
}

model Product {
  tenantKey       String
  id              Int                       // per-tenant sequence; full id ATC-1
  name            String
  itemType        String                    // finished_good | raw_material | consumable | spare | wip
  uom             String
  purchaseUom     String?
  purchaseUomFactor Decimal?
  canPurchase     Boolean  @default(false)
  canSell         Boolean  @default(false)
  canManufacture  Boolean  @default(false)
  isStocked       Boolean  @default(true)
  trackingMode    String   @default("lot")  // none | lot | serial
  hasShelfLife    Boolean  @default(false)
  shelfLifeDays   Int?
  pickingRule     String   @default("FIFO") // FEFO | FIFO
  requiresIncomingInspection Boolean @default(false) // see Quality and Purchase Orders
  safetyStock     Decimal  @default(0)
  reorderPoint    Decimal  @default(0)
  minStockLevel   Decimal  @default(0)
  maxStockLevel   Decimal?
  leadTimeDays    Int?
  costingMethod   String   @default("moving_average")
  standardCost    Int?                      // minor currency units
  inventoryAccountId Int?
  cogsAccountId   Int?
  stockQuantity   Decimal  @default(0)      // cached total, derived from StockBalance
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  lots            Lot[]
  balances        StockBalance[]
  entries         StockEntry[]
  @@id([tenantKey, id])
  @@index([tenantKey, itemType])
}

model Warehouse {
  tenantKey  String
  id         Int
  name       String
  locations  Location[]
  @@id([tenantKey, id])
}

model Location {
  tenantKey    String
  id           Int
  warehouseId  Int
  name         String
  locationType String   // storage | production | qc_hold | shipping | receiving | scrap
  warehouse    Warehouse @relation(fields: [tenantKey, warehouseId], references: [tenantKey, id])
  @@id([tenantKey, id])
  @@index([tenantKey, warehouseId])
}

model Lot {
  tenantKey      String
  id             Int                          // the lot number; full id ATC-1 printed on labels
  productId      Int
  supplierLotNo  String?                      // external reference, kept as supplied
  receivedAt     DateTime?
  producedAt     DateTime?
  expiresAt      DateTime?
  status         String    @default("available") // available | quarantine | on_hold | expired | consumed
  product        Product   @relation(fields: [tenantKey, productId], references: [tenantKey, id])
  @@id([tenantKey, id])
  @@index([tenantKey, productId, expiresAt])
}

model LotGenealogy {
  tenantKey         String
  id                Int
  inputLotId        Int
  outputLotId       Int
  productionOrderId Int
  quantity          Decimal
  @@id([tenantKey, id])
  @@index([tenantKey, inputLotId])
  @@index([tenantKey, outputLotId])
}

model StockBalance {
  tenantKey   String
  id          Int
  productId   Int
  lotId       Int?
  locationId  Int
  onHand      Decimal @default(0)
  reserved    Decimal @default(0)
  product     Product @relation(fields: [tenantKey, productId], references: [tenantKey, id])
  @@id([tenantKey, id])
  @@unique([tenantKey, productId, lotId, locationId])
  @@index([tenantKey, locationId])
}

model StockEntry {
  tenantKey      String
  id             Int
  productId      Int
  lotId          Int?
  fromLocationId Int?
  toLocationId   Int?
  movementType   String   // receipt | issue_to_production | production_output | transfer | adjustment | scrap | shipment | return
  quantity       Decimal
  unitCost       Int?     // minor currency units
  referenceType  String?  // purchase_order | production_order | sales_order | shipment | stock_count
  referenceId    Int?
  reasonCode     String?
  reversesId     Int?
  createdById    Int
  createdAt      DateTime @default(now())
  product        Product  @relation(fields: [tenantKey, productId], references: [tenantKey, id])
  @@id([tenantKey, id])
  @@index([tenantKey, productId, createdAt])
  @@index([tenantKey, lotId])
  @@index([tenantKey, referenceType, referenceId])
}
```
Quantities use `Decimal` because materials are issued by weight; money stays in integer minor units.

## Integration points with other modules
| Module | Inventory effect |
|---|---|
| Purchase Orders | Goods receipt creates lots (or links supplier lots) and `receipt` entries into the receiving or raw material location; shelf-life items get an expiry date |
| Production Orders | Scheduling reserves materials; start issues lots by FEFO (`issue_to_production`); completion creates an output lot (`production_output`) and writes genealogy |
| Quality | Failed inspection moves lots to `quarantine` or `qc_hold`; scrap posts `scrap` entries |
| Sales Orders | Confirmation reserves stock; shipment posts `shipment` entries against specific lots (closes the current "orders don't move inventory" gap) |
| Shipping | Shipment lines carry lot numbers for OEM labels and traceability |
| Invoicing / Finance | Ledger rows with unit cost feed inventory valuation and COGS by accounting class |

## Open decisions
- Posting approach: accounting export vs. automatic posting (see Accounting class above)
- Whether ATC wants labor and overhead absorbed into product cost, and at what rates
- ATC's existing chart of accounts, to map the default accounts onto
- Expiry warning period and whether any customers need a minimum remaining shelf life on delivery

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| One product master with type and flags | Handles dual-role items; one record for BOM, stock, costing, and sales | Screens must filter by flags so users see only relevant items |
| Stock ledger plus balance table per product, lot, and location | Enables FEFO, lot genealogy, multi-location stock, and ISO 9001 traceability | More tables to keep consistent; every movement must update both in one transaction |
| Moving average costing for the MVP | No cost setup needed; works from day one | No cost variance reporting until standard costing is added |

