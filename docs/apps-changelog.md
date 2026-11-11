# apps/ changelog

Phase log for `apps/` and `packages/`. Newest entries at the bottom.

## Phases

1. Recon & plan
2. Scaffold (monorepo, packages, compose, Keycloak realm, `drizzle-kit pull`, health endpoints)
3. API core (auth, TenantGuard, `withTenant`, problem+json, logging redaction, OpenAPI export, tenant-isolation test)
4. Catalogue / lots / stock
5. Orders + outbox + relay + mock payment (incl. concurrency test)
6. QR service (generation, PDF labels, verification, anomaly rule)
7. Backoffice UI
8. Storefront UI
9. Hardening (multi-arch images, CI, Playwright, demo seed, `apps/README.md`)

---

## Phase 1 — Recon & plan (2026-11-11)

- Read `README.md`, `contracts/db/schema.sql`, root `docker-compose.yml`, `.github/CODEOWNERS`, and the
  synthetic generator notebook (to align conventions with the data plane).
- Added `docs/conventions.md` with the binding conventions.
- Findings that shape later phases:
  - The generator hashes QR tokens as `hex(sha256(base64url_no_pad_token))`; the QR service uses the same.
  - Generator device values are `Android` / `iPhone`; `scan_qr.appareil` from the app uses
    `Android` / `iPhone` / `Autre`.
  - The generator writes no `outbox` rows; only the app produces events.
  - Lot-level QR codes are legitimately scanned by many buyers in many cities, so the "> 2 cities in 24h"
    anomaly rule applies to unit-level QR codes only; lot-level codes use a higher scan-count threshold.
  - Schema gaps (envelope `version`/`is_synthetic`, customer ↔ Keycloak link) need decisions — see the
    phase 1 summary.

## Phase 2 — Scaffold (2026-11-11)

**Done**

- Monorepo: pnpm 12 workspaces + Turborepo 2, TypeScript strict, ESLint 10 flat config (type-aware,
  `no-explicit-any` + mandatory description on every `eslint-disable`), Prettier, Husky + lint-staged +
  commitlint (Conventional Commits), `.editorconfig`, `.gitattributes` (LF), `.nvmrc` (24).
- Packages:
  - `@agricoop/config`: shared tsconfigs (base / lib / nest / node / react) and ESLint config.
  - `@agricoop/shared`: domain enums mirrored from `schema.sql` CHECK constraints (a test parses
    `schema.sql` and fails on drift), order status machine, decimal.js money helpers (string on the wire),
    common Zod schemas incl. RFC 7807 problem details, log redaction rules (`LOG_REDACT_PATHS`, `redactUrl`).
  - `@agricoop/db`: Drizzle schema introspected with `drizzle-kit pull` (`pnpm db:pull`), pg pool / Drizzle
    client factory, `pingDb`.
  - `@agricoop/events`: envelope type, `topicFor()` (`agricoop.<type>.v1`), PII guard (`assertNoPii`) with
    tests, generator from `contracts/events/*.schema.json` (no schemas yet: phase 5).
  - `@agricoop/nest-kit` (**not in the original layout**): Nest pieces shared by `api` and `qr` — bootstrap,
    env parsing, pino with redaction, `/health/live` + `/health/ready` (Terminus), `/metrics` (prom-client,
    HTTP histogram labelled by route template), `DatabaseModule`, OpenAPI builder.
- Apps (all boot and answer their probes):
  - `api` (`/api/v1`, port 3000) and `qr` (`/qr/v1`, port 3001): NestJS 11 + Fastify, Swagger UI at `/docs`
    outside production.
  - `outbox-relay` (port 3002): plain Node worker with probe/metrics server and polling loop (no-op until
    phase 5); metrics `outbox_events_published_total`, `outbox_lag_seconds`, `outbox_pending_events`.
  - `web` (5173) and `backoffice` (5174): React 19, Vite 8, TanStack Router (file-based) + Query, Tailwind 4,
    shadcn/ui config, i18next FR (default) / AR with `<html dir>` flipping, Orval config + fetch mutator,
    `/healthz`.
- `pnpm contracts:openapi` exports each service's document and merges them into
  `contracts/api/openapi.yaml` (no business paths yet; probes are excluded by design).
- `docker-compose.apps.yml`: db-seed (fixed-id demo coops), Keycloak 26.8 with realm import, Redpanda
  v26.2 + Console v3.14, Mailpit; app images under the `apps` profile. Dockerfiles: `apps/docker/`.
- Keycloak realm `agricoop`: roles `customer` (default for self-registration), `reseller`, `coop_manager`,
  `saas_admin`; groups `/coops/COOP01|COOP02` carrying `tenant_id`; `tenant_id` + audience
  (`agricoop-api`) mappers; PKCE public clients for web / backoffice; `agricoop-provisioner` service account
  (manage users/groups); `agricoop-dev-cli` password-grant client for local tests only; 5 demo users.
- Schema proposals 002 (outbox envelope) and 003 (`client_compte`) written in `contracts/db/proposals/`.

**Tests:** 40 passing in 6 packages (enum drift vs schema.sql, status machine, money, log redaction, PII
guard, env parsing, api/qr health + readiness up/down + metrics, relay probes) + i18n/RTL tests in both
front ends.

**Verified manually:** api, qr and relay booted against a Postgres loaded with `schema.sql`: live 200,
ready 200, metrics OK, Swagger UI OK; a `/qr/v1/verify/<token>` request is logged with the token and
forwarded IP redacted. Demo-coop seed is idempotent.

