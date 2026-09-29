# 9. Workforce & Floor Management

**Status:** Planned (Basic scope)  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Used by:** [Production Orders](03-production-orders.md), [Quality](08-quality.md), [Reporting](11-reporting.md)

---

## Design principle
The workforce module records **who was working, when, and at which station**. Its purpose is traceability and shift control on the floor, not HR: every production report and inspection can be traced to a named operator, machine, and shift, which ISO 9001 requires for accountability. Skills, performance, training, and payroll are out of scope. Workers do not need a system login; they identify themselves by scanning a badge on a shared shop floor device.

## Features
- Worker register with badge id, linked to a user account only where the worker logs in
- Shift definitions (day, night, rotating) and shift patterns
- Worker-to-shift roster
- Clock-in and clock-out by badge scan on mobile or a floor terminal
- Attendance status per worker per shift, including lateness and absence
- Worker-to-station (machine) assignment per shift
- Shift handover notes between supervisors
- Attendance export for payroll

## Workers (`Worker`)

| Field | Definition | When to use |
|---|---|---|
| `badgeId` | Code printed on the worker's badge as a barcode or QR | Every worker who clocks in or reports production |
| `userId` | Link to a system user account | Only for supervisors, inspectors, and others who log in |
| `employmentType` | `full_time`, `part_time`, `contract`, `agency` | Every worker; used to filter rosters and exports |
| `defaultWorkCenterId` | Work center the worker usually works at | Pre-fills station assignment |
| `status` | `active`, `inactive` | Inactive workers cannot clock in or be rostered |

Personal data is limited to name, badge, employment type, and work details. Worker data falls under Taiwan's Personal Data Protection Act; access is limited to supervisor and admin roles.

## Shifts

### Shift definitions (`Shift`)

| Field | Definition | When to use |
|---|---|---|
| `name` | e.g. Day, Night | Every shift |
| `startTime` / `endTime` | Local start and end time | Every shift; night shifts cross midnight |
| `breakMinutes` | Unpaid break time | Used to calculate worked hours and work center capacity |
| `graceMinutes` | Minutes after start before a clock-in counts as late | Tenant default, e.g. 5 |

### Pattern type (`patternType`)

| Value | Definition | When to use |
|---|---|---|
| `day` | Worker is always on the day shift | Office-adjacent roles, day-only lines |
| `night` | Worker is always on the night shift | Dedicated night crews |
| `rotating` | Worker cycles through shifts on a repeating pattern (e.g. 5 days day, 2 off, 5 nights) | Lines running around the clock. The pattern generates the roster automatically |

**Roster (`ShiftAssignment`):** one row per worker per work date, generated from the pattern and editable by supervisors for swaps and overtime.

## Attendance

**Clock events** are recorded as `in` or `out` with a timestamp and device. Attendance for each roster row is calculated from the events:

| Status | Definition | When it applies |
|---|---|---|
| `present` | Clocked in within grace time and clocked out at or after end | Normal attendance |
| `late` | Clocked in after start + `graceMinutes` | Tardiness; minutes late recorded |
| `early_leave` | Clocked out before shift end without approval | Minutes short recorded |
| `absent` | Rostered but no clock-in | Unexplained absence |
| `leave` | Rostered but on approved leave | Supervisor enters the leave type (annual, sick, personal, official) |
| `off` | Not rostered | Rest days |

- Missing clock-out is flagged for the supervisor to correct; corrections keep the original event and record who changed it
- Overtime = worked time beyond scheduled time, recorded for export; overtime approval and pay rules stay in payroll
- Leave types are recorded as types only; no reasons or medical details are stored

## Station assignment
- A supervisor assigns workers to machines or stations for each shift, or workers self-assign by scanning the machine QR code and their badge
- A production report takes its `operatorId` and `machineId` from the active assignment unless the operator scans a different one
- Assignments are time-stamped, so a machine's operator history can be reconstructed for any date and time

