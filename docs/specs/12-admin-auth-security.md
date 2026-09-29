# 12. Admin, Auth & Security

**Status:** In progress (auth stable)  
**Part of:** [Davall Limit ERP overview](../README.md)  
**Used by:** all modules

---

## Design principle
Every request is made by an authenticated user, within one tenant, with a role that decides what they can see and change. Tenant isolation is enforced twice: by composite `(tenantKey, id)` keys in the schema and by row-level security in PostgreSQL, so an application bug cannot return another tenant's data. Changes to users, roles, settings, financial records, and quality records are written to an audit log that cannot be edited.

## Features
- Tenants with a unique `tenantKey` and tenant-level settings
- Users, roles, and invitations
- Role-based access control with four roles
- Shared shop floor devices with badge-based operator identification
- JWT access tokens in httpOnly cookies with refresh-token rotation
- Account lockout after 5 failed logins (2-hour lockout); token blacklist on logout
- CSRF protection, rate limiting, Helmet, explicit CORS
- Audit logging on writes to users, roles, settings, financial records, and quality records
- Row-level security on business tables, scoped by `tenantKey`
- Tenant settings for tolerances, defaults, language, and time zone

## Tenants (`Tenant`)

| Field | Definition | When to use |
|---|---|---|
| `tenantKey` | Short, unique, immutable code used in every full id (e.g. `ATC`) | Set once at tenant creation. Uppercase letters and digits, 2–8 characters |
| `name` | Company legal name | Printed on documents |
| `taxId` | Company business registration number | Printed on invoices and POs |
| `baseCurrency` | Currency for accounting and inventory value | Default TWD |
| `timeZone` | IANA time zone for display and shift calculations | Default `Asia/Taipei` |
| `defaultLanguage` | `zh-TW` or `en` | Default language for new users and documents |
| `status` | `active`, `suspended`, `closed` | `suspended` blocks logins but keeps data; `closed` starts the data retention period |

## Users (`User`)

| Field | Definition | When to use |
|---|---|---|
| `email` | Login identifier | Every user |
| `role` | One of the roles below | Every user |
| `language` | UI language, `zh-TW` or `en` | Defaults from tenant |
| `status` | See below | Every user |
| `workerId` | Link to a worker record | Users who also clock in or report production |

### User status (`status`)

| Value | Definition | When it applies |
|---|---|---|
| `invited` | Invitation sent; password not yet set | New users until they accept |
| `active` | Can log in | Normal state |
| `locked` | Temporarily blocked after 5 failed logins | Clears automatically after 2 hours or by an admin |
| `disabled` | Cannot log in; history kept | Staff who have left. Users are never deleted, so audit records keep a valid author |

## Roles (`role`)

| Value | Definition | When to use |
|---|---|---|
| `admin` | Full access, including users, roles, tenant settings, and audit log | Owner and system administrator; keep to one or two people |
| `manager` | Full create, read, update, and delete on business data; approves orders, dispositions, BOM activation, price overrides | Plant manager, production supervisor, sales manager, finance lead, quality lead |
| `staff` | Create and update within their own work; sees and edits only orders they own where ownership applies; cannot approve | Clerks, planners, inspectors, storekeepers |
| `viewer` | Read-only | Auditors, executives, consultants |

### Permission matrix (default)

| Area | admin | manager | staff | viewer |
|---|---|---|---|---|
| Users, roles, tenant settings, audit log | Full | — | — | — |
| Products, BOMs, routings, locations | Full | Full | Read | Read |
| BOM / routing / inspection plan activation | Yes | Yes | — | — |
| Sales and purchase orders | Full | Full | Own orders | Read |
| Order approval, price overrides, credit limit override | Yes | Yes | — | — |
| Stock movements and counts | Full | Full | Create | Read |
| Production reporting | Full | Full | Create | Read |
| Inspections | Full | Full | Create | Read |
| NCR disposition approval, CAPA closure | Yes | Yes | — | — |
| Invoices and payments | Full | Full | Draft only | Read |
| Workforce roster and attendance corrections | Full | Full | Own clock events | — |
| Reports and exports | All | All | Own module | Read-only dashboards |

## Shop floor devices
Shared tablets and terminals on the floor are registered as **devices** rather than logged in as a person.

| Field | Definition |
|---|---|
| `deviceType` | `clock_terminal`, `floor_terminal`, `inspection_tablet` |
| `workCenterId` | Where the device is placed |
| `allowedActions` | Which mobile flows the device can open (clock in/out, production reporting, inspection, picking) |

A device session is long-lived and limited to its allowed actions. Every action on a device requires a badge scan, and the record stores both the device and the worker. Inspection results on an `inspection_tablet` also require a user login, since inspectors approve quality records.

## Authentication
- Access token (JWT, short-lived, e.g. 15 minutes) and refresh token, both in `httpOnly`, `Secure`, `SameSite=Strict` cookies
- Refresh-token rotation: each refresh issues a new token and invalidates the old one; reuse of an old token revokes the whole session family
- Logout adds the access token to a blacklist until it expires
- Lockout after 5 failed logins for 2 hours
- Password rules: minimum length 12, checked against a list of breached passwords
- Email verification and password reset: currently stubbed; require an email provider (Resend or SendGrid)
- Optional two-factor authentication (TOTP) for `admin` and `manager` roles — proposed

