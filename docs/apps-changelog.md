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

## Phase 4 — Catalogue, lots, stock (2026-11-11)

**Done**

- **Event contract v1 (draft, needs data-plane review):** `contracts/events/<type>.v1.schema.json` for all
  five types + `contracts/events/README.md` (topics, key, envelope, delivery, PII rules, versioning).
  `packages/events` now generates TS types **and** embeds the schemas; `assertValidPayload` (PII guard +
  Ajv draft 2020-12) and `assertValidEvent` (full envelope). Contract tests: one schema per type, identical
  envelopes, no PII field name anywhere.
- `packages/db`: `lotsWithStock` (lot + product + computed stock, `count(*) over()` total), `lotStock`,
  `lockLotForStock` (row lock), `TenantScope.list` (typed, `forUpdate`).
- `packages/shared`: catalogue / lot / stock DTO schemas, `syntheticFilter`, Morocco calendar helpers
  (`isoDateInZone`, `addDays`, `daysBetween`, `isExpired`, `defaultDatePeremption`, `toIsoTimestamp`).
- `packages/nest-kit`: `CLOCK` (injectable time), `appendEvent` (transactional outbox),
  `isUniqueViolation` / `isForeignKeyViolation`.
- API (`coop_manager`, all tenant-scoped):
  - `GET/POST /produits`, `GET/PATCH/DELETE /produits/{id}` — margin (`marge_mad`, `marge_pct`) computed
    with decimal.js; filters `famille`, `actif`, `synthetic`; 409 `produit_code_existe`,
    `niveau_qr_verrouille` (product has lots), `produit_utilise` (delete → deactivate instead).
  - `GET/POST /lots`, `GET /lots/{id}`, `GET /lots/{id}/mouvements`, `POST /lots/{id}/pertes` — lot creation
    writes the `entree` movement, `unite` rows 1..N (`generate_series`) for unit-level QR products and the
    `lot_cree` + `stock_modifie` events in one transaction; default expiry = fabrication + conservation_j;
    paginated list with `statut` (`disponible` / `epuise` / `perime`) and `synthetic` filters; losses lock the
    lot and return 409 `stock_insuffisant`.
  - `GET /stock/alertes-peremption?jours=30|60|90` — lots with stock, expired or expiring, bucketed
    `perime` / `j30` / `j60` / `j90`.

**Tests:** 136 passing. New `apps/api/test/catalogue-stock.int.test.ts` (17 cases × {without RLS, with
RLS}): CRUD + validation + margin, smuggled `coop_id` ignored, cross-tenant 404s on products and lots,
default expiry, unit rows, uniqueness / date / inactive-product errors, `niveau_qr` lock, status filters
and pagination, expiry buckets with a pinned clock, **concurrent losses** (10 × 3 on a lot of 20 →
exactly 6 succeed, final stock 2, `stock_apres` 17…2), and every outbox row validated as a v1 envelope
with one `stock_modifie` per movement.

**Choices made**

- A lot is expired **on** its `date_peremption` (same rule as the synthetic generator).
- Lot status precedence: stock 0 → `epuise`, else expired → `perime`, else `disponible`.
- One `stock_modifie` event per movement, with `stock_apres` and a `motif`, so the data plane can rebuild
  stock from the stream.
- Payloads carry IDs and codes, never display names (`nom` is a forbidden key).
- Business "today" is the Africa/Casablanca date, through an injectable clock.
- `generate` is now a Turbo task (it raced when lint / typecheck / test regenerated in parallel).
- Backend `vitest.config` files renamed to `.mts` (Vite native config loader warning).

## Phase 5 — Orders, payments, outbox relay (2026-11-11)

**Done**

- **Storefront (public, tenant = `/coops/:code`):** `GET /coops`, `GET /coops/{code}`,
  `GET /coops/{code}/produits` (active products, price, orderable stock of non-expired lots; no cost or
  margin).