## Shift handover
At the end of each shift the outgoing supervisor records a handover per work center:

| Field | Definition |
|---|---|
| `summary` | What was produced, open issues |
| `issues` | Machine problems, quality concerns, material shortages, linked to machines, orders, or NCRs |
| `safetyNotes` | Any safety incidents or hazards |
| `acknowledgedById` | Incoming supervisor confirms they have read it |

Open production orders and inspections still in `qc_hold` for the work center are listed automatically on the handover.

## Screens
- **Worker list** (desktop)
- **Shift and pattern setup** (desktop)
- **Roster** (desktop): calendar by worker and date, with swaps
- **Clock terminal** (mobile or floor tablet): badge scan only, large feedback
- **Station assignment board** (desktop and tablet)
- **Attendance review** (desktop): exceptions (late, missing clock-out, absent) for the supervisor
- **Handover** (mobile and desktop)
- **Attendance export** (desktop): CSV per pay period

## Data model sketch (Prisma)
```prisma
model Worker {
  tenantKey           String
  id                  Int
  name                String
  badgeId             String
  userId              Int?
  employmentType      String   // full_time | part_time | contract | agency
  defaultWorkCenterId Int?
  status              String   @default("active")
  @@id([tenantKey, id])
  @@unique([tenantKey, badgeId])
}

model Shift {
  tenantKey    String
  id           Int
  name         String
  startTime    String   // "07:00"
  endTime      String   // "15:30"
  breakMinutes Int      @default(60)
  graceMinutes Int      @default(5)
  @@id([tenantKey, id])
}

model ShiftPattern {
  tenantKey   String
  id          Int
  name        String
  patternType String   // day | night | rotating
  cycle       Json     // ordered list of shiftId or "off" per day
  @@id([tenantKey, id])
}

model ShiftAssignment {
  tenantKey        String
  id               Int
  workerId         Int
  shiftId          Int
  workDate         DateTime  // date only
  attendanceStatus String?   // present | late | early_leave | absent | leave | off
  leaveType        String?
  lateMinutes      Int       @default(0)
  overtimeMinutes  Int       @default(0)
  @@id([tenantKey, id])
  @@unique([tenantKey, workerId, workDate, shiftId])
}

model ClockEvent {
  tenantKey    String
  id           Int
  workerId     Int
  eventType    String   // in | out
  occurredAt   DateTime
  deviceId     String?
  correctedById Int?
  originalAt   DateTime?
  @@id([tenantKey, id])
  @@index([tenantKey, workerId, occurredAt])
}

model StationAssignment {
  tenantKey  String
  id         Int
  workerId   Int
  machineId  Int
  shiftAssignmentId Int
  startedAt  DateTime
  endedAt    DateTime?
  @@id([tenantKey, id])
  @@index([tenantKey, machineId, startedAt])
}

model ShiftHandover {
  tenantKey        String
  id               Int
  workCenterId     Int
  shiftId          Int
  workDate         DateTime
  summary          String
  issues           Json?
  safetyNotes      String?
  createdById      Int
  acknowledgedById Int?
  acknowledgedAt   DateTime?
  @@id([tenantKey, id])
}
```

## Integration points
| Module | Interaction |
|---|---|
| Production Orders | Operator, machine, and shift on every operation report; capacity from shift hours |
| Quality | Inspector identity; operator and machine history for NCR investigation |
| Reporting | Attendance rates, labor hours per product, overtime |
| Admin | Workers linked to users where they log in; roles control roster and correction access |

## Open decisions
- Whether ATC already has a time clock system to import from instead of clocking in the ERP
- Payroll export format required by ATC's payroll provider

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Badge scan without logins | Fast for operators; no password management on the floor | Badges can be shared; needs supervisor oversight |
| Station assignment per shift | Machine and operator traceability for every defect | Supervisors must keep assignments current when people move between machines |
| Attendance kept basic | Low scope; avoids storing sensitive HR data | Leave approval, payroll, and labor law checks remain in other systems |
