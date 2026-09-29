# 11. Reporting

**Status:** Planned  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Depends on:** all operational modules

---

## Design principle
Reports read from the same ledgers and documents the operational modules write — the stock ledger, operation reports, inspections, shipments, and invoices — so every figure can be traced back to its source records. Each KPI has one written definition (below) that is used everywhere it appears. Heavy work (exports, scheduled reports, large recalculations) runs as **background jobs**, never in the request that the user is waiting on.

## Features
- KPI dashboards per role
- A KPI catalog with one definition, formula, and target per KPI
- Drill-down from any figure to the records behind it
- Operational reports per module (stock, production, quality, sales, purchasing, finance, workforce)
- Exports (CSV, PDF) run as background jobs
- Scheduled reports emailed on a set frequency
- Accounting export (monthly inventory movement, valuation, and COGS summary by account)

## KPI catalog

### Delivery and sales

| KPI | Definition | Formula | When to use |
|---|---|---|---|
| On-time delivery (OTD) | Share of order lines delivered by the customer's requested date | Lines delivered on or before requested date ÷ lines delivered | Main customer service measure; OEM customers track it on their own scorecards |
| Fill rate | Share of ordered quantity shipped in the first shipment | First-shipment qty ÷ ordered qty | Shows how often stock shortages split orders |
| Order backlog | Value of confirmed, unshipped order lines | Σ (open qty × unit price) | Weekly capacity and cash planning |
| Gross margin | Profit after cost of goods sold | (Revenue − COGS) ÷ revenue | By customer and product, to review pricing |

### Production

| KPI | Definition | Formula | When to use |
|---|---|---|---|
| First-pass yield (FPY) | Share of units made right the first time | Good units without rework ÷ units started | Main process quality measure per product and line |
| Scrap rate | Share of material or units scrapped | Scrap qty ÷ (good + scrap qty) | Per operation and reason, for kaizen priorities |
| OEE | Overall equipment effectiveness: how much of planned time produced good parts at full speed | Availability × Performance × Quality | Per machine or work center. Availability = run time ÷ planned time; Performance = (ideal cycle time × total count) ÷ run time; Quality = good count ÷ total count |
| Schedule adherence | Share of production orders completed by their due date | Orders completed on time ÷ orders completed | Planning reliability |
| Takt vs. cycle time | Whether a line keeps pace with demand | Cycle time ÷ takt time (target ≤ 1) | Kanban lines, see [Kanban & TPS](04-kanban-tps.md) |

### Inventory

| KPI | Definition | Formula | When to use |
|---|---|---|---|
| Inventory value | Value of stock on hand | Σ (on-hand × unit cost), by accounting class | Month-end and reconciliation with accounting |
| Inventory turns | How many times stock is used up per year | Annual COGS ÷ average inventory value | Overall stock efficiency |
| Days of inventory | Days of usage covered by current stock | Inventory value ÷ average daily COGS (or daily usage for materials) | Per item, to find excess stock |
| Inventory accuracy | Share of counted locations matching the system | Locations with no variance ÷ locations counted | After every cycle count |
| Expiring stock | Value of lots expiring within N days | Σ value of lots with `expiresAt` ≤ today + N | Weekly, for shelf-life materials |

### Quality

| KPI | Definition | Formula | When to use |
|---|---|---|---|
| NCR count by source and severity | Number of nonconformances raised | Count of NCRs per period | Monthly quality review |
| Cost of poor quality | Money lost to defects | Scrap value + rework cost + sorting cost + returns | Monthly; prioritizes CAPAs |
| Customer PPM | Defective parts per million shipped | Defective qty reported by customers ÷ shipped qty × 1,000,000 | OEM customers usually set a PPM target |
| CAPA aging | How long CAPAs stay open | Days since opened, by status | Overdue CAPAs are an ISO 9001 audit finding |
| Supplier quality acceptance | Share of supplier lots passing incoming inspection | Lots passed ÷ lots inspected | Supplier scorecard |

### Purchasing and finance

