# 2. Bill of Materials (BOM)

**Status:** In progress  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Depends on:** [Products & Inventory](01-products-inventory.md)  
**Used by:** [Production Orders](03-production-orders.md), [Kanban & TPS](04-kanban-tps.md), [Purchase Orders](06-purchase-orders.md) (material requirements)

---

## Design principle
A BOM is the recipe for one manufactured product: which components go into it, in what quantity, and with how much expected loss. Each product with `canManufacture` on has one or more BOM **versions**, exactly one of which is **active** at any time. Production orders copy the active version when they are created, so later BOM edits never change an order already in progress.

BOMs describe **what** goes into a product. **How** it is made (operations, machines, times) lives in the routing on the [Production Orders](03-production-orders.md) module.

## Features
- One BOM per manufactured product, with a numeric per-tenant id (e.g. `ATC-12`)
- Versioning with effective dates and a single active version per product
- Multi-level BOMs: a component can itself be a manufactured item with its own BOM (e.g. a gasket set made from individual gaskets)
- Scrap allowance per component line, so material requirements include expected loss
- BOM explosion: total raw material requirement for any production quantity, across all levels
- Where-used lookup: every BOM that consumes a given component
- Cost roll-up: estimated unit cost from component costs, for quoting and standard cost setting
- Component names, units, and costs pulled live from the product master; nothing re-typed

## BOM types (`bomType`)

| Value | Definition | When to use |
|---|---|---|
| `production` | The standard recipe used to make the product in the plant | Default for all manufactured items |
| `kit` | A set of existing items grouped for sale or shipment without a production step | Gasket sets packed from finished single gaskets with no pressing or vulcanizing. Picking a kit issues the components directly |
| `engineering` | A draft or proposed recipe that cannot be used on production orders | New product development and customer samples, before the recipe is approved |

## BOM version status (`status`)

| Value | Definition | When to use |
|---|---|---|
| `draft` | Being written or edited; not usable | New BOMs and new versions while engineering works on them |
| `active` | The version production orders use | Exactly one per product. Activating a version automatically moves the previous active version to `superseded` |
| `superseded` | Replaced by a newer version; kept read-only for history | Set automatically. Existing production orders keep their copied lines |
| `obsolete` | Withdrawn and not to be reactivated | Product discontinued, or a version found to be wrong |

## Component line fields

| Field | Definition | When to use |
|---|---|---|
| `componentId` | The product consumed | Every line. Must be an item with `isStocked` on, or a `consumable` with `isStocked` off (expensed, not issued) |
| `quantity` | Amount of the component per `baseQuantity` of the parent, in the component's `uom` | Every line |
| `scrapPercent` | Expected loss on this component during production, as a percentage | Materials with trim or flash loss, such as rubber sheet cut into gaskets. Leave 0 for purchased parts that are used whole |
| `lineType` | `material`, `phantom`, or `by_product` (see below) | Every line; defaults to `material` |
| `operationSeq` | The routing step at which the component is consumed | When components are added at different steps (e.g. adhesive at bonding, not at cutting). Lets issue happen per operation instead of all at start |
| `isOptional` | Component may be omitted by the planner on a given order | Customer-specific options such as an extra coating |

**`baseQuantity`** on the BOM header — the parent quantity the component quantities refer to. Use 1 for assembled items; use a batch quantity (e.g. 1,000 pcs) when per-unit quantities would be very small, such as grams of rubber per gasket.

### Line types (`lineType`)

| Value | Definition | When to use |
|---|---|---|
| `material` | A component issued from stock and consumed | Default for all normal inputs |
| `phantom` | A sub-assembly that is never stocked; its own BOM lines are exploded straight into the parent | Intermediate items built and used immediately on the same line, so no WIP lot or stock movement is created for them |
| `by_product` | A secondary output produced alongside the main product; `quantity` is the amount produced, not consumed | Reusable rubber trim that goes back into stock. On completion it posts its own `production_output` entry and lot |

