# syntax=docker/dockerfile:1.7
# Multi-stage image for the Node services: api, qr, outbox-relay.
#   docker build -f apps/docker/node-service.Dockerfile --build-arg APP=api .
# Build context: repository root. Multi-arch (linux/amd64, linux/arm64) via buildx in CI.

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable pnpm
WORKDIR /repo

# 1. Keep only the target app and its workspace dependencies.
FROM base AS pruner
ARG APP
COPY . .
RUN pnpm dlx turbo@2.11.11 prune "@agricoop/${APP}" --docker

# 2. Install (cached on manifests only), build, then extract a production-only deployment.
FROM base AS builder
ARG APP
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
# Shared contracts (event JSON schemas) are inputs of @agricoop/events.
COPY contracts ./contracts
RUN pnpm turbo run build --filter="@agricoop/${APP}"
RUN pnpm --filter="@agricoop/${APP}" deploy --prod --legacy /out

# 3. Minimal runtime, non-root.
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /out ./
USER node
CMD ["node", "dist/main.js"]
