# Davall Limit ERP - Architecture Decisions

This document records the default choices made for open questions in the specifications.

## Module 01: Products & Inventory

### Posting Approach
**Decision:** Export for accountant (Option A)

**Rationale:** For the MVP, we implement the simpler export approach. Every ledger row stores unit cost; the ERP can produce monthly inventory movement, valuation, and COGS summaries by account for ATC's accountant to post in their existing accounting system. This matches ATC's current workflow and requires no general ledger module.

**Future consideration:** Automatic posting (Option B) can be added later once BOMs and routings are stable.

### Costing Method
**Decision:** Moving average (default for all items)

**Rationale:** Moving average costing requires no cost setup and works from day one. It smooths out supplier price changes automatically. Standard costing can be added later for variance reporting.

### Expiry Warning Period
**Decision:** 30 days (tenant-configurable via `expiryWarningDays` setting)

**Rationale:** A 30-day warning provides adequate time for FEFO processing and customer notification. This is configurable per tenant in the settings.

## Module 12: Admin, Auth & Security

### Role Model
**Decision:** Four fixed roles (admin, manager, staff, viewer)

**Rationale:** Simple to set up and explain. The four roles cover the common access patterns for a small/medium manufacturer. Module-level permissions can be added later if needed.

### Two-Factor Authentication
**Decision:** Deferred to future phase

**Rationale:** The infrastructure for TOTP is in place (totpSecret field on User), but implementation is deferred. Email/SMS verification requires an email provider integration first.

### Audit Log Retention
**Decision:** 10 years (matches ISO 9001 record requirements and Taiwan tax record periods)

**Rationale:** ISO 9001 requires maintaining records demonstrating conformance; Taiwan tax regulations require 5-7 year retention. A 10-year default covers both requirements with margin.

### Production Secrets
**Decision:** Environment variables with .env files for development, cloud provider secrets management for production

**Rationale:** Standard approach that works with DigitalOcean App Platform (the planned host). JWT secrets are generated per environment.

## Cross-Cutting Decisions

### ID Format
**Decision:** Full IDs are `{tenantKey}-{id}` (e.g., `ATC-1042`)

**Rationale:** Short, human-friendly, scannable. No type or date prefixes - item type and dates are stored in separate columns and can be displayed contextually.

### Tenant Key
**Decision:** 2-8 uppercase alphanumeric characters, immutable after creation

**Rationale:** Short enough for labels and scanning, long enough for uniqueness. Uppercase only for consistency.

### Money Storage
**Decision:** Integer minor currency units (e.g., cents, 分)

**Rationale:** Avoids floating-point rounding errors. All monetary amounts are stored as integers in the smallest currency unit.

### Date/Time Storage
**Decision:** ISO 8601 UTC

**Rationale:** All dates stored in UTC; conversion happens only in the UI layer. This prevents timezone confusion and simplifies international operations.

### Pagination
**Decision:** Page-based with configurable page size (default 20, max 100)

**Rationale:** Simple to implement and understand. Cursor-based pagination can be added for infinite scroll patterns later.

### Service Return Shape
**Decision:** `{ success: boolean, data?: T, error?: string, statusCode?: number }`

**Rationale:** Services never throw exceptions. Consistent return shape makes error handling predictable.

## Technology Stack Decisions

### Frontend Framework
**Decision:** Next.js 15 with App Router

**Rationale:** Required by spec. Latest stable version with React Server Components support.

### CSS Framework
**Decision:** Tailwind CSS 4 (alpha)

**Rationale:** Required by spec. Using alpha version for latest features.

### UI Components
**Decision:** Radix UI primitives with custom styling

**Rationale:** Accessible, unstyled primitives that work well with Tailwind.

### Form Handling
**Decision:** React Hook Form + Zod

**Rationale:** Required by spec. Zod schemas are shared between frontend and backend validation.

### Backend Framework
**Decision:** Express 5

**Rationale:** Required by spec. Latest major version with improved async error handling.

### ORM
**Decision:** Prisma

**Rationale:** Required by spec. Type-safe queries, excellent TypeScript integration.

### Database
**Decision:** PostgreSQL 16

**Rationale:** Required by spec. Row-level security support for tenant isolation.

### Package Manager
**Decision:** pnpm with workspaces

**Rationale:** Fast, disk-efficient, native workspace support for monorepo.

## Deferred Decisions

The following decisions are deferred to later phases:

1. **Email provider integration** (Resend or SendGrid) - needed for password reset, email verification
2. **Background job runner** (Postgres-backed or Redis-backed queue) - needed for exports, scheduled reports
3. **File storage** (DigitalOcean Spaces) - needed for document uploads, exports
4. **Monitoring** (Sentry) - needed before production deployment
5. **Redis cache** - can be added when performance optimization is needed
6. **Taiwan e-invoicing (電子發票)** - requires discussion with ATC about their current provider
7. **BOM activation approval workflow** - can be single manager action for MVP
8. **Customer-specific BOM variants** - handle with `isOptional` lines for now
