# 4. Kanban & TPS

**Status:** Planned  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Depends on:** [Products & Inventory](01-products-inventory.md), [Bill of Materials](02-bill-of-materials.md), [Production Orders](03-production-orders.md), [Purchase Orders](06-purchase-orders.md)

---

## Design principle
ATC runs on the Toyota Production System: material is replenished when it is used (pull), not pushed by forecast. The module models each replenishment loop as a **kanban loop** for one item between a supplying point and a consuming point, with a fixed number of **cards**, each representing one container quantity. When a container is emptied, its card becomes a signal. The signal creates the replenishment: a production order, a purchase order line, or a stock transfer. Card quantities replace reorder point and max stock for items under kanban control.

## Features
- Kanban loops per item, with card calculation and rebalancing
- Production, withdrawal, and supplier kanban types
- Printable cards with QR codes, and a digital board view
- Card scanning on mobile to signal and receive
- Automatic creation of production orders, PO lines, or transfers from signals
- Takt time calculation per product line
- Heijunka (level-loading) board for sequencing production signals
- Kaizen log for waste observations and improvement actions
- Loop health indicators: cards in each state, stockouts, overdue signals

## Kanban types (`kanbanType`)

| Value | Definition | When to use |
|---|---|---|
| `production` | Authorizes the plant to make one container of the item | Finished goods and WIP made in-house, replenishing a supermarket after the next process withdraws |
| `withdrawal` | Authorizes moving one container from a supermarket to the point of use | Moving raw material or WIP from the store to line-side. Creates a `transfer` movement |
| `supplier` | Authorizes a supplier to deliver one container | Purchased materials with regular usage and a stable supplier, such as standard rubber compounds |
| `signal` | A single card that triggers a batch when stock reaches a trigger point | Processes with long setups (e.g. mold changes on presses) where making one container at a time is not practical |

## Loop fields

| Field | Definition | When to use |
|---|---|---|
| `productId` | The item replenished by the loop | Every loop |
| `fromLocationId` / `toLocationId` | Supplying point and consuming point (supermarket and line-side, or supplier and receiving) | Every loop; `fromLocationId` empty for supplier loops |
| `containerQty` | Quantity in one container, in the item's `uom` | Every loop. Choose a standard container the operators actually use |
| `dailyDemand` | Average daily usage | Derived from recent consumption or entered by the planner |
| `leadTimeDays` | Time from signal to full container back at the consuming point | Production lead time, transfer time, or supplier lead time |
| `safetyFactor` | Buffer as a fraction (0.1 = 10%) | Higher for unstable demand or unreliable supply |
| `cardCount` | Number of cards in circulation | Calculated, then set by the planner |
| `triggerQty` | For `signal` kanban, the stock level that releases the batch | Signal loops only |
| `supplierId` | Supplier for `supplier` loops | Supplier loops only |

**Card calculation:** cards = ⌈ (`dailyDemand` × `leadTimeDays` × (1 + `safetyFactor`)) ÷ `containerQty` ⌉. The system suggests the value; the planner confirms it.

**Rebalancing:** a scheduled job compares recent actual usage with `dailyDemand` and flags loops where the suggested card count differs from the current count by more than a set threshold. Adding cards prints new cards; removing cards retires them as they return to the empty state.

## Card status (`status`)

| Value | Definition | When it changes |
|---|---|---|
| `full` | Attached to a full container at the consuming point or in the supermarket | Set when the container is received back |
| `signaled` | The container has been emptied; replenishment is requested | Operator scans the card when the container is started or emptied |
| `in_process` | Replenishment is underway (production order running, PO sent, transfer picked) | Set when the linked order or transfer starts |
| `in_transit` | Filled container moving to the consuming point | Set on dispatch from the supplying point |
| `retired` | Removed from circulation | Set during rebalancing or when the loop is closed |

A card in `signaled` longer than the loop lead time is shown as **overdue** on the board.

## Replenishment actions
| Kanban type | What a signal creates |
|---|---|
| `production` | A production order for `containerQty` (or combined with other signaled cards for the same item up to a batch limit), placed on the heijunka board |
| `withdrawal` | A transfer task from the supermarket to line-side |
| `supplier` | A PO line on an open blanket purchase order for that supplier, or a new PO |
| `signal` | A production order for the batch quantity |

## Takt time and level loading
- **Takt time** = available production time per period ÷ customer demand per period. Example: 2 shifts × 7.5 h × 60 = 900 min per day; demand 4,500 gaskets per day → takt = 0.2 min (12 seconds) per gasket
- Takt is calculated per product line and compared with the routing cycle time to show whether a line can keep pace
- **Heijunka board:** production signals are placed into time slots per work center to mix products evenly across the shift instead of running each product in one large batch. The planner drags cards between slots; the order of production orders follows the board