## Business rules
- Only products with `canManufacture` on can have a production or engineering BOM
- A BOM cannot contain its own parent, directly or through lower levels (circular reference check on save)
- A component's unit of measure is fixed to its product `uom`; conversions are not allowed on BOM lines
- Only `active` versions can be selected on production orders; `kit` BOMs are selectable on sales picking
- An active version cannot be edited. Changes are made by copying it to a new `draft` version
- Activating a version requires every component to exist, be non-deleted, and not be `obsolete`

## BOM explosion
For a production quantity *Q*:
1. Required quantity per line = *Q* ÷ `baseQuantity` × `quantity` × (1 + `scrapPercent` ÷ 100)
2. For each component that is itself manufactured, repeat with its own active BOM; `phantom` lines are always exploded
3. Sum requirements by component across all levels
4. Compare with available stock (`onHand` − `reserved`) to show shortages

The explosion result is used by production order material reservation, MRP-style purchase suggestions, and the cost roll-up.

## Cost roll-up
Estimated unit cost = sum of (component required quantity × component unit cost) + routing labor and overhead (from the production order routing) ÷ parent quantity. Component unit cost comes from `costingMethod`: current moving average, or `standardCost` when standard costing is used. The rolled-up figure can be written to the parent's `standardCost` by a manager.

## Screens
- **BOM list** (desktop): filter by product, type, status
- **BOM editor** (desktop): header, component lines with live stock and cost, version history, activate / copy to new version
- **Explosion view** (desktop): enter a quantity, see multi-level requirements and shortages
- **Where-used** (desktop): from any product detail, list BOMs using it
- **Cost roll-up** (desktop): cost breakdown by level and component

## Data model sketch (Prisma)
```prisma
model Bom {
  tenantKey     String
  id            Int
  productId     Int                     // parent, must have canManufacture
  version       Int                     // 1, 2, 3 … per product
  bomType       String   @default("production") // production | kit | engineering
  status        String   @default("draft")      // draft | active | superseded | obsolete
  baseQuantity  Decimal  @default(1)
  effectiveFrom DateTime?
  notes         String?
  createdById   Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  lines         BomLine[]
  @@id([tenantKey, id])
  @@unique([tenantKey, productId, version])
  @@index([tenantKey, productId, status])
}

model BomLine {
  tenantKey     String
  id            Int
  bomId         Int
  lineNo        Int
  componentId   Int
  quantity      Decimal
  scrapPercent  Decimal  @default(0)
  lineType      String   @default("material") // material | phantom | by_product
  operationSeq  Int?
  isOptional    Boolean  @default(false)
  bom           Bom      @relation(fields: [tenantKey, bomId], references: [tenantKey, id])
  @@id([tenantKey, id])
  @@index([tenantKey, componentId])        // where-used
}
```
A partial unique index in SQL enforces one `active` BOM per product: `UNIQUE (tenant_key, product_id) WHERE status = 'active'`.

## Integration points
| Module | Interaction |
|---|---|
| Products & Inventory | Components and units come from the product master; where-used shown on product detail |
| Production Orders | Active version copied to the order's material lines on creation; `operationSeq` drives issue timing |
| Kanban & TPS | Explosion sizes component kanban loops from finished-good demand |
| Purchase Orders | Shortages from explosion become suggested purchase quantities |
| Sales Orders | `kit` BOMs expand into component picks at shipment |
| Quality | BOM versions are controlled records; activation is logged for ISO 9001 change control |

## Open decisions
- Whether BOM activation needs an approval step (engineering → quality) or is a single manager action
- Whether customer-specific BOM variants are handled by `isOptional` lines or by separate products per customer part number

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Versioning with copy-on-order | Production history stays accurate; supports ISO 9001 change control | More records; users must understand draft vs. active |
| Scrap percentage per line | Material requirements and costs reflect real rubber loss | Needs periodic review against actual scrap from production data |
| Phantom lines | Avoids WIP stock movements for items made and used immediately | Traceability for the phantom level is carried only through the parent lot |
