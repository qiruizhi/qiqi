# 8. Quality (ISO 9001)

**Status:** Planned  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Depends on:** [Products & Inventory](01-products-inventory.md), [Production Orders](03-production-orders.md), [Purchase Orders](06-purchase-orders.md), [Sales Orders](05-sales-orders.md)

---

## Design principle
Quality records are created where the work happens — at receiving, at inspection points on the production floor, and at final inspection — and they control stock directly: a failed inspection holds the lot, and only a recorded decision (disposition) releases, reworks, or scraps it. Every problem found becomes a **non-conformance record (NCR)**; problems that need a root-cause fix become **corrective or preventive actions (CAPA)**. Together with lot genealogy, this gives ATC the audit trail ISO 9001 auditors and OEM customers expect.

## Features
- Inspection plans per product and inspection type, with characteristics and limits
- Mobile inspection checklists with pass / fail / conditional results
- Incoming, in-process, final, and first-article inspection
- Automatic lot hold on failure; release only through disposition
- Non-conformance records (NCRs) with disposition and cost
- Corrective and preventive actions (CAPAs) with root cause and effectiveness check
- Customer complaints linked to shipped lots
- Controlled documents with revisions and approval
- Certificates of conformance (CoC) generated per shipment
- Measuring equipment register with calibration due dates
- Audit-ready quality records across every module

## Inspection plans
An inspection plan lists what to check for a product at a given inspection type. Plans are versioned like BOMs (`draft`, `active`, `superseded`, `obsolete`).

### Inspection types (`inspectionType`)

| Value | Definition | When to use |
|---|---|---|
| `incoming` | Check of purchased material at receipt | Materials with `requiresIncomingInspection`, conditional or new suppliers |
| `in_process` | Check during production at a routing inspection point | Critical operations such as vulcanizing, where defects must be caught before more value is added |
| `final` | Check of the finished lot before release to stock | Every finished good. Lots stay in `qc_hold` until it passes |
| `first_article` | Full check of the first parts after a new setup, new mold, or new product | Start of a run after a mold change, and new part approvals for OEM customers |

### Characteristic types (`characteristicType`)

| Value | Definition | When to use |
|---|---|---|
| `variable` | A measured number compared with limits (nominal, lower, upper) | Dimensions (inner diameter, thickness), hardness (Shore A), tensile strength |
| `attribute` | A pass / fail check | Presence of a feature, go/no-go gauge result |
| `visual` | A check against a visual standard or defect catalogue | Flash, surface defects, color, porosity |
| `document` | Confirmation that a record exists | Supplier CoA received, material batch number matches |

### Sampling (`samplingMethod`)

| Value | Definition | When to use |
|---|---|---|
| `every_unit` | Inspect all units | Safety-critical characteristics, first-article inspection |
| `fixed_count` | Inspect a set number per lot | Simple plans agreed with a customer |
| `percent` | Inspect a percentage of lot quantity | General in-process checks |
| `aql` | Sample size and accept/reject numbers from an AQL table (ISO 2859-1) by lot size and inspection level | Incoming and final inspection of large lots |

## Inspection records
- Created automatically: at goods receipt (incoming), when an operation with `isInspectionPoint` is reached (in-process), when output is reported into `qc_hold` (final), and after a setup change (first article)
- The inspector records each characteristic's value or result on mobile; `variable` results are compared with limits automatically
- Equipment used for measurement is recorded; out-of-calibration equipment cannot be selected

### Result (`result`)

| Value | Definition | What happens |
|---|---|---|
| `pass` | All characteristics within limits | Lot released: status `available`, transfer out of `qc_hold` |
| `fail` | One or more characteristics out of limits | Lot stays or moves to `quarantine`; an NCR is created |
| `conditional` | Minor deviation that may be accepted with approval | Lot stays on hold; an NCR is created with suggested disposition `use_as_is`, needing quality manager approval |

## Non-conformance records (NCR)

### Source (`source`)

| Value | When to use |
|---|---|
| `incoming` | Supplier material failed incoming inspection |
| `in_process` | Defects found during production |
| `final` | Finished lot failed final inspection |
| `customer` | Customer complaint or return |
| `internal_audit` | Found during an internal or external audit |

### Severity (`severity`)

| Value | Definition | When to use |
|---|---|---|
| `critical` | Could affect safety, engine function, or a customer's line | Leaking gasket, wrong material, mixed parts. Requires a CAPA |
| `major` | Product does not meet specification and cannot be used as is | Dimensions out of tolerance. CAPA required if repeated |
| `minor` | Deviation that does not affect fit, function, or appearance | Cosmetic issues on non-visible faces |

### Disposition (`disposition`)

