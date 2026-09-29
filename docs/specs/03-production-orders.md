# 3. Production Orders

**Status:** In progress  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Depends on:** [Products & Inventory](01-products-inventory.md), [Bill of Materials](02-bill-of-materials.md)  
**Used by:** [Quality](08-quality.md), [Workforce](09-workforce.md), [Kanban & TPS](04-kanban-tps.md), [Reporting](11-reporting.md)

---

## Design principle
A production order is an instruction to make a set quantity of one product by a set date. It carries a **copy** of the active BOM (material lines) and the routing (operation lines) at creation, so the order is a fixed record of what was planned. Everything that happens on the floor — materials issued, time spent, good and scrapped quantity, who ran which machine — is recorded against the order's operations. Stock only changes through `StockEntry` rows, never by editing quantities directly.

## Features
- Production orders with a numeric per-tenant id (e.g. `ATC-1042`)
- Work centers and machines as master data
- Routings: ordered operations per product (e.g. cutting → pressing → vulcanizing → trimming → inspection)
- Material lines copied from the active BOM, reserved at scheduling, issued by FEFO/FIFO lot
- Operation-level reporting of good quantity, scrap, rework, run time, and setup time
- Output lot created on completion, with lot genealogy linking input lots to the output lot
- Over-production guard: quantity produced cannot exceed planned quantity by more than 10%
- Yield tracking per operation and per order
- Labor and machine cost absorption into WIP
- Mobile shop floor flow: scan order → scan lot → log quantities → complete operation

## Master data

### Work centers (`WorkCenter`)
A group of machines or workstations that perform the same kind of operation and are scheduled together, such as "Press Line A" or "Vulcanizing Ovens".

| Field | Definition | When to use |
|---|---|---|
| `workCenterType` | `machine`, `manual`, or `inspection` | `machine` for presses and ovens, `manual` for hand trimming and packing, `inspection` for QC stations |
| `capacityHoursPerShift` | Available productive hours per shift | Every work center; used for scheduling load |
| `laborRatePerHour` | Labor cost per operator hour, in minor currency units | Needed for cost absorption |
| `overheadRatePerHour` | Machine and plant overhead per run hour | Needed for cost absorption; agreed with the accountant |
| `locationId` | The production location stock is issued to for this work center | Line-side stock; must be a `production` type location |

### Machines (`Machine`)
An individual machine within a work center. Recorded so operators, runs, and defects can be traced to a specific machine for ISO 9001. Status: `available`, `running`, `down`, `retired`.

### Routings (`Routing`, `RoutingOperation`)
The ordered list of operations to make a product. Each operation has:

| Field | Definition | When to use |
|---|---|---|
| `seq` | Operation order (10, 20, 30 …) | Every operation; gaps of 10 allow inserting steps later |
| `workCenterId` | Where the operation runs | Every operation |
| `setupMinutes` | Fixed time to prepare the machine, regardless of quantity | Mold changes, oven heat-up |
| `runMinutesPerUnit` | Time per unit produced | Every operation; for batch processes use minutes per batch ÷ batch size |
| `isInspectionPoint` | Operation requires a QC inspection record before the next step | Final inspection and any in-process check required by the control plan |
| `isCountPoint` | Operators report quantities at this step | Default true; set false for short steps reported together with the next one |

Routings are versioned in the same way as BOMs (`draft`, `active`, `superseded`, `obsolete`).

## Order types (`orderType`)

| Value | Definition | When to use |
|---|---|---|
| `standard` | Make a product for stock or for a sales order | Default |
| `rework` | Repair or reprocess existing stock that failed inspection | Material comes from a quarantined lot; output returns to the same product under a new lot, linked by genealogy |
| `sample` | Small quantity for customer approval or testing | Uses an `engineering` BOM; output normally goes to QC hold |

## Lifecycle (`status`)