**Not verified (Docker Desktop's engine did not start on this machine):** `docker compose up`, the
Keycloak realm import (including the `${ENV:default}` placeholders and the `tenant_id` claim coming from
the group attribute), Redpanda, and the Dockerfiles (`pnpm deploy --legacy` under pnpm 12). To be checked
first thing in phase 3.

**Choices made**

- NestJS 11.2 instead of 12, TypeScript 6.0 instead of 7 (ecosystem peer ranges, see `docs/conventions.md`).
- `prom-client` kept as specified, but it is now deprecated in favour of `@prometheus-io/client` (0.x);
  revisit in phase 9.
- api and qr share one origin: `/api/v1` and `/qr/v1` prefixes, merged into a single `openapi.yaml`.
- Demo coops get fixed UUIDs so Keycloak group attributes can carry `tenant_id` statically; `COOP01`
  matches the generator's coop (it upserts on `code`).
- Customers/resellers have no `tenant_id` claim; storefront tenant comes from `/coops/:code` (decision 2,
  proposal 003).
- Known peer warning: `@nestjs/schematics` wants chokidar 4, `@swc/cli` wants 5 (CLI tooling only).

## Phase 3 — API core (2026-11-11)

**Phase 2 leftovers verified (Docker up)**

- `docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d`: Postgres, db-seed (COOP01/COOP02
  with fixed ids), Keycloak 26.8 (realm imported, `${ENV:default}` placeholders substituted), Redpanda
  (healthy, topic auto-creation on), Console, Mailpit all up.
- Real Keycloak tokens: managers carry `tenant_id` from their coop group; customers / resellers / admin have
  none; `aud` contains `agricoop-api`; `iss` is `http://localhost:8080/realms/agricoop`.
- Images: `agricoop/web` builds; `agricoop/api` builds and runs (non-root `node`, Node 24, internal JWKS URL,
  real token accepted). Size 376 MB — slimming planned for phase 9.

**Done**

- `packages/db`: `withTenant(db, coopId, fn)` — transaction + `set_config('app.coop_id', …, true)` +
  `TenantScope` (`list`, `findOne`, `select`, `insert`, `update`, `delete`, `owns`) that adds
  `coop_id = :coopId` everywhere, forces it on insert and can never change it on update.
- `contracts/db/proposals/001_rls.sql`: RLS on all business tables (`client_pii` via `client`), roles
  `agricoop_app` / `agricoop_relay`, public-read `cooperative`, `qr_lookup()` SECURITY DEFINER. Enabled but
  **not forced**: the owner (`agricoop`, used by the synthetic generator) is unaffected.
- `packages/nest-kit`:
  - `AccessGuard` (single global guard): JWT via `jose` + JWKS (RS256, issuer, audience, 30 s skew) →
    `@Roles` → tenant (`tenant_id` claim; `saas_admin` + `X-Coop-Id`, validated, must exist, audit-logged).
    Decorators `@Public`, `@NoTenant`, `@Roles`, `@CurrentUser`.
  - `RequestContext` (AsyncLocalStorage) set by an interceptor; `TenantDb` service.
  - `ProblemDetailsFilter`: RFC 7807 for every error (`AppProblem` codes, Zod validation errors by path,
    500s without details, `WWW-Authenticate` on 401, query strings dropped from `instance`).
  - Global `ZodValidationPipe` + `ZodSerializerInterceptor`, `ThrottlerGuard` (300/min default).
  - OpenAPI normalization: clean schema names, explicit 2xx required, `4XX`/`5XX` → `ProblemDetails`,
    fails on dangling `$ref`; operation ids `<Controller>_<method>`.
- `apps/api`: `GET /api/v1/me` (no tenant), `GET /api/v1/produits`, `GET /api/v1/produits/{id}`
  (`coop_manager`; read side of the catalogue — the vehicle for the isolation tests; CRUD in phase 4).
- `packages/testing` (dev-only, **new**): Testcontainers Postgres 16 loaded with `schema.sql`, optionally
  with proposal 001 and a non-owner app role; in-memory RS256 issuer.
- `pnpm contracts:openapi` now exports api + qr only, merges, then regenerates the Orval clients.
- Front ends: Orval mutator returns `{ data, status, headers }` (Orval 8 fetch contract) and throws
  `ApiError` with the problem details on non-2xx; generated hooks `useMeGet`, `useProduitsList`,
  `useProduitsGet`.

**Tests:** 85 passing. Mandatory tenant-isolation suite (`apps/api/test/tenant-isolation.int.test.ts`),
14 cases × {without RLS, with RLS}: own rows only, cross-tenant 404, no `coop_id` in responses,
`X-Coop-Id` spoofing → 403, admin override (header required / UUID / must exist), role checks, 401 for
missing / foreign-signed / expired / wrong-audience / wrong-issuer tokens, coop_id forced on insert and
immutable on update, and — with RLS only — a raw query that forgot the predicate still sees only its tenant.
Plus problem-filter and Orval-mutator unit tests.

**Verified manually:** built api against the compose Postgres + real Keycloak: 401 / 403 / 200 cases,
tenant mismatch, admin override with audit log line, no tokens or passwords in logs.

**Choices made**

- One composite guard instead of separate Auth/Roles/Tenant guards: fixed order, one place to audit.
- Unauthenticated `X-Coop-Id` from a non-admin is rejected (403) rather than ignored.
- `saas_admin` passes every `@Roles` check but must always name a tenant.
- Health readiness returns Terminus' own body on 503 (not problem+json), as probes expect.
- API JSON keeps the schema's snake_case French field names.