- **Storefront orders (customer / reseller):** `POST /coops/{code}/commandes`, `GET …/commandes`,
  `GET …/commandes/{id}`, `POST …/commandes/{id}/annulation`. Placement is one transaction: all candidate
  lots locked in a single global order (`date_peremption, lot_id`) → FEFO allocation (pure, all-or-nothing,
  expired lots skipped) → client upsert → `commande` + one `ligne_commande` and one `sortie` per
  (product, lot) → `commande_creee` + one `stock_modifie` per movement. 409 `stock_insuffisant` lists
  `manquants`. Resellers get `canal = revendeur` / `type_client = revendeur` (same convention as the
  synthetic generator), customers `canal = web`.
- **Account linking:** one `client` per person and cooperative, created at the first order there.
  Links on Keycloak `sub` via `client_compte` when proposal 003 is applied (auto-detected), otherwise on
  the token's **verified** e-mail = `client_pii.email` (403 `email_non_verifie` if not verified).
- **Back office (`coop_manager`):** `GET /commandes` (paginated, totals computed in SQL NUMERIC,
  `statut` / `canal` / `synthetic` filters), `GET /commandes/{id}` (with delivery details from
  `client_pii`), `POST /commandes/{id}/statut`.
- **Status machine:** `creee → payee → expediee → livree`, `annulee` from `creee` / `payee` with compensating
  `entree` movements (lots re-locked in the same global order); every change emits
  `commande_statut_modifie`; 409 `transition_invalide` with `de` / `vers`. Idempotent for replays.
- **Payments:** `PaymentGateway` port + `CmiMockGateway` — hosted mock page
  (`/coops/{code}/paiements/mock/{id}`), signed form callback (`…/paiements/cmi/callback`,
  HMAC-SHA512 with a per-cooperative store key), amount must equal the order total (409
  `montant_incorrect`), `creee → payee` exactly once, then redirect to `/coops/{code}/commandes/{id}?paiement=ok|refuse`.
- **Notifications:** `NotificationProvider` port; e-mail via SMTP (Mailpit), SMS / WhatsApp stubbed in
  logs; order confirmation after payment, sent after commit, never logging addresses or numbers.
- **Outbox relay:** `FOR UPDATE SKIP LOCKED` batches → KafkaJS (idempotent, acks = all, Java-compatible
  partitioner, key = `coop_id`, headers `event_id` / `type` / `version`) → mark `publie` in the same
  transaction (at-least-once); invalid events → `agricoop.dead_letter.v1` **without payload**; topics
  created at startup if missing; metrics `outbox_events_published_total`,
  `outbox_events_dead_lettered_total`, `outbox_lag_seconds`, `outbox_pending_events`; readiness includes
  Redpanda. Reads `to_jsonb(outbox)` so proposal 002 columns are used as soon as they exist.
- `contracts/events/README.md`: dead-letter topic documented.

**Tests:** 185 passing.

- `apps/api/test/commandes.int.test.ts` (18 cases × {without RLS, with RLS}): catalogue, FEFO across lots
  skipping expired ones, exact `stock_apres` per movement, no PII in any event (keys and values),
  all-or-nothing 409, inactive / foreign products, resellers, unverified e-mail, client reuse and order
  privacy, back-office totals and details, forged / foreign-store / wrong-amount callbacks, payment once +
  notification, mock-page redirect, status machine, single restock on cancellation,
  **15 parallel orders on a lot of 10 → exactly 10 succeed, stock 0**, and **20 concurrent two-product
  orders with opposite line order → no deadlock**.
- `apps/api/test/client-compte.int.test.ts`: linking on `sub` once proposal 003 is applied.
- `apps/outbox-relay/test/relay.int.test.ts` (4 cases × {without RLS, with RLS as `agricoop_relay`},
  real Redpanda): envelopes valid and keyed by `coop_id`, drained = no-op, dead letter without payload,
  failed publish → rows kept and retried, **3 concurrent relays publish 40 events exactly once**.
- `packages/shared`: FEFO allocator unit tests.

**Verified manually:** a real Keycloak access token for `client.demo` carries `email` +
`email_verified: true`, so e-mail linking works with the realm as configured.

**Choices made**

- The mock gateway's decision endpoint can mark any order paid: it exists only with the mock provider
  (`PAYMENT_PROVIDER=cmi-mock`) and must never be enabled in production.
- No payment table: idempotency comes from the status machine, the amount from `ligne_commande`
  (decision 3 of phase 1).