| Status | Definition | Allowed next | What happens |
|---|---|---|---|
| `draft` | Being prepared; editable | `scheduled`, `cancelled` | BOM and routing copied when the product is chosen |
| `scheduled` | Planned for a date and work center | `in_progress`, `on_hold`, `cancelled` | Materials reserved in `StockBalance` |
| `in_progress` | Work has started on the floor | `on_hold`, `completed` | First material issue or operation start sets `actualStart` |
| `on_hold` | Paused (material shortage, machine down, quality issue) | `scheduled`, `in_progress`, `cancelled` | Requires `holdReason`; reservations kept |
| `completed` | Final operation reported; order closed for reporting | — | Remaining reservations released; WIP balance closed out to output and variance |
| `cancelled` | Stopped before completion | — | Reservations released; any issued material must first be returned or scrapped |

`completed` and `cancelled` are terminal. Material issued to a cancelled order is returned to stock with a reversing `issue_to_production` entry or scrapped with a reason.

## Material handling

**`issueMethod`** (per material line)

| Value | Definition | When to use |
|---|---|---|
| `manual` | An operator or storekeeper scans and issues the lot | Default; required for lot-tracked materials where the actual lot used must be recorded |
| `backflush` | The system issues the BOM quantity automatically when output is reported at the line's operation | Low-value, non-lot items such as release agent, where scanning each use adds no value |

- Suggested lots follow the component's `pickingRule` (FEFO for shelf-life materials)
- Issuing more than the planned quantity requires a `reasonCode` (e.g. `extra_scrap`, `setup_loss`)
- Unused material is returned to stock with a `return` movement before the order is completed

## Operation reporting
Each report against an operation records:

| Field | Definition |
|---|---|
| `goodQty` | Units that passed this operation and moved to the next |
| `scrapQty` + `scrapReason` | Units destroyed at this operation, with a reason code |
| `reworkQty` + `reworkReason` | Units sent for rework instead of scrapped |
| `setupMinutes`, `runMinutes` | Actual time spent |
| `machineId`, `operatorId` | Who ran which machine, from [Workforce](09-workforce.md) station assignment |
| `shiftId` | The shift the work was done in |

**Scrap reasons** (tenant-configurable, defaults): `flash_excess`, `short_fill`, `dimension_out`, `porosity`, `bonding_failure`, `contamination`, `setup_loss`, `handling_damage`. Used for Pareto charts in [Reporting](11-reporting.md) and as input to NCRs in [Quality](08-quality.md).

## Completion, output, and genealogy
- Reporting `goodQty` at the last operation posts a `production_output` entry for the finished product, creating a new output lot in the `qc_hold` location (or directly in `storage` when no final inspection is required)
- Every input lot issued to the order is linked to the output lot in `LotGenealogy` with the quantity consumed
- Over-production guard: total output cannot exceed `plannedQty` × 1.10
- Scrap at any operation posts a `scrap` movement for the WIP value at that point

## Yield
- **Operation yield** = good ÷ (good + scrap) at that operation
- **Order yield (first-pass)** = final good output ÷ quantity started, excluding reworked units that later passed
- **Rolled throughput yield** = product of operation yields across the routing

Low yields are flagged against a per-product target in [Reporting](11-reporting.md).

## Cost absorption
- Material cost enters WIP when lots are issued
- Labor = actual run and setup minutes × work center `laborRatePerHour`
- Overhead = actual run minutes × work center `overheadRatePerHour`
- On completion, WIP value is moved to the output lot. Under standard costing, the difference to standard goes to Production Variance