## Request protection
- CSRF tokens on all state-changing requests
- Rate limiting per IP and per user, stricter on login and password reset
- Helmet security headers
- CORS limited to the tenant's allowed origins
- Input validation with Zod on every endpoint

## Tenant isolation
- Every business table has `tenantKey` in its primary key and all foreign keys
- The API sets `app.tenant_key` on each database session from the authenticated user; row-level security policies allow rows only where `tenant_key = current_setting('app.tenant_key')`
- Id sequences come from the per-tenant `IdCounter` table (see [README](../README.md#4-cross-cutting-design-rules))

## Audit log
Written in the same transaction as the change; never updated or deleted.

| Field | Definition |
|---|---|
| `entity`, `entityId` | What changed |
| `action` | `create`, `update`, `delete`, `status_change`, `approve`, `login`, `login_failed`, `export` |
| `before`, `after` | Changed fields only |
| `userId`, `deviceId`, `workerId` | Who made the change |
| `ip`, `occurredAt` | Where and when |

Logged entities: users, roles, tenant settings, sales and purchase orders (status changes, price overrides), invoices and payments, stock adjustments and scrap, BOM and routing activation, inspections, NCRs, CAPAs, controlled documents, and attendance corrections. Retention defaults to 10 years to cover ISO 9001 record requirements and tax record periods; confirm with ATC.

## Tenant settings
All tolerances and defaults referenced by other modules are stored per tenant.

| Setting | Definition | Default | Used by |
|---|---|---|---|
| `overProductionPercent` | Maximum output above planned quantity | 10% | [Production Orders](03-production-orders.md) |
| `overReceiptPercent` | Maximum receipt above ordered quantity | 5% | [Purchase Orders](06-purchase-orders.md) |
| `priceTolerancePercent` | Allowed invoice-to-PO price difference before hold | 2% | [Invoicing](07-invoicing.md) |
| `poApprovalThreshold` | PO total above which manager approval is needed | Set by ATC | Purchase Orders |
| `defaultPaymentTermsDays` | Payment terms for new customers and suppliers | 30 | Sales, Purchasing |
| `defaultTaxPercent` | Tax rate for new lines | 5% | Sales, Purchasing, Invoicing |
| `expiryWarningDays` | Days before expiry that lots appear in alerts | 30 | [Products & Inventory](01-products-inventory.md) |
| `attendanceGraceMinutes` | Lateness grace period | 5 | [Workforce](09-workforce.md) |
| `reportFileRetentionDays` | Days export files remain downloadable | 7 | [Reporting](11-reporting.md) |

## Data model sketch (Prisma)
```prisma
model Tenant {
  tenantKey       String   @id
  name            String
  taxId           String?
  baseCurrency    String   @default("TWD")
  timeZone        String   @default("Asia/Taipei")
  defaultLanguage String   @default("zh-TW")
  status          String   @default("active") // active | suspended | closed
  settings        Json                         // tenant settings above
  createdAt       DateTime @default(now())
}

model User {
  tenantKey      String
  id             Int
  email          String
  passwordHash   String?
  role           String   // admin | manager | staff | viewer
  language       String?
  status         String   @default("invited") // invited | active | locked | disabled
  failedLogins   Int      @default(0)
  lockedUntil    DateTime?
  workerId       Int?
  totpSecret     String?
  lastLoginAt    DateTime?
  createdAt      DateTime @default(now())
  @@id([tenantKey, id])
  @@unique([tenantKey, email])
}

model RefreshToken {
  tenantKey   String
  id          Int
  userId      Int
  familyId    String
  tokenHash   String
  expiresAt   DateTime
  revokedAt   DateTime?
  replacedById Int?
  @@id([tenantKey, id])
  @@index([tenantKey, familyId])
}

model Device {
  tenantKey      String
  id             Int
  name           String
  deviceType     String   // clock_terminal | floor_terminal | inspection_tablet
  workCenterId   Int?
  allowedActions String[]
  isActive       Boolean  @default(true)
  lastSeenAt     DateTime?
  @@id([tenantKey, id])
}

model AuditLog {
  tenantKey  String
  id         Int
  entity     String
  entityId   Int?
  action     String
  before     Json?
  after      Json?
  userId     Int?
  deviceId   Int?
  workerId   Int?
  ip         String?
  occurredAt DateTime @default(now())
  @@id([tenantKey, id])
  @@index([tenantKey, entity, entityId])
  @@index([tenantKey, occurredAt])
}
```

## Open decisions
- Whether the four roles are enough, or whether module-level permissions (e.g. a `staff` user limited to Quality) are needed at launch
- Two-factor authentication for managers and admins
- Audit log retention period and whether it is exported to separate storage
- Production secrets strategy (still undecided; see README known gaps)

## Cost / benefit
| Choice | Benefit | Cost |
|---|---|---|
| Four fixed roles | Simple to set up and explain | Less control than per-module permissions; some users may get more access than they need |
| Row-level security plus composite keys | Two independent barriers against cross-tenant data leaks | Every query and migration must set the tenant context; harder to debug |
| Device sessions with badge scans | Fast floor use without shared passwords | Device loss exposes the allowed actions until the device is disabled |
| Broad audit logging | Supports ISO 9001 audits, tax queries, and disputes | Storage growth; needs a retention and archiving plan |
