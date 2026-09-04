# syntax=docker/dockerfile:1.7
# Single Dockerfile for all Booking_Inventory services.
# Build from repo root:
#   docker build --target app --build-arg APP=sales -t goyal-booking-sales .
#   docker build --target app --build-arg APP=admin -t goyal-booking-admin .
#   docker build --target app --build-arg APP=customer -t goyal-booking-customer .
#   docker build --target app --build-arg APP=reception -t goyal-booking-reception .
#   docker build --target ws -t goyal-booking-ws .
#
# Prefer: docker compose up --build -d  (see compose.yml)
# Runtime secrets come from `.env` — never COPY them into the image.

ARG NODE_VERSION=20
ARG APP=sales

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

# --- install (lockfile layer) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY apps/sales/package.json apps/sales/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/customer/package.json apps/customer/package.json
COPY apps/reception/package.json apps/reception/package.json
COPY apps/ws-server/package.json apps/ws-server/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/email/package.json packages/email/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/pdf/package.json packages/pdf/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validators/package.json packages/validators/package.json
COPY packages/ecosystem-contracts/package.json packages/ecosystem-contracts/package.json
COPY packages/integration-hub/package.json packages/integration-hub/package.json
COPY packages/config-typescript/package.json packages/config-typescript/package.json
COPY packages/config-tailwind/package.json packages/config-tailwind/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- full workspace + prisma generate ---
FROM base AS workspace
COPY --from=deps /app/ ./
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @booking/database db:generate

# --- Next.js standalone build ---
FROM workspace AS next-builder
ARG APP=sales
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096 \
    APP=${APP}
RUN pnpm --filter ${APP} build \
  && test -f "apps/${APP}/.next/standalone/apps/${APP}/server.js"

# Prisma CLI for migrate / bootstrap at boot (Next apps)
FROM base AS prisma-boot
WORKDIR /prisma-cli
RUN npm install prisma@6.1.0 bcryptjs@2.4.3 --ignore-scripts --no-audit --no-fund

# =============================================================================
# target: ws  — realtime + expiry worker
# =============================================================================
FROM base AS ws
ENV NODE_ENV=production \
    PORT=3002 \
    WS_PORT=3002 \
    HOSTNAME=0.0.0.0
RUN apk add --no-cache tini wget ca-certificates \
  && addgroup -S nodejs \
  && adduser -S nodejs -G nodejs
COPY --from=workspace --chown=nodejs:nodejs /app ./
COPY certs/ap-south-1-bundle.pem /ap-south-1-bundle.pem
RUN chmod 644 /ap-south-1-bundle.pem
USER nodejs
WORKDIR /app
EXPOSE 3002
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3002/health?live=1" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "--filter", "ws-server", "start"]

# =============================================================================
# target: app  — sales | admin | customer | reception (default)
# =============================================================================
FROM base AS app
ARG APP=sales
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    APP=${APP}
RUN apk add --no-cache tini wget ca-certificates \
  && addgroup -S nodejs \
  && adduser -S nextjs -G nodejs \
  && mkdir -p /app/storage \
  && chown nextjs:nodejs /app/storage
COPY --from=next-builder --chown=nextjs:nodejs /app/apps/${APP}/.next/standalone ./
COPY --from=next-builder --chown=nextjs:nodejs /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=next-builder --chown=nextjs:nodejs /app/apps/${APP}/public ./apps/${APP}/public
COPY --chown=nextjs:nodejs scripts/docker-start.cjs ./docker-start.cjs
COPY --chown=nextjs:nodejs scripts/docker-bootstrap.cjs ./docker-bootstrap.cjs
COPY certs/ap-south-1-bundle.pem /ap-south-1-bundle.pem
COPY --from=prisma-boot --chown=nextjs:nodejs /prisma-cli/node_modules/ ./node_modules/
COPY --from=next-builder --chown=nextjs:nodejs /app/packages/database/prisma ./packages/database/prisma
RUN chmod 644 /ap-south-1-bundle.pem \
  && chmod -R a+rX /app/node_modules/prisma /app/node_modules/@prisma /app/node_modules/bcryptjs /app/packages/database
USER nextjs
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3000/health?live=1" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "docker-start.cjs"]