See the posting rules in [Products & Inventory](01-products-inventory.md#accounting-class-per-type-overridable-per-product).

## Screens
- **Production order list** (desktop): filter by status, work center, product, due date
- **Order detail** (desktop): materials (planned, reserved, issued, returned), operations (planned vs. actual), output lots, cost summary
- **Schedule board** (desktop): orders by work center and day, with load against capacity
- **Shop floor terminal** (mobile): scan order → start operation → scan lots to issue → report good / scrap / rework → complete
- **Routing and work center setup** (desktop)

## Data model sketch (Prisma)
```prisma
model WorkCenter {
  tenantKey             String
  id                    Int
  name                  String
  workCenterType        String   // machine | manual | inspection
  capacityHoursPerShift Decimal
  laborRatePerHour      Int      // minor units
  overheadRatePerHour   Int      // minor units
  locationId            Int
  @@id([tenantKey, id])
}

model Machine {
  tenantKey    String
  id           Int
  workCenterId Int
  name         String
  status       String @default("available") // available | running | down | retired
  @@id([tenantKey, id])
}

model Routing {
  tenantKey  String
  id         Int
  productId  Int
  version    Int
  status     String @default("draft")
  operations RoutingOperation[]
  @@id([tenantKey, id])
  @@unique([tenantKey, productId, version])
}

model RoutingOperation {
  tenantKey          String
  id                 Int
  routingId          Int
  seq                Int
  name               String
  workCenterId       Int
  setupMinutes       Decimal @default(0)
  runMinutesPerUnit  Decimal
  isInspectionPoint  Boolean @default(false)
  isCountPoint       Boolean @default(true)
  routing            Routing @relation(fields: [tenantKey, routingId], references: [tenantKey, id])
  @@id([tenantKey, id])
}

model ProductionOrder {
  tenantKey     String
  id            Int
  orderType     String   @default("standard") // standard | rework | sample
  productId     Int
  bomId         Int
  routingId     Int
  plannedQty    Decimal
  producedQty   Decimal  @default(0)
  scrappedQty   Decimal  @default(0)
  status        String   @default("draft")
  holdReason    String?
  salesOrderId  Int?     // when made to order
  plannedStart  DateTime?
  dueDate       DateTime?
  actualStart   DateTime?
  actualEnd     DateTime?
  createdById   Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  @@id([tenantKey, id])
  @@index([tenantKey, status, dueDate])
}

model ProductionMaterial {
  tenantKey     String
  id            Int
  orderId       Int
  componentId   Int
  operationSeq  Int?
  plannedQty    Decimal
  issuedQty     Decimal @default(0)
  returnedQty   Decimal @default(0)
  issueMethod   String  @default("manual") // manual | backflush
  @@id([tenantKey, id])
  @@index([tenantKey, orderId])
}

model ProductionOperation {
  tenantKey     String
  id            Int
  orderId       Int
  seq           Int
  workCenterId  Int
  plannedMinutes Decimal
  status        String  @default("pending") // pending | in_progress | done
  @@id([tenantKey, id])
  @@index([tenantKey, orderId])
}

model OperationReport {
  tenantKey     String
  id            Int
  operationId   Int
  goodQty       Decimal @default(0)
  scrapQty      Decimal @default(0)
  scrapReason   String?
  reworkQty     Decimal @default(0)
  reworkReason  String?
  setupMinutes  Decimal @default(0)
  runMinutes    Decimal @default(0)
  machineId     Int?
  operatorId    Int
  shiftId       Int?
  reportedAt    DateTime @default(now())
  @@id([tenantKey, id])
  @@index([tenantKey, operationId])
}
```

## Integration points
| Module | Interaction |
|---|---|
| Products & Inventory | Reservations at scheduling; `issue_to_production`, `production_output`, `scrap`, `return` entries; output lots and genealogy |
| BOM | Active BOM copied to material lines at creation |
| Sales Orders | Orders can be linked to a sales order line for make-to-order; completion updates availability for that order |
| Kanban & TPS | A production kanban signal can create a production order automatically |
| Quality | Inspection points block the next operation until an inspection is recorded; scrap and rework can raise NCRs |
| Workforce | Operator and machine on each report come from shift and station assignment |
| Reporting | Yield, scrap Pareto, schedule adherence, OEE inputs |

## Open decisions
- Whether operators report per operation (more data, more taps) or only at count points
- Overhead absorption rates per work center, to be agreed with ATC's accountant
- Whether make-to-order links are needed at MVP or production is purely to stock

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Operation-level reporting | Pinpoints where scrap happens; supports kaizen and ISO 9001 traceability | More operator input per shift; needs fast mobile screens |
| Backflush for non-lot items | Fewer scans for low-value materials | Stock accuracy depends on BOM accuracy; errors show only at stock count |
| Routing versioning | Records how a product was made at any date | More master data to maintain |
