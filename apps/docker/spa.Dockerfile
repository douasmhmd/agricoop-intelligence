# syntax=docker/dockerfile:1.7
# Multi-stage image for the React front ends: web, backoffice.
#   docker build -f apps/docker/spa.Dockerfile --build-arg APP=web .
# Build context: repository root.

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.31-alpine

FROM ${NODE_IMAGE} AS base
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

# Static files served by unprivileged nginx (UID 101, port 8080), proxying /api and /qr.
FROM ${NGINX_IMAGE} AS runner
ARG APP
COPY apps/docker/nginx-spa.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /repo/apps/${APP}/dist /usr/share/nginx/html
ENV API_UPSTREAM=http://api:3000 \
    QR_UPSTREAM=http://qr:3001
EXPOSE 8080
