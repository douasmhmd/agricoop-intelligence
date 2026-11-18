# syntax=docker/dockerfile:1.7
# Multi-stage image for the React front ends: web, backoffice.
#   docker build -f apps/docker/spa.Dockerfile --build-arg APP=web .
# Build context: repository root (spa.Dockerfile.dockerignore keeps secrets, data and node_modules
# out of it).
#
# Multi-arch: everything up to the static bundle is built once on the BUILD platform (the output is
# architecture-independent); only the nginx runtime stage is per-architecture.

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.31-alpine

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable pnpm
WORKDIR /repo

FROM base AS pruner
ARG APP
COPY . .
RUN pnpm dlx turbo@2.11.11 prune "@agricoop/${APP}" --docker

FROM base AS builder
ARG APP
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
# The generated API client is built from the shared OpenAPI contract.
COPY contracts ./contracts
RUN pnpm turbo run build --filter="@agricoop/${APP}"

# Static files served by unprivileged nginx (UID 101, port 8080), proxying /api/v1 and /qr/v1.
FROM ${NGINX_IMAGE} AS runner
ARG APP
# Keycloak client of each front end (overridable at run time with OIDC_CLIENT_ID).
ARG OIDC_CLIENT_ID=agricoop-${APP}
LABEL org.opencontainers.image.title="agricoop-${APP}" \
      org.opencontainers.image.description="AgriCoop Intelligence — ${APP} front end" \
      org.opencontainers.image.licenses="UNLICENSED"
COPY apps/docker/nginx-spa.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /repo/apps/${APP}/dist /usr/share/nginx/html
# Rendered into the nginx config at start-up (envsubst) and served as /config.js, so one image runs
# in every environment: only these variables change.
ENV API_UPSTREAM=http://api:3000 \
    CSP_EXTRA_FRAME_SRC="" \
    QR_UPSTREAM=http://qr:3001 \
    OIDC_AUTHORITY=http://localhost:8080/realms/agricoop \
    OIDC_CLIENT_ID=${OIDC_CLIENT_ID}
EXPOSE 8080
