# Davall Limit ERP

A cross-platform ERP application for small and mid-sized manufacturers, built for **ATC** (亞泰汽車零件有限公司), an automotive oil gasket manufacturer in Changhua, Taiwan.

## Features

This first version includes:

- **Multi-tenant architecture** with composite `(tenantKey, id)` primary keys
- **Concurrency-safe ID allocation** using a per-tenant IdCounter table
- **Auth & Security** (Module 12): JWT authentication, refresh token rotation, role-based access control
- **Products & Inventory** (Module 01): Product master, warehouses, locations, lots, stock ledger, movements

## Tech Stack

| Layer    | Technology                                                                    |
| -------- | ----------------------------------------------------------------------------- |
| Frontend | Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, Radix UI, React Hook Form |
| Backend  | Node.js, Express 5, TypeScript                                                |
| Database | PostgreSQL 16 via Prisma                                                      |
| Monorepo | pnpm workspaces                                                               |

## Project Structure

```
packages/
  api/          # Express 5 REST API
  web/          # Next.js 15 frontend
  shared/       # Shared types, schemas, and utilities
docs/
  specs/        # Module specifications
  decisions.md  # Architecture decisions
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

## Local Setup

1. **Clone and install dependencies**

```bash
git clone <repository-url>
cd davall-limit-erp
pnpm install
```

2. **Start PostgreSQL**

```bash
docker-compose up -d
```

3. **Configure environment**

```bash
cp packages/api/.env.example packages/api/.env
```

4. **Set up the database**

```bash
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations (first time: pnpm --filter @davall/api db:migrate:dev)
pnpm db:seed        # Seed demo data
```

5. **Start development servers**

```bash
pnpm dev
```

- API: http://localhost:4000
- Web: http://localhost:3000

## Demo Credentials

After seeding, log in with:

- **Email:** admin@atc.com.tw
- **Password:** AdminPassword123!

## Scripts

| Command            | Description                      |
| ------------------ | -------------------------------- |
| `pnpm dev`         | Start all packages in dev mode   |
| `pnpm build`       | Build all packages               |
| `pnpm lint`        | Run linting                      |
| `pnpm typecheck`   | Run type checking                |
| `pnpm test`        | Run tests                        |
| `pnpm db:generate` | Generate Prisma client           |
| `pnpm db:migrate`  | Deploy migrations                |
| `pnpm db:seed`     | Seed the database                |
| `pnpm db:reset`    | Reset database and re-migrate    |

## API Endpoints

### Auth
- `POST /api/auth/login` - Log in
- `POST /api/auth/logout` - Log out
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List products (paginated, filterable)
- `GET /api/products/:id` - Get product
- `POST /api/products` - Create product (manager+)
- `PATCH /api/products/:id` - Update product (manager+)
- `DELETE /api/products/:id` - Delete product (manager+)

### Warehouses & Locations
- `GET /api/warehouses` - List warehouses
- `GET /api/locations` - List locations

### Lots
- `GET /api/lots` - List lots
- `POST /api/lots/suggest-picking` - Get FEFO/FIFO lot suggestions

### Stock
- `GET /api/stock/balances` - List stock balances
- `GET /api/stock/entries` - List stock movements
- `POST /api/stock/adjust` - Stock adjustment (manager+)
- `POST /api/stock/transfer` - Stock transfer
- `POST /api/stock/reserve` - Reserve stock (manager+)
- `POST /api/stock/release` - Release reservation (manager+)

## Architecture Principles

- **Tenant isolation**: All tables use composite `(tenantKey, id)` keys; RLS planned for production
- **Stock ledger**: All stock changes go through immutable ledger entries
- **Soft deletes**: Records are never deleted, only marked with `deletedAt`
- **Service results**: Services return `{ success, data?, error?, statusCode? }` and never throw
- **Paginated lists**: All list endpoints are paginated (no unbounded queries)

## License

Proprietary - All rights reserved
