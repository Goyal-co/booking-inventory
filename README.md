# Booking Inventory Platform

Enterprise-grade real-time real estate inventory booking platform.

## Architecture

- **apps/sales** — Salesperson launch-day dashboard (port 3000)
- **apps/admin** — Project/inventory/user management (port 3001)
- **apps/ws-server** — WebSocket server for real-time updates (port 3002)
- **packages/database** — Prisma schema, services, migrations
- **packages/ui** — Shared UI components
- **packages/validators** — Zod schemas
- **packages/realtime** — Socket.io event types and hooks

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL
- Redis (optional, for production scaling)

## Setup

```bash
# 1. Start PostgreSQL + Redis (Docker)
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Copy environment files
cp .env.example .env
cp .env.example packages/database/.env

# Note: PostgreSQL runs on port 5433 (not 5432) to avoid local conflicts.

# 4. Generate Prisma client, push schema
pnpm db:generate
pnpm db:push

# 5. (Optional) Load demo data for local dev — NOT for production
SEED_DEMO=true pnpm db:seed

# 6. Start services (use separate terminals)
pnpm dev:ws      # WebSocket server → http://localhost:3002
pnpm dev:sales   # Sales portal    → http://localhost:3000
pnpm dev:admin   # Admin panel     → http://localhost:3001
```

To fully reset the database and re-seed demo data:

```bash
SEED_DEMO=true pnpm db:reset
```

## Production deployment

| Guide | Use when |
|-------|----------|
| **[DEPLOY-FREE-TIER.md](./DEPLOY-FREE-TIER.md)** | Free hosting (Neon + Render) — start here |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Secrets, bootstrap, security checklist |

Quick production bootstrap after `db:push`:

```bash
ORGANIZATION_NAME="Your Company" \
SUPER_ADMIN_EMAIL="admin@yourcompany.com" \
SUPER_ADMIN_PASSWORD="<strong-password-12+chars>" \
pnpm db:bootstrap
```

## Demo Credentials

Requires `SEED_DEMO=true pnpm db:seed` (local dev only):

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | password123 |
| Project Admin | projectadmin@demo.com | password123 |
| Sales | rahul@demo.com | password123 |
| Sales | priya@demo.com | password123 |

## URLs

- Sales Portal: http://localhost:3000
- Admin Panel: http://localhost:3001
- WebSocket Server: http://localhost:3002

## Features

### Sales Panel
- Real-time inventory grid with virtual scrolling
- Block units (10 min countdown, max 3 per user)
- My Blocked Units panel with release/booking flow
- Floor plan viewer and cost sheet per unit
- Live activity feed and tower heatmap
- Dynamic filters from admin configuration

### Admin Panel
- Project setup wizard (floor plans → cost sheets → towers → inventory)
- Bulk inventory generation and assignment
- Mass block/unblock/hold actions
- User CRUD with CSV import
- Bookings monitor and audit log
- Real-time dashboard stats

## Testing

```bash
# Unit tests
pnpm --filter @booking/database test

# E2E tests (requires running apps)
npx playwright test

# Load test
k6 run tests/load/concurrent-booking.k6.js
```
