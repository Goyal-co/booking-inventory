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
# Shared Corepack home so non-root runtime users (nodejs) do not re-download pnpm.
ENV COREPACK_HOME=/usr/local/share/corepack
# Retry apk — Alpine CDN TLS flakes on some networks (same pattern as EOI alpine base).
RUN for i in 1 2 3 4 5; do \
      apk add --no-cache libc6-compat openssl && break; \
      echo "apk retry $$i"; sleep 5; \
    done \
  && mkdir -p "$COREPACK_HOME" \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate \
  && chmod -R a+rX "$COREPACK_HOME"

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
  && pnpm --filter @booking/database db:generate \
  && mkdir -p /prisma-runtime \
  && CLIENT_PKG=$(find /app/node_modules -path '*/node_modules/@prisma/client/package.json' | head -1 | xargs dirname) \
  && PRISMA_DIR=$(find /app/node_modules -path '*/node_modules/.prisma/client' -type d | head -1) \
  && test -n "$CLIENT_PKG" && test -n "$PRISMA_DIR" \
  && cp -a "$CLIENT_PKG" /prisma-runtime/client \
  && cp -a "$PRISMA_DIR" /prisma-runtime/prisma-client \
  && test -f /prisma-runtime/prisma-client/libquery_engine-linux-musl-openssl-3.0.x.so.node

# --- Next.js standalone build ---
FROM workspace AS next-builder
ARG APP=sales
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096 \
    APP=${APP}
RUN pnpm --filter ${APP} build \
  && test -f "apps/${APP}/.next/standalone/apps/${APP}/server.js"

# Prisma CLI + client for migrate / bootstrap / runtime (Next marks them external)
FROM base AS prisma-boot
WORKDIR /prisma-cli
COPY packages/database/prisma ./prisma
# Keep in sync with lockfile Prisma major/minor used by the workspace build.
RUN npm install prisma@6.19.3 @prisma/client@6.19.3 bcryptjs@2.4.3 --no-audit --no-fund \
  && npx prisma generate --schema ./prisma/schema.prisma

# =============================================================================
# target: ws  — realtime + expiry worker
# =============================================================================
FROM base AS ws
ENV NODE_ENV=production \
    PORT=3002 \
    WS_PORT=3002 \
    HOSTNAME=0.0.0.0 \
    COREPACK_HOME=/usr/local/share/corepack
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
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=8 \
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
    APP=${APP} \
    NODE_PATH=/opt/prisma-cli/node_modules \
    PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
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
# Keep standalone node_modules intact — prisma CLI lives under /opt/prisma-cli
COPY --from=prisma-boot --chown=nextjs:nodejs /prisma-cli /opt/prisma-cli
COPY --from=next-builder --chown=nextjs:nodejs /app/packages/database/prisma ./packages/database/prisma
# Workspace-generated client + musl engine (matches Next/pnpm version)
COPY --from=workspace --chown=nextjs:nodejs /prisma-runtime/client ./node_modules/@prisma/client
COPY --from=workspace --chown=nextjs:nodejs /prisma-runtime/prisma-client ./node_modules/.prisma/client
RUN chmod 644 /ap-south-1-bundle.pem \
  && chmod -R a+rX /opt/prisma-cli /app/packages/database /app/node_modules/@prisma /app/node_modules/.prisma \
  && mkdir -p /app/node_modules/.pnpm \
  && for d in /app/node_modules/.pnpm/@prisma+client@*/node_modules; do \
       if [ -d "$d" ]; then \
         mkdir -p "$d/.prisma" "$d/@prisma"; \
         cp -a /app/node_modules/.prisma/. "$d/.prisma/"; \
         cp -a /app/node_modules/@prisma/client "$d/@prisma/"; \
       fi; \
     done \
  && test -f /app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
USER nextjs
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=8 \
  CMD wget -qO- "http://127.0.0.1:3000/health?live=1" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "docker-start.cjs"]
