# syntax=docker/dockerfile:1.7
# Multi-stage image for the Node services: api, qr, outbox-relay.
#   docker build -f apps/docker/node-service.Dockerfile --build-arg APP=api .
#   docker buildx build --platform linux/amd64,linux/arm64 -f apps/docker/node-service.Dockerfile --build-arg APP=api .
# Build context: repository root (node-service.Dockerfile.dockerignore keeps secrets, data and
# node_modules out of it).
#
# Multi-arch: the pruner and builder stages run on the BUILD platform. Their output (/out) is plain
# JavaScript because no production dependency ships a native addon, so only the small runtime stage is
# per-architecture and arm64 builds need no slow emulated `pnpm install`. If a production dependency
# with a native addon is ever added, drop `--platform=$BUILDPLATFORM` from the two stages below.

ARG NODE_IMAGE=node:24-alpine

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS base
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

# 3. Minimal runtime for the TARGET platform: non-root, no package manager, no sources.
FROM ${NODE_IMAGE} AS runner
ARG APP
LABEL org.opencontainers.image.title="agricoop-${APP}" \
      org.opencontainers.image.description="AgriCoop Intelligence — ${APP} service" \
      org.opencontainers.image.licenses="UNLICENSED"
ENV NODE_ENV=production
WORKDIR /app
# Owned by root and read-only for the app user: the process cannot rewrite its own code.
COPY --from=builder /out ./
USER node
# Probes: GET /health/live and /health/ready on $PORT (set per service).
CMD ["node", "dist/main.js"]