| Value | Definition | Stock effect |
|---|---|---|
| `use_as_is` | Accept the material despite the deviation | Lot released to `available`; requires quality manager approval, and customer approval for OEM product when agreed |
| `rework` | Repair to meet specification | A `rework` production order is created from the quarantined lot |
| `sort` | Inspect 100% and separate good from bad | Lot split: good quantity released, bad quantity to scrap or return |
| `scrap` | Destroy | `scrap` movement; cost goes to Scrap Expense |
| `return_to_supplier` | Send back to the supplier | Return document on the PO; debit note request |

### NCR lifecycle

| Status | Definition | Allowed next |
|---|---|---|
| `open` | Recorded; material contained | `under_review`, `closed` |
| `under_review` | Investigation and disposition being decided | `dispositioned` |
| `dispositioned` | Disposition approved and being carried out | `closed` |
| `closed` | Disposition complete; linked CAPA (if any) raised | — |

Each NCR records the affected lots, quantity, defect type, photos, disposition, cost (scrap value, rework time, sorting time), and a link to a CAPA where needed.

## CAPA

### Type (`capaType`)

| Value | Definition | When to use |
|---|---|---|
| `corrective` | Action to remove the cause of a problem that has happened | Critical NCRs, repeated major NCRs, customer complaints |
| `preventive` | Action to remove the cause of a problem that could happen | Risks found in audits, near misses, trends in inspection data |

### Root-cause method (`rcaMethod`)

| Value | Definition | When to use |
|---|---|---|
| `five_why` | Ask "why" repeatedly until the underlying cause is found | Simple problems with a single chain of causes |
| `fishbone` | Group possible causes under man, machine, method, material, measurement, environment | Problems with several contributing causes |
| `eight_d` | Eight-discipline report: team, description, containment, root cause, corrective action, implementation, prevention, recognition | Customer complaints where the OEM requires an 8D report |

### CAPA lifecycle

| Status | Definition |
|---|---|
| `open` | Raised; owner assigned |
| `root_cause` | Investigation in progress |
| `action_planned` | Actions defined with owners and due dates |
| `implemented` | Actions complete |
| `verification` | Waiting a set period to check the problem has not recurred |
| `closed` | Verified effective |
| `ineffective` | Problem recurred; a new CAPA is raised and linked |

## Customer complaints
Recorded against a customer, sales order, shipment, and lots. Genealogy shows every other shipment containing the same input lots, so containment can reach all affected customers. A complaint creates an NCR with source `customer` and, for OEM customers, an 8D CAPA.

## Controlled documents

### Document type (`docType`)

| Value | Examples |
|---|---|
| `procedure` | Quality manual, receiving procedure, NCR procedure |
| `work_instruction` | Press setup, vulcanizing parameters, packing instruction |
| `specification` | Customer drawings, material specifications |
| `form` | Inspection forms, checklists |
| `record_template` | Templates for records generated by the system |

### Document status

| Value | Definition |
|---|---|
| `draft` | Being written |
| `in_review` | Sent to reviewers |
| `approved` | Current; visible on the shop floor |
| `obsolete` | Replaced or withdrawn; kept for history, hidden from the floor |

Each revision stores the file, revision number, author, approver, approval date, and change summary. Work instructions can be linked to routing operations so operators see the current revision on the shop floor screen.

## Certificates of conformance
For customers with `requiresCoC`, a CoC is generated per shipment listing products, customer part numbers, lots, quantities, and the final inspection results for each lot, signed by the quality role.

## Measuring equipment
A register of gauges and instruments (calipers, hardness testers, go/no-go gauges) with calibration interval, last and next calibration date, and status `in_use`, `due`, `overdue`, `out_of_service`. Equipment that is `overdue` or `out_of_service` cannot be selected on inspection records. ISO 9001 requires controlled measuring resources; this register is kept minimal and separate from the out-of-scope maintenance module.

## Screens
- **Inspection plan editor** (desktop)
- **Inspection queue** (mobile and desktop): lots waiting for inspection by type and age
- **Inspection checklist** (mobile-first): characteristic by characteristic, with limits and photo capture
- **NCR list and detail** (desktop)
- **CAPA board** (desktop): by status, owner, overdue
- **Complaint entry** (desktop), with trace view
- **Document library** (desktop; read-only view on mobile for the floor)
- **Equipment register** (desktop)

