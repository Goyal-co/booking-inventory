# syntax=docker/dockerfile:1.7
# WebSocket / expiry worker for Booking_Inventory.
#   docker build -f Dockerfile.ws -t goyal-booking-ws .
#   docker run --env-file .env.production -p 3002:3002 goyal-booking-ws

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY apps/ws-server/package.json apps/ws-server/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/email/package.json packages/email/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/pdf/package.json packages/pdf/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY packages/validators/package.json packages/validators/package.json
COPY packages/ecosystem-contracts/package.json packages/ecosystem-contracts/package.json
COPY packages/config-typescript/package.json packages/config-typescript/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/ ./
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @booking/database db:generate

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3002 \
    WS_PORT=3002 \
    HOSTNAME=0.0.0.0
RUN apk add --no-cache tini wget ca-certificates \
  && addgroup -S nodejs \
  && adduser -S nodejs -G nodejs
COPY --from=builder --chown=nodejs:nodejs /app ./
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