## Kaizen log
Records waste observations and improvements linked to a work center, product, or order.

**`wasteType`** — the eight wastes (TIMWOODS):

| Value | Definition | Example at a gasket plant |
|---|---|---|
| `transport` | Unnecessary movement of materials | Rubber carried across the plant between cutting and pressing |
| `inventory` | More stock than needed | Excess WIP piling up before vulcanizing |
| `motion` | Unnecessary movement of people | Operators walking to fetch tools or trays |
| `waiting` | Idle time waiting for material, machines, or information | Press idle while a mold heats up |
| `overproduction` | Making more or earlier than needed | Running extra gaskets to avoid a mold change |
| `overprocessing` | More work than the customer requires | Trimming flash on a face the customer does not inspect |
| `defects` | Scrap and rework | Short-fill gaskets |
| `skills` | Unused knowledge or ideas of people | Operator suggestions not captured |

Kaizen entries have status `open`, `in_progress`, `done`, `rejected`, an owner, and a before/after measure (e.g. minutes, scrap %).

## Screens
- **Loop setup** (desktop): create and edit loops, see suggested vs. current card count
- **Kanban board** (desktop, also displayed on shop floor screens): cards by status and loop, overdue highlighted
- **Heijunka board** (desktop): time slots per work center with draggable production cards
- **Card scan** (mobile): scan QR → confirm action (signal, receive, dispatch)
- **Card printing** (desktop): print new or replacement cards, showing item, full id, container quantity, from/to locations, card number (e.g. 3 of 8), QR code
- **Kaizen log** (desktop and mobile)

## Data model sketch (Prisma)
```prisma
model KanbanLoop {
  tenantKey      String
  id             Int
  kanbanType     String   // production | withdrawal | supplier | signal
  productId      Int
  fromLocationId Int?
  toLocationId   Int
  supplierId     Int?
  containerQty   Decimal
  dailyDemand    Decimal
  leadTimeDays   Decimal
  safetyFactor   Decimal  @default(0.1)
  cardCount      Int
  triggerQty     Decimal?
  isActive       Boolean  @default(true)
  cards          KanbanCard[]
  @@id([tenantKey, id])
  @@index([tenantKey, productId])
}

model KanbanCard {
  tenantKey       String
  id              Int                       // full id printed as QR
  loopId          Int
  cardNo          Int                       // 1 … cardCount
  status          String  @default("full")  // full | signaled | in_process | in_transit | retired
  signaledAt      DateTime?
  referenceType   String?                   // production_order | purchase_order | transfer
  referenceId     Int?
  loop            KanbanLoop @relation(fields: [tenantKey, loopId], references: [tenantKey, id])
  @@id([tenantKey, id])
  @@index([tenantKey, loopId, status])
}

model KaizenEntry {
  tenantKey     String
  id            Int
  wasteType     String
  description   String
  workCenterId  Int?
  productId     Int?
  ownerId       Int
  status        String  @default("open")   // open | in_progress | done | rejected
  measureBefore Decimal?
  measureAfter  Decimal?
  measureUnit   String?
  createdAt     DateTime @default(now())
  @@id([tenantKey, id])
}
```

## Integration points
| Module | Interaction |
|---|---|
| Products & Inventory | Items under kanban ignore reorder point alerts; withdrawal signals create `transfer` entries |
| BOM | Finished-good demand exploded to size component loops |
| Production Orders | Production and signal kanban create orders; completion moves cards to `in_transit` or `full` |
| Purchase Orders | Supplier kanban creates PO lines; goods receipt moves cards to `full` |
| Reporting | Loop health, overdue signals, takt vs. cycle time, kaizen results |

## Open decisions
- Whether ATC's existing physical kanban cards are replaced by system-printed cards or scanned in with their current numbering
- Whether supplier kanban signals are sent to suppliers by email, a supplier portal, or printed with the PO
- Batch limit rules for combining several production cards into one order

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Digital loops with physical cards | Keeps the floor practice ATC knows while giving live visibility and automatic orders | Every card movement needs a scan; missed scans make the board inaccurate |
| Automatic card rebalancing suggestions | Card counts follow real demand instead of going stale | Suggestions need planner review; frequent changes confuse the floor |
| Kaizen log inside the ERP | Improvements linked to real scrap and time data | Adds data entry for supervisors; may duplicate an existing paper system |