## Data model sketch (Prisma)
```prisma
model InspectionPlan {
  tenantKey      String
  id             Int
  productId      Int
  inspectionType String   // incoming | in_process | final | first_article
  version        Int
  status         String   @default("draft")
  samplingMethod String   // every_unit | fixed_count | percent | aql
  samplingValue  Decimal? // count, percent, or AQL level
  characteristics InspectionCharacteristic[]
  @@id([tenantKey, id])
}

model InspectionCharacteristic {
  tenantKey          String
  id                 Int
  planId             Int
  seq                Int
  name               String
  characteristicType String   // variable | attribute | visual | document
  nominal            Decimal?
  lowerLimit         Decimal?
  upperLimit         Decimal?
  unit               String?
  plan               InspectionPlan @relation(fields: [tenantKey, planId], references: [tenantKey, id])
  @@id([tenantKey, id])
}

model Inspection {
  tenantKey        String
  id               Int
  planId           Int
  inspectionType   String
  lotId            Int
  referenceType    String?  // goods_receipt | production_operation | production_order
  referenceId      Int?
  sampleSize       Int
  result           String?  // pass | fail | conditional
  inspectorId      Int
  inspectedAt      DateTime?
  results          InspectionResult[]
  @@id([tenantKey, id])
  @@index([tenantKey, lotId])
}

model InspectionResult {
  tenantKey        String
  id               Int
  inspectionId     Int
  characteristicId Int
  measuredValue    Decimal?
  passed           Boolean
  equipmentId      Int?
  note             String?
  inspection       Inspection @relation(fields: [tenantKey, inspectionId], references: [tenantKey, id])
  @@id([tenantKey, id])
}

model Ncr {
  tenantKey    String
  id           Int
  source       String   // incoming | in_process | final | customer | internal_audit
  severity     String   // critical | major | minor
  status       String   @default("open")
  description  String
  defectType   String?
  quantity     Decimal
  disposition  String?  // use_as_is | rework | sort | scrap | return_to_supplier
  dispositionApprovedById Int?
  cost         Int      @default(0)
  inspectionId Int?
  supplierId   Int?
  customerId   Int?
  capaId       Int?
  createdAt    DateTime @default(now())
  closedAt     DateTime?
  @@id([tenantKey, id])
}

model NcrLot {
  tenantKey String
  id        Int
  ncrId     Int
  lotId     Int
  quantity  Decimal
  @@id([tenantKey, id])
}

model Capa {
  tenantKey     String
  id            Int
  capaType      String   // corrective | preventive
  rcaMethod     String?  // five_why | fishbone | eight_d
  status        String   @default("open")
  problem       String
  rootCause     String?
  ownerId       Int
  dueDate       DateTime?
  verifyUntil   DateTime?
  createdAt     DateTime @default(now())
  closedAt      DateTime?
  @@id([tenantKey, id])
}

model ControlledDocument {
  tenantKey  String
  id         Int
  docType    String
  title      String
  revisions  DocumentRevision[]
  @@id([tenantKey, id])
}

model DocumentRevision {
  tenantKey    String
  id           Int
  documentId   Int
  revision     Int
  status       String   @default("draft") // draft | in_review | approved | obsolete
  fileUrl      String
  changeSummary String?
  authorId     Int
  approverId   Int?
  approvedAt   DateTime?
  document     ControlledDocument @relation(fields: [tenantKey, documentId], references: [tenantKey, id])
  @@id([tenantKey, id])
}

model MeasuringEquipment {
  tenantKey          String
  id                 Int
  name               String
  calibrationDays    Int
  lastCalibratedAt   DateTime?
  nextCalibrationAt  DateTime?
  status             String @default("in_use") // in_use | due | overdue | out_of_service
  @@id([tenantKey, id])
}
```

## Integration points
| Module | Interaction |
|---|---|
| Products & Inventory | Results change lot status and move stock out of `qc_hold`; scrap and sort post movements |
| Purchase Orders | Incoming inspection at receipt; supplier NCRs drive `conditional` status and scorecard |
| Production Orders | Inspection points block the next operation; `rework` dispositions create rework orders |
| Sales Orders / Shipping | Complaints trace to shipped lots; CoCs printed with shipments |
| Workforce | Inspector and operator identities on every record |
| Reporting | First-pass yield, defect Pareto, NCR and CAPA aging, cost of poor quality, supplier quality |

## Open decisions
- Which inspection plans ATC already runs on paper, to seed the system
- Whether OEM customers require customer approval for `use_as_is` dispositions
- Whether statistical process control charts (X-bar/R) are needed at launch or later

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Inspection results control lot status | Nonconforming material cannot be shipped by mistake | Inspections become a gate; slow inspections delay shipments |
| NCR and CAPA in the same system as production | Cost of poor quality is measured from real scrap and rework data | Supervisors and quality staff must keep records current |
| Minimal equipment register | Meets ISO 9001 measuring resource control without a maintenance module | Calibration of production machines stays outside the system |