| KPI | Definition | Formula | When to use |
|---|---|---|---|
| Supplier on-time delivery | Share of PO lines received by promised date | Lines received on time ÷ lines received | Supplier scorecard |
| DSO | Days sales outstanding: average days to collect | AR balance ÷ revenue × days in period | Monthly cash review |
| DPO | Days payable outstanding: average days to pay suppliers | AP balance ÷ purchases × days in period | Monthly cash review |
| AR / AP aging | Unpaid balances by age bucket | Current, 1–30, 31–60, 61–90, 90+ days | Collections and payment planning |

### Workforce

| KPI | Definition | Formula | When to use |
|---|---|---|---|
| Attendance rate | Share of rostered shifts worked | Present or late shifts ÷ rostered shifts | Weekly by team |
| Labor hours per unit | Operator time per good unit | Σ reported run + setup minutes ÷ good units | Per product, to check routing times |
| Overtime hours | Hours worked beyond schedule | Σ overtime minutes ÷ 60 | Weekly by work center |

## Dashboards by role

| Dashboard | Main KPIs | For |
|---|---|---|
| Plant | OTD, FPY, OEE, scrap rate, schedule adherence, open NCRs | Plant Manager |
| Production | Today's orders, operation progress, scrap by reason, machine status | Production Supervisor |
| Quality | Inspection queue, NCRs, CAPA aging, customer PPM, supplier quality | QC Inspector, quality lead |
| Inventory | Items below reorder point, expiring stock, inventory value, accuracy | Inventory Clerk |
| Sales | Backlog, OTD, order intake, margin by customer | Sales Manager |
| Finance | AR/AP aging, DSO, DPO, inventory value, cost of poor quality | Finance / Accounting |

Every tile links to a filtered list of the underlying records.

## Exports and scheduled reports

### Export format (`format`)

| Value | Definition | When to use |
|---|---|---|
| `csv` | Plain data table | Further analysis in Excel or loading into another system, including the accounting export |
| `pdf` | Formatted report | Sharing with managers, customers, or auditors |

### Report job status (`status`)

| Value | Definition |
|---|---|
| `queued` | Waiting for the job runner |
| `running` | Being generated |
| `done` | File ready to download (link valid for a set number of days) |
| `failed` | Error; message stored and user notified |
| `expired` | File deleted after the retention period |

### Schedule frequency (`frequency`)

| Value | When to use |
|---|---|
| `daily` | Production and shipping summaries for supervisors |
| `weekly` | KPI packs for management meetings |
| `monthly` | Accounting export, supplier scorecards, quality review |

Scheduled reports run as the user who created them, so they only include data that user can see.

## Performance approach
- Dashboards read from summary tables or materialized views refreshed by background jobs (e.g. every 15 minutes for production, nightly for finance), with the refresh time shown on each tile
- Drill-down lists query the live tables with pagination
- Exports stream rows to a file in object storage rather than building them in memory

## Data model sketch (Prisma)
```prisma
model KpiDefinition {
  tenantKey   String
  id          Int
  key         String   // otd, fpy, oee …
  name        String
  targetValue Decimal?
  targetDirection String // higher_better | lower_better
  @@id([tenantKey, id])
  @@unique([tenantKey, key])
}

model ReportJob {
  tenantKey    String
  id           Int
  reportKey    String
  format       String   // csv | pdf
  parameters   Json
  status       String   @default("queued") // queued | running | done | failed | expired
  fileUrl      String?
  error        String?
  requestedById Int
  requestedAt  DateTime @default(now())
  finishedAt   DateTime?
  @@id([tenantKey, id])
  @@index([tenantKey, requestedById, requestedAt])
}

model ReportSchedule {
  tenantKey    String
  id           Int
  reportKey    String
  format       String
  parameters   Json
  frequency    String   // daily | weekly | monthly
  recipients   String[]
  ownerId      Int
  nextRunAt    DateTime
  isActive     Boolean  @default(true)
  @@id([tenantKey, id])
}
```

## Open decisions
- Which KPIs ATC reports today, and their current targets
- Whether OEE is needed at launch; it requires machine downtime recording, which is not otherwise in scope
- Background job runner choice (e.g. a Postgres-backed queue vs. Redis-backed queue)

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| One written KPI catalog | Everyone uses the same numbers; fewer disputes in meetings | Definitions must be agreed with ATC up front |
| Summary tables refreshed by jobs | Fast dashboards without loading the operational database | Figures are minutes behind live data |
| Drill-down to source records | Every number can be checked, which supports audits | More UI work per report |