- Customers can cancel their own order while `creee` or `payee` (refund is the provider's job).
- Storefront shows synthetic cooperatives' products too (demo data is synthetic).

## Phase 6 — QR authenticity service (2026-11-11)

**Done** (`apps/qr`, all under `/qr/v1`)

- **Tokens:** 16 random bytes, base64url without padding; only `hex(sha256(token))` is stored — verified
  byte-for-byte against Python `hashlib` (the generator's convention).
- **Generation + labels (`coop_manager`):** `POST /lots/{lotId}/qr-codes[?regenerer=true]` issues one
  code per lot or one per `unite` (following `produit.niveau_qr`), under a row lock on the lot, and
  returns the printable **A4 PDF** (3 × 8 labels: QR of `${WEB_PUBLIC_URL}/v/<token>`, product, lot,
  serial number, expiry, cooperative). The PDF is the only copy of the clear tokens; printing twice →
  409 `qr_deja_generes` unless regenerating (old codes deactivated). Max `QR_MAX_LABELS` (5000) per call.
- **Public verification:** `GET /verify/{token}` — shape check, hash, cross-tenant lookup through
  `qr_lookup()` when RLS proposal 001 is applied (auto-detected) or a plain query otherwise, then inside
  the tenant: row lock on the code, scan recorded (city from the trusted `x-agricoop-city` / `cf-ipcity`
  header only, device class `Android` / `iPhone` / `Autre`, **no IP**), anomaly evaluation, `qr_scanne`
  event, `Cache-Control: no-store`. Unknown codes → 404 `qr_inconnu`. Rate limit
  `QR_VERIFY_RATE_PER_MIN` (30) per client. Metric `qr_verifications_total{resultat}`.
- **Anomaly rules** (`anomaly.ts`, configurable): `qr_inactif` (status not `actif`), `lot_perime`,
  `scans_multiples` (unit code > 5 scans; lot code > 2 × lot size), `villes_multiples` (unit code in
  > 2 cities within 24 h). Codes are **not** auto-flagged: a suspicious scan is reported in the response,
  > the event and the back office; the manager decides.
- **Back office (`coop_manager`):** `GET /qr-codes` (per-code scan count, cities, last scan, current
  alerts; filters `lot_id`, `statut`), `GET/PATCH /qr-codes/{id}` (deactivate / flag / reactivate),
  `GET /qr-codes/{id}/scans`, `GET /scans/villes?jours=` (per-city counts, `Inconnue` when no city).
- Front-end fetch mutator returns a `Blob` for `application/pdf`.

**Tests:** 31 QR integration tests (15 cases × {without RLS, with RLS} + rate limit) — PDF and rows per
unit / per lot, print-twice refusal and regeneration, **no clear token anywhere in qr_code / outbox /
scan_qr** (but every hash present), authentic scan recorded without the forwarded IP, valid `qr_scanne`
event, unknown and malformed tokens, city / count / lot-size / expiry rules, deactivation, cross-tenant
404s, scan history and per-city stats, 429 after the budget; plus 9 unit tests (tokens, hash convention,
anomaly rule, device / city parsing).

**Verified manually:** rendered a 26-label sheet and checked it visually (2 pages, 24 per page, French
accents, serial numbers).

**Choices made**

- Re-printing requires regenerating (tokens are unrecoverable by design).
- The city comes only from an edge header; the IP lookup is a stub until a GeoIP database is chosen
  (the IP is never retained either way).
- Label text is French only: built-in PDF fonts cannot render Arabic (needs an embedded font).
- Lot-level codes use a count threshold relative to lot size and no city rule, because many buyers
  legitimately scan the same lot code.

## Phase 7 — Back-office UI (2026-11-12)

**Done**

- **API additions**
  - `GET /previsions/versions`, `GET /previsions?version_modele&depuis&jusqua&synthetic` (`coop_manager`):
    weekly forecasts per famille from the analytics write-back next to actual weekly sales (non-cancelled
    order lines), latest model version by default.
  - `GET/POST /admin/cooperatives` (`saas_admin`, no tenant): creates the tenant row and, in the same
    transaction, its Keycloak group `/coops/<CODE>` (`tenant_id` = coop_id) and first `coop_manager`
    account through the `IdentityAdmin` port (Keycloak Admin API, in-memory double in tests); invitation
    e-mail (set password + verify e-mail). Identity failure → nothing created (DB rollback + Keycloak
    cleanup of user and group). 409 `coop_code_existe` / `gestionnaire_existe`, 502 `idp_indisponible`.
- **Back office (`apps/backoffice`)**: React 19 + TanStack Router/Query + Orval hooks + shadcn/ui +
  React Hook Form/Zod (same schemas as the API) + Recharts.
  - Keycloak sign-in (PKCE, tokens in sessionStorage, silent renew, return to the requested page);
    access limited to `coop_manager` / `saas_admin`.
  - Header: coop switcher for `saas_admin` (sent as `X-Coop-Id`, cache dropped on switch), global
    synthetic-data toggle (default on, remembered; rows carry a "Synthétique" badge), FR / AR.
  - Pages: dashboard (to ship, to pay, expired, expiring ≤ 30 d, recent orders, alerts); products (CRUD,
    margins, active switch, delete with translated 409s); lots (status tabs, pagination, creation with
    default-expiry hint) and lot detail (movements, loss entry, **QR label PDF download** with
    regenerate confirmation); expiry alerts 30 / 60 / 90; orders (filters, detail with lines, delivery
    details, allowed status actions); QR codes (alerts, deactivate / flag / reactivate, scan history,
    scans per city bar chart); forecasts (Recharts, forecast vs sales per famille, model version
    selector, sales-only notice); platform admin (coops list, create coop + manager).
  - i18n: ~170 keys FR + AR (Arabic plurals), Zod's built-in messages follow the UI language, API
    problems translated by `code`; charts stay LTR inside RTL pages.

**Bugs found by testing in the browser and against the real Keycloak (all fixed)**

- `positiveMoneyString` crashed on malformed input (Zod 4 runs refinements after a failed regex;
  decimal.js threw) — the API would have answered 500 instead of 400. Regression test added.
- Arabic layout: the sidebar slid off-screen on desktop (`rtl:translate-x-full` beat `lg:translate-x-0`).
- Reloading `/qr` hit the QR service: the dev proxy (and the nginx template) matched `/qr*`. Proxies now
  forward only `/api/v1/` and `/qr/v1/`.
- Deep links were lost after sign-in (always redirected to `/`).
- Keycloak 26.8 Admin API rejected the provisioner's tokens (401, missing admin-API audience): the realm
  export now gives `agricoop-provisioner` the built-in `kc-admin-api` client scope.
- Role lookup `GET /roles/coop_manager` needs `view-realm` (403): replaced by the user-scoped
  available-roles endpoint; and a failure after user creation left an orphan account — compensation now
  deletes the user too.
- The shadcn CLI generated `import { cn } from "cn"` (an unrelated npm package) and added `next-themes`:
  both removed.
- ~~Data-plane note: the Postgres image's tzdata is stale for Africa/Casablanca.~~ **Wrong — corrected in
  phase 8:** Morocco moved to permanent UTC+0 on 2026-09-20 (tzdb 2026c). Postgres was right; the local
  Node 22.22 (tz data 2026a) was stale.

**Tests:** API `test/previsions-admin.int.test.ts` (6 cases × {without RLS, with RLS}: versions per tenant,
Morocco-week alignment incl. a Sunday-23:30-UTC order, cancelled orders excluded, version selection,
synthetic exclusion, admin-only access, provisioning with the new coop_id, duplicate code / manager,
identity failure rollback). Back office: 15 unit tests (translations complete in FR and AR, problem codes
translated in both languages, synthetic preference, `X-Coop-Id` only when chosen, `ok()`, safe return
path). Lint, typecheck and all test suites green.

**Verified manually**

- Real sign-in through Keycloak as `manager.coop02`, dashboard and pages with live data, Arabic RTL layout
  (sidebar on the right), deep link `/qr` preserved through sign-in.
- Platform admin against the real Keycloak: COOP03 created, group `/coops/COOP03` carries the new
  coop_id, manager in the group with `coop_manager` and the set-password / verify-email actions,
  duplicate manager e-mail → 409 with no leftovers, invitation e-mail received in Mailpit.
  (COOP03 and its manager now exist in the local dev database / Keycloak.)

**Not covered yet:** Playwright end-to-end tests (phase 9). Custom validation messages written in the
shared Zod schemas stay in French in the Arabic UI.

## Phase 8 — Storefront UI (2026-11-12)

**Done**

- Back office fix (user report): in Arabic the header switch thumb sat outside its track; the thumb now
  translates in the inline direction (`rtl:data-[state=checked]:-translate-x-…`).
- `apps/web` storefront (React 19, TanStack Router + Query, Orval hooks, shadcn/ui, FR / AR RTL):
  - Coops list, per-coop catalogue (stock-aware quantity stepper, add to cart), cart page.
  - Cart: client-side, one cooperative per cart (orders are per tenant); adding from another coop asks
    to replace the cart. Kept in `localStorage`, totals with decimal.js.
  - Checkout (sign-in required, PKCE via Keycloak client `agricoop-web`): delivery details validated
    with the shared `coordonneesSchema`, order placed through `/coops/:code/commandes`, redirect to the
    mock payment page; a 409 lists the products that are short.
  - Order page: payment result (`?paiement=ok|refuse`), status steps, pay now, cancel while allowed.
  - Account page: the customer's orders per coop.
  - `/v/:token`: public QR verification — "Authentique", "Attention" (flagged / deactivated / anomaly)
    or unknown code; fetched exactly once (a reload counts a new scan, a refocus does not).
  - Toasts at the bottom: at the top they covered the header cart / account buttons on phones.
- `mockPaymentPath()` in `@agricoop/shared` (used by the API gateway and the storefront).
- Keycloak realm: `verifyEmail: true` for self-registered customers (also applied to the running realm).

**Time zone correction**

- Morocco moved to **permanent UTC+0 on 2026-09-20** (IANA tzdb 2026c). The local Node 22.22 ships tz
  data 2026a and still applies UTC+1; Node 24 images (2026e) and Postgres are right.
- `@agricoop/nest-kit` logs a warning at boot when `process.versions.tz` predates 2026c.
- Tests that depend on Casablanca offsets now use instants before 2026-09-20, so they pass on any tz
  data version.

**Tests:** web 15 (cart operations, FR/AR translation completeness with plural forms, `/v/:token`
rendered through the router with a single verify call), nest-kit tz data check. All suites: shared 32,
events 15, outbox-relay 11, nest-kit 9, qr 45, api 116, backoffice 15, web 15. Lint and typecheck green;
OpenAPI unchanged.

**Verified manually (phone viewport 375×812)**

- COOP02 catalogue → cart (250,00 MAD) → sign-in → checkout → mock payment approved → order page shows
  "Paiement accepté" (status `payee`).
- `/v/<token>` shows "Authentique" with the scan recorded (appareil `Android`); Arabic RTL rendering.
  (A COOP02 test order and a demo QR code now exist in the local dev database.)

**Not covered yet:** Playwright end-to-end tests (phase 9).

## Phase 9 — Hardening (2026-11-12)

**Done**

- Container images (`apps/docker`):
  - Multi-arch `linux/amd64` + `linux/arm64`. Install and build run once on the build platform and
    only the runtime layer is per-architecture: a two-platform build of `api` or `web` takes about
    30 s locally (no emulated `pnpm install`). The arm64 `api` image was run under emulation: Node
    24.22.3, tz data 2026e.
  - Build context filtered by `node-service.Dockerfile.dockerignore` / `spa.Dockerfile.dockerignore`.
    Before, `COPY . .` sent `.env`, `data/` and `node_modules` to the builder.
  - Node runtime: app files owned by root and read-only for the `node` user; OCI labels.
  - Front ends: runtime configuration served as `/config.js` (`OIDC_AUTHORITY`, `OIDC_CLIENT_ID`), so
    one image runs in every environment (it was documented in `src/config.ts` but never wired).
    Content-Security-Policy, `Permissions-Policy`, `server_tokens off`; security headers repeated in
    every location (nginx drops inherited `add_header`s in a location that sets its own).
- `docker-compose.apps.yml`, app services: healthchecks, `init`, `no-new-privileges`, all capabilities
  dropped, read-only root file system with a `/tmp` tmpfs for the Node services; the front ends wait
  for healthy `api` and `qr`; the API gets the Keycloak Admin API settings (platform admin).
- Demo seed `apps/dev/seed/002_demo_catalogue.sql` (COOP02 only, `is_synthetic = true`, idempotent,
  dates relative to the seeding day): 6 products, 9 lots incl. one expiring within 30 days and one
  expired, stock movements, 3 orders allocated FEFO, 2 demo QR codes (authentic / flagged).
  `pnpm db:seed` re-runs the seed files.
- Playwright (`apps/e2e`): storefront happy path on a phone viewport (catalogue → cart → Keycloak
  sign-in at checkout → mock payment → order paid; QR check authentic and unknown) and back-office
  happy path (sign-in → product → lot → ship the order just paid). Every page fails the test on a CSP
  violation. `pnpm e2e`.
- CI `.github/workflows/apps-ci.yml` (path filter `apps/**`, `packages/**`, `contracts/**`):
  format, lint, typecheck, tests, OpenAPI / generated client drift check; the five images built for
  amd64 + arm64 with the GitHub Actions cache (no push); e2e on the Compose stack with reports and logs
  uploaded on failure. Checked with actionlint (incl. shellcheck).
- `apps/README.md`: prerequisites, both ways to run, URLs, demo users and data, checks, e2e, images,
  CI.

**Bugs found (all fixed)**

- The front-end images never started: `log_format` was inside `server {}` (nginx only allows it in
  `http`). Found by running the images for the first time.
- The `api` image would not start from Compose: images run with `NODE_ENV=production`, where the API
  refuses the built-in dev payment secret that Compose passed by default. Compose now passes
  `COMPOSE_PAYMENT_MOCK_SECRET` (local default).

**Tests:** shared 32, events 15, outbox-relay 11, nest-kit 9, qr 45, api 116, backoffice 15, web 15 —
258 green, plus 3 Playwright tests green against the app **images** (two consecutive green runs). One
combined lint + typecheck + test run had an outbox-relay suite error at start-up, with the whole stack
running beside it; it did not reproduce in the next two full runs (Testcontainers start-up under load).

**Not verified:** the workflow has not run on GitHub yet (no remote in this repository); its steps
were run locally (checks, contract drift, multi-arch builds, Compose stack + Playwright) and the file
passes actionlint.

**Local state:** the stack now runs from the app images (`--profile apps`) on the usual ports; the
`pnpm dev` servers were stopped. COOP02 has the demo seed plus the e2e orders and products.

## UI redesign — phase 1: design system (2026-11-13)

Brief: premium "Moroccan olive oil" look for the storefront and back office, with motion; FR + AR
(RTL), light + dark; no change to business logic, API, routes, auth or existing i18n keys.

**Done**

- New package `@agricoop/ui` (TypeScript source, consumed by both Vite apps):
  - Tokens (`theme.css`, Tailwind v4 `@theme`, OKLCH): brand scales olive / gold / terracotta / sand,
    semantic tokens kept under the shadcn names (so existing screens restyle without code changes),
    warm dark theme, layered warm shadows, radii 8–20px, fluid display scale (`text-display-sm…2xl`,
    `clamp()`), easing tokens incl. a CSS `linear()` spring, brand utilities `zellige`, `grain`,
    `arch`, `glass`, `hairline-gold`.
  - Fonts, self-hosted with `font-display: swap`: Fraunces (display, optical sizing), Manrope (UI),
    IBM Plex Sans Arabic + Noto Kufi Arabic (reached through the font stacks, so Arabic text switches
    face automatically and the Arabic files load only when Arabic is rendered).
  - `motion.ts`: durations, easings, springs, `fade`, `fadeUp`, `scaleIn`, RTL-aware
    `slideInFromStart/End`, `stagger`, `wordReveal`, `revealViewport`, `inlineOffset()`.
  - `ThemeProvider` (light / dark / system, remembered), `MotionProvider` (`reducedMotion="user"`),
    `useDirection()`.
  - Components: Button (gold variant, pill shape, 44px `lg`), Input, Textarea, Label, Card
    (`interactive`), Badge (status dot, success/warning/info/gold/terracotta, striped `synthetic`),
    Dialog (spring open), Sheet (logical sides), Table (sticky header, hairline rows), Skeleton
    (shimmer), Tabs (sliding indicator), DropdownMenu (logical spacing), Switch (RTL), Toaster (brand,
    follows theme and direction), BrandMark, Ornament, ZelligeBackdrop, ThemeToggle.
  - Tests: theme persistence and resolution, RTL offsets, class merging, and WCAG AA for 20 token
    pairs × 2 themes computed from `theme.css` (it caught a light focus ring at 2.8:1, fixed to ≥ 3:1).
- Both apps now import their UI components from `@agricoop/ui` (local shadcn copies removed), load the
  fonts, wrap the app in `ThemeProvider` + `MotionProvider`, and apply the saved theme before first
  paint (`public/theme-init.js`, allowed by the CSP).
- Language switcher (both apps): segmented pill with a sliding indicator; short endonyms (FR / ع) on
  phones, full names kept as accessible labels.
- Back office `/styleguide`: colours, scales, type scale, buttons, fields, badges, cards, tabs, table
  with skeleton rows and row menu, dialog, sheets, dropdown, toasts, motion presets (replayable),
  textures. Not in the navigation.
- Visual review tooling: `pnpm --filter @agricoop/e2e screenshots` (Playwright) captures pages at
  1440px and 390px, light and dark, FR and AR, and fails on horizontal overflow.

**Tests:** all suites green (ui 45 incl. 40 contrast checks, plus the existing suites), Playwright
e2e 3/3 against the redesigned UI with no selector change.

**Not done yet (next phases):** page layouts themselves (header, hero, catalogue, cart drawer, QR
page, dashboard shell, command palette, charts); Lenis, cmdk, vaul, Embla and NumberFlow are added
when their components are built (phases 2–4).

## UI redesign — phase 2: storefront header, home, footer (2026-11-13)

**Done**

- Header: fixed; transparent over the hero, then a frosted glass bar with a soft shadow once the page
  scrolls (always glass on other pages). Desktop navigation to the home sections with a gold underline
  on hover, language switch, sign-in / account, cart with a gold count badge that bounces when an item
  is added. Mobile: an animated menu (top sheet, staggered links, language and theme controls).
- Hero (full height): gold eyebrow, serif headline revealed word by word, two CTAs with
  micro-interactions, trust points, the olive grove in a Moroccan arch with a parallax and a gold arch
  outline drifting the other way, floating glass chips, scroll cue.
- Home sections: "Notre histoire" (harvest photo in an arch, live figures counting up with
  NumberFlow: cooperatives, products, provinces), featured products carousel (Embla, swipe/drag,
  RTL-aware, controls disabled at the ends, hover zoom and reveal), category tiles (arch photos, zoom,
  sliding panel; each leads to the coop with the most products of that kind, pre-filtered),
  "Authenticité garantie par QR" on a deep olive band (three steps, animated phone scanning a QR code,
  drawn checkmark), cooperative cards from the live catalogues (families, product count, lowest price),
  newsletter, rich footer (zellige band, links, language and theme, demo and photo credits).
- Catalogue page: optional `?groupe=huile|olives|soins|coffrets` filter with a chip to clear it (used by
  the category tiles; the catalogue itself is redesigned in phase 3).
- Lenis smooth scrolling (storefront only, off with reduced motion, paused under overlays).
- Imagery: Unsplash placeholder photos (free licence, credited in the footer) via `src/lib/images.ts`;
  `<Picture>` in `@agricoop/ui` gives stable aspect ratios, lazy loading, blur-up and a branded fallback.
  CSP `img-src` allows `https://images.unsplash.com`; the hero photo is preconnected and loads eagerly.
- Translations: ~80 new keys in FR and AR (Arabic plural forms included).

**Fixes found while reviewing the screenshots**

- The screenshot helper did not wait for lazy photos or for the scan animation: it now waits for every
  `<Picture>` and for the longest in-view sequence.
- Two products of the same category showed the same photo: photos now alternate by rank.
- White titles on light category photos lacked contrast: stronger gradient.

**Tests:** web 20 (5 new: category groups, featured selection alternating coops, tile targets, exact
lowest price, photo variants); the router test now mounts the same providers as the app. All suites
green, Playwright e2e 3/3 unchanged, home page checked in the nginx image under the production CSP (no
violations). Screenshots: `apps/e2e/screenshots/redesign/phase2/`.

**Open point:** the newsletter has no backend. Making it real needs an API endpoint (and a consent
record), so it currently shows an honest "opening soon" message and stores nothing.

## UI redesign — phase 3: catalogue, product page, cart, checkout, QR page (2026-11-13)

**Done**

- Catalogue (`/coops/:code`): coop header band (arch monogram, province, product count), filter chips
  with a sliding active pill (`?groupe=`), 2–4 column grid with animated filtering and skeleton cards.
  Product cards: second photo on hover, quick "Ajouter" sliding up (always visible on touch screens),
  animated price, availability, QR-per-unit badge, stretched link to the product page.
- Product page (new route `/coops/:code/produits/:produitId`): Embla gallery with thumbnails
  (RTL-aware), sticky buy box (animated price, stock dot, quantity stepper, gold "Ajouter au panier"),
  accordion (description, origin and cooperative, traceability by lot / by unit, reference), "Du même
  producteur". The card image morphs into the gallery with the View Transitions API (Motion
  `layoutId` fallback); route changes cross-fade (`defaultViewTransition`), none with reduced motion.
- Cart: drawer opened by the header cart (side sheet on desktop, Vaul bottom sheet with drag-to-close
  on phones) with animated add/remove lines, thumbnails and an animated total; the thumbnail flies
  from the product to the cart icon on add (arc, transform/opacity only). `/panier` restyled for
  direct visits. Cart lines remember the product category for thumbnails (optional fields: carts
  saved before keep working).
- Checkout: journey indicator (Panier → Livraison → Paiement → Confirmation, gold line growing),
  delivery form card and sticky summary, pay button with spinner. Order page: success card with a
  drawn checkmark and a small confetti burst after payment, animated status timeline, badges with
  status dots.
- QR verification `/v/:token`: scanning animation while loading; authentic → a gold 8-point seal
  turning into place with a drawn checkmark, then the product card with photo and details; warning →
  pulsing shield, each alert with its own icon, and calm advice; unknown code → clear shield and
  advice. Same texts as before (tests unchanged).
- Empty / 404 / error states: zellige medallions, an arch with a serif "404" / "!", retry on errors;
  restyled loading (breathing olive mark), sign-in gate and account page.
- `@agricoop/ui`: Accordion (fade + lift, no height animation). Storefront: `Price` (NumberFlow on
  money strings), `CheckoutSteps`, `Confetti`, `ProductCard`, `useAddToCart`, fly-to-cart layer.
- A second soap photo (green olive soap) so soap products alternate.

**Bug found by the e2e test (fixed)**

- The quick "Ajouter" button could not be clicked: the card image wrapper carries a
  `view-transition-name`, which makes it a stacking context, so the button's `z-index` stayed under
  the card's stretched link. The button now sits outside that wrapper.

**Fixes found while reviewing the screenshots**

- On phones the "added to cart" toast covered the drawer's checkout button: opening the drawer now
  dismisses toasts.
- Prices forced to LTR rendered "د.م." differently from static prices: they now follow the page
  direction like `formatMad`.
- The paid order showed step 4 as "in progress": the indicator now has a completed state.

**Tests:** all suites green; Playwright e2e 3/3 with no selector change (the storefront journey now
goes through the drawer and the new checkout). New visual capture of the purchase journey
(`visual/flows.visual.ts`: drawer, checkout, paid order). Every phase-3 page loaded in the nginx image
under the production CSP: no violation. Screenshots: `apps/e2e/screenshots/redesign/phase3/`.

**Limits (API, not UI):** product pages cannot show lot or expiry dates (the public catalogue has
none; the QR page shows them), and product photos are per category until products have their own.
