# Deployment Guide

> **Free tier walkthrough:** see **[DEPLOY-FREE-TIER.md](./DEPLOY-FREE-TIER.md)** (Neon + Render, $0 to start).

This guide covers **first-time production deploy**, **Super Admin bootstrap**, and **security checklist**.

## Architecture (production)

| Service | Default port | Purpose |
|---------|--------------|---------|
| Sales app | 3000 | Sales portal |
| Admin app | 3001 | Admin panel |
| WebSocket server | 3002 | Real-time inventory updates |
| PostgreSQL | 5432 | Primary database |

Deploy each app as a separate process (or container). All apps share the same `DATABASE_URL`.

---

## First-time production deploy

### 1. Generate secrets

Use strong random values (32+ characters):

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET (generate one per app)
openssl rand -base64 32   # WS_INTERNAL_SECRET
```

### 2. Configure environment

Copy `.env.example` to `.env` on each host (or use your platform’s secret manager).

**Required for production:**

| Variable | Where | Notes |
|----------|-------|-------|
| `DATABASE_URL` | All apps | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Admin + Sales | **Different value per app** |
| `NEXTAUTH_URL` | Admin + Sales | Public URL of that app |
| `WS_INTERNAL_SECRET` | WS server + Admin + Sales | Same value on all three |
| `WS_EMIT_URL` | Admin + Sales | Internal URL of WS server (e.g. `http://ws:3002`) |
| `CORS_ORIGINS` | WS server | Comma-separated sales + admin public URLs |
| `NODE_ENV` | All | `production` |

**Do NOT set in production:**

- `SEED_DEMO=true` — creates demo users with `password123`

### 3. Apply database schema

```bash
pnpm install
pnpm db:generate
pnpm db:push
```

Use `prisma migrate deploy` instead of `db:push` once you adopt migrations for production.

### 4. Create Super Admin (first deploy only)

Set bootstrap variables **once**, run bootstrap, then **remove the password from env**:

```bash
export NODE_ENV=production
export ORGANIZATION_NAME="Your Company"
export ORGANIZATION_SLUG="your-company"
export SUPER_ADMIN_EMAIL="admin@yourcompany.com"
export SUPER_ADMIN_NAME="Super Admin"
export SUPER_ADMIN_PASSWORD="YourStrongPasswordHere12!"

pnpm db:bootstrap
```

Bootstrap is **idempotent**: if an active Super Admin already exists for the org, it skips creation.

Log in at your Admin Panel URL with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`, then create Project Admins and sales users from **Users**.

### 5. Build and start

```bash
pnpm build
pnpm --filter admin start      # port 3001
pnpm --filter sales start      # port 3000
pnpm --filter ws-server start  # port 3002
```

---

## Local development (demo data)

Demo seed is **opt-in** only:

```bash
SEED_DEMO=true pnpm db:seed
```

This creates `admin@demo.com` / `password123` and sample projects. Never run this in production.

---

## Security checklist

### Fixed in this codebase

| Risk | Mitigation |
|------|------------|
| Open WS `/emit` endpoint | Requires `x-ws-internal-secret` when `NODE_ENV=production` or secret is set |
| Default `NEXTAUTH_SECRET` | App refuses to start in production with weak/missing secret |
| Demo seed in production | `SEED_DEMO` must be explicitly `true`; default is skip |
| Default Super Admin password | Bootstrap rejects `password123` and passwords under 12 chars |
| Session cookies | `httpOnly`, `secure` in production, separate cookie names per app |
| HTTP headers | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` on Next apps |
| Admin API | Auth middleware + project-scoped access for Project Admin |
| File uploads | KYC docs use EOI-style presign + client upload; signed download for admin review; type/size limits |

### Your responsibilities before go-live

1. **HTTPS everywhere** — terminate TLS at your load balancer; set `NEXTAUTH_URL` to `https://...`
2. **Strong DB password** — do not use `postgres/postgres` from docker-compose in production
3. **Secrets in a vault** — not in git; rotate if leaked
4. **Separate NEXTAUTH_SECRET** for admin vs sales apps
5. **Remove bootstrap password** from env after first run
6. **Firewall WS server** — only admin/sales backends should reach `/emit`; not public internet
7. **Backups** — schedule PostgreSQL backups
8. **Rate limiting** — add at reverse proxy (Cloudflare, nginx) for login routes
9. **Do not commit** `.env`, `.env.local`, or credentials

### Known limitations (plan follow-ups)

- Credentials-based login (no MFA yet)
- No built-in login rate limiting in app code
- Prefer Vercel Blob (`BLOB_READ_WRITE_TOKEN`) or S3 for booking documents on multi-instance deploys; local disk is for dev only
- WebSocket rooms are not auth-gated (clients only receive public inventory events)

---

## Environment per app

### Admin (`apps/admin/.env.local` or host env)

```env
DATABASE_URL=...
NEXTAUTH_SECRET=<admin-specific-secret>
NEXTAUTH_URL=https://admin.yourdomain.com
WS_EMIT_URL=http://internal-ws:3002
WS_INTERNAL_SECRET=<shared-with-ws-server>
NODE_ENV=production
```

### Sales (`apps/sales/.env.local`)

```env
DATABASE_URL=...
NEXTAUTH_SECRET=<sales-specific-secret>
NEXTAUTH_URL=https://sales.yourdomain.com
WS_EMIT_URL=http://internal-ws:3002
WS_INTERNAL_SECRET=<shared-with-ws-server>
NODE_ENV=production
```

### WebSocket (`apps/ws-server`)

```env
WS_PORT=3002
WS_INTERNAL_SECRET=<shared-secret>
CORS_ORIGINS=https://sales.yourdomain.com,https://admin.yourdomain.com
NODE_ENV=production
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Invalid NEXTAUTH_SECRET` on start | Set 32+ char random secret |
| Real-time updates not working | Check `WS_EMIT_URL`, `WS_INTERNAL_SECRET`, WS server reachable |
| Bootstrap says admin exists | Normal on re-run; use existing credentials or reset DB |
| CORS errors on socket | Add front-end URLs to `CORS_ORIGINS` |

See [README.md](./README.md) for local dev setup.
