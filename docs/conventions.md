# Conventions — AgriCoop Intelligence

Multi-tenant SaaS for Moroccan agricultural cooperatives (PoC: olive oil sector).
How to work in this repo: the binding conventions for the application scope.

## Ownership (see `.github/CODEOWNERS`)

| Path                        | Owner                    | Allowed                                                                                           |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `apps/`                     | Omar (apps)              | create / edit freely                                                                              |
| `packages/`                 | Omar (apps tooling)      | create / edit freely                                                                              |
| `contracts/`                | **shared**, both approve | add `api/openapi.yaml` (generated), `events/*`, `db/proposals/*`. **Never edit `db/schema.sql`.** |
| `data/`                     | Mohamed (data)           | **read only**                                                                                     |
| `infra/terraform/`          | shared                   | **read only**                                                                                     |
| `docker-compose.yml` (root) | shared                   | **read only**; app services go in `docker-compose.apps.yml`                                       |
| `docs/`                     | shared                   | append to `docs/apps-changelog.md`                                                                |

## Hard rules

1. **`contracts/db/schema.sql` is the source of truth. Never edit it.** Schema changes are written as
   `contracts/db/proposals/NNN_<name>.sql` (with a rationale header) and flagged to the user. Code must
   work against `schema.sql` as it is today; a proposal may only be relied on once the user says it is merged.
2. **Tenancy.** Every business table has `coop_id`. Every query is scoped to the caller's tenant through
   `withTenant(coopId, fn)` from `packages/db` (sets `app.coop_id` with `set_config(..., true)` and injects
   `coop_id` into every select/update/delete/insert). Business code **never** reads `coop_id` from a request
   body. Cross-tenant access returns **404**, not 403. Code must work with and without RLS (proposal 001).
   - `client_pii` has no `coop_id`: always reach it through a join on `client` scoped by tenant.
   - `saas_admin` may target a tenant via `X-Coop-Id` (audited log line). Everyone else is locked to their own.
   - Public endpoints resolve the tenant from `/coops/:code/...` or from the QR record.
3. **Personal data (Law 09-08 / CNDP).** `client_pii` fields (`nom`, `telephone`, `email`, `adresse`) never
   appear in outbox payloads, events, logs, metrics labels, analytics or error messages. Events reference
   `client_id` and non-personal `client` fields (`type_client`, `ville`) only. pino redaction paths cover these
   keys plus `authorization`, `cookie`, tokens. No IP address is ever stored.
4. **`is_synthetic`.** Rows written by the app are `is_synthetic = false`. Synthetic rows come from
   `data/synthetic-factory` (coop `COOP01`). The demo seed script (phase 9) writes `is_synthetic = true`.
   The backoffice has a global show/hide-synthetic toggle (default: show) and a visible badge.
5. **Money** (`NUMERIC(10,2)`, MAD) is a string on the wire and a `Decimal` (`decimal.js`) in code.
   Never `Number`/float arithmetic on money. `prevision.quantite_prevue` (`NUMERIC(12,2)`) likewise.
6. **QR tokens.** 128-bit random (`crypto.randomBytes(16)`), base64url **without padding**.
   `token_hash = lowercase hex(sha256(utf8(token_string)))` — same convention as the synthetic generator.
   The clear token exists only in the generated label output; never stored, never logged.
7. **Naming.** Domain terms stay French as in the schema (`commande`, `lot`, `produit`, `mouvement_stock`…).
   Code identifiers (other than domain nouns), comments, commit messages are English.
8. **No `any`** without a `// justification:` comment. No secrets in code; use `.env.example`.

## Stack (fixed)

- Node.js 24 LTS, pnpm workspaces, Turborepo, TypeScript `strict`, ESLint flat config + Prettier,
  Husky + lint-staged, Conventional Commits.
- Backend (`apps/api`, `apps/qr`, `apps/outbox-relay`): NestJS on Fastify, Drizzle ORM + `pg`
  (schema **introspected** with `drizzle-kit pull` into `packages/db`; Drizzle never runs migrations),
  Zod via `nestjs-zod`, `@nestjs/swagger` → `contracts/api/openapi.yaml` (`pnpm contracts:openapi`),
  Keycloak OIDC validated with `jose` + JWKS (claim `tenant_id`; realm roles `customer`, `reseller`,
  `coop_manager`, `saas_admin`), KafkaJS → Redpanda via transactional outbox, `nestjs-pino`, `prom-client`
  (`/metrics`), `@nestjs/terminus` (`/health/live`, `/health/ready`), `@nestjs/throttler`.
  Errors are RFC 7807 `application/problem+json`.
- External integrations sit behind interfaces with mock adapters: `PaymentGateway` (CMI-style mock),
  `NotificationProvider` (Mailpit email; SMS/WhatsApp logged), `IdentityAdmin` (Keycloak Admin API).
- Front ends (`apps/web`, `apps/backoffice`): React 19 + Vite, TanStack Router + Query, **Orval-generated**
  client from `contracts/api/openapi.yaml` (no hand-written fetch), Tailwind + shadcn/ui, React Hook Form +
  Zod schemas from `packages/shared`, i18next FR (default) + AR (RTL, use logical CSS properties
  `ms-/me-/ps-/pe-`, never `ml-/mr-`), `oidc-client-ts` + `react-oidc-context` (PKCE), Recharts (backoffice).
  Storefront is mobile-first.
- Tests: Vitest (unit), Supertest + Testcontainers (Postgres 16 loaded with `schema.sql`, Redpanda),
  Playwright (one happy path per front end).
- Containers: multi-stage, non-root, multi-arch `linux/amd64` + `linux/arm64`.

## Domain rules to remember

- Stock of a lot = Σ`entree` − Σ`sortie` − Σ`perte` (computed, never stored). Must never go negative.
- Lot creation → `mouvement_stock(entree, quantite_initiale)`; if `produit.niveau_qr = 'unite'` also `unite` rows 1..N.
  Default `date_peremption = date_fabrication + conservation_j`.
- Order placement is one transaction: lock candidate lots `FOR UPDATE` (ordered by `date_peremption, lot_id`
  to avoid deadlocks), FEFO allocation skipping expired lots, insert `commande` + `ligne_commande` (with
  `lot_id`, possibly several lines per product when split across lots) + `mouvement_stock(sortie)` + outbox
  `commande_creee`. Insufficient stock → rollback + 409.
- Status machine: `creee → payee → expediee → livree`; `annulee` from `creee`/`payee` only, writing
  compensating `entree` movements. Every transition → outbox `commande_statut_modifie`.
- `qr_code`: exactly one of `lot_id` / `unite_id` set, matching `niveau`.

## Events

- Types v1: `commande_creee`, `commande_statut_modifie`, `stock_modifie`, `lot_cree`, `qr_scanne`.
- Envelope: `{ event_id, type, version, coop_id, occurred_at, is_synthetic, payload }`; JSON Schema per type in
  `contracts/events/<type>.v1.schema.json`, documented in `contracts/events/README.md`.
- Topic `agricoop.<type>.v1`, key = `coop_id`, at-least-once (consumers dedupe on `event_id`).
- The event contract is consumed by the data plane (Redpanda Connect → Azure): changing it needs the
  teammate's approval. A unit test fails if any PII key appears in a payload.

## Workflow

- Work in the phases listed in `docs/apps-changelog.md` (recon → scaffold → API core → catalogue/stock →
  orders/outbox → QR → backoffice → storefront → hardening).
- After each phase: `pnpm lint`, `pnpm typecheck` and `pnpm test` are green; `pnpm contracts:openapi`
  re-run if endpoints changed (Orval clients regenerate automatically before front-end tasks); entry
  appended to `docs/apps-changelog.md`; Conventional Commit on the feature branch; short summary; then
  **stop and wait for the user**.
- Make small implementation choices yourself and note them in the changelog. Ask only for choices that
  affect `contracts/` or the data plane.

## Repo mechanics (learned in phase 2)

- **Versions pinned on purpose:** NestJS **11.2** (not 12: `nestjs-zod` and `@nestjs/terminus` cap at
  Nest 11) and TypeScript **6.0** (not 7: `typescript-eslint` caps at `<6.1`). Re-check before bumping.
- **pnpm 12:** build-script allow-list is `allowBuilds` in `pnpm-workspace.yaml`; installs may append
  `minimumReleaseAgeExclude` entries (keep them). Turbo needs `pnpm` on PATH (corepack shim).
- **Workspace packages** (`packages/*`) are built with tsup to ESM + CJS; Nest apps are CommonJS built by
  the Nest CLI with SWC (`nest-cli.json`). Do not set `rootDir` in `apps/*/tsconfig.build.json` (the Nest
  CLI then stops stripping `src/` and emits `dist/src/`).
- **`packages/nest-kit`**: shared Nest bootstrap (`configureApp`), env parsing, pino redaction, health,
  metrics, `DatabaseModule` (`DB_POOL`, `DB`), OpenAPI builder. Use explicit `@Inject(token)` in it.
- **Routing:** api under `/api/v1`, qr under `/qr/v1` (one origin behind the ingress / Vite proxy).
  `/health/live`, `/health/ready`, `/metrics` stay at the root and are excluded from OpenAPI.
- **Drizzle schema:** `pnpm db:pull` regenerates `packages/db/src/generated` (snake_case column names
  preserved; NUMERIC / DATE / TIMESTAMPTZ come back as strings). Never edit the generated files.
- **Front ends:** file-based TanStack routes (`src/routeTree.gen.ts` is generated and committed);
  `@/` → `src/`; the only `fetch` is `src/api/fetcher.ts` (Orval mutator).

## Writing an endpoint (api / qr)

- Access rules are declarative, enforced by the single global `AccessGuard` (nest-kit):
  - default: authenticated **and** tenant required (token `tenant_id`, or `X-Coop-Id` for `saas_admin`);
  - `@Roles('coop_manager', ...)`: any-of; `saas_admin` always passes (and must send `X-Coop-Id`);
  - `@NoTenant()`: authenticated, no tenant (e.g. `/me`, storefront routes keyed by `/coops/:code`);
  - `@Public()`: no auth at all (public catalogue, QR verification, probes).
    Every user also has the `customer` role (Keycloak default role): check `reseller` before `customer`.
- Data access: inject `TenantDb` and use `tenantDb.run((scope) => scope.list / findOne / insert /
update / delete ...)`. Raw `scope.tx` queries (joins, aggregates) must add `scope.owns(table)` for
  every tenant table. `tenantDb.runAs(coopId, ...)` is only for public flows that resolved the tenant
  themselves. Another tenant's row is a **404**, never a 403.
- DTOs: Zod schemas in `packages/shared` (no `.meta({ id })`), `class XDto extends createZodDto(...)`,
  `@ZodResponse({ status: 200, description, type })` — an explicit 2xx status is mandatory (the OpenAPI
  export fails otherwise). Responses are validated and stripped by `ZodSerializerInterceptor`.
- Errors: throw `Problems.*` / `new AppProblem(status, code, title, detail)`; `code` is stable and
  translated by the front ends; `detail` never contains personal data.
- Then `pnpm contracts:openapi` (exports api + qr, merges into `contracts/api/openapi.yaml`, regenerates
  Orval clients; operation ids are `<Controller>_<method>` → hooks like `useProduitsList`).
- Tests: `*.int.test.ts` boot the real module against Testcontainers Postgres (`@agricoop/testing`) with a
  local JWT issuer; tenant-sensitive features get a case in both `{ rls: false }` and `{ rls: true }`.
  Pin time with `createTestApp(db, issuer, { clock })`; business code reads time only through `CLOCK`
  and `today(clock)` (Africa/Casablanca date).
- **Stock:** never stored. Read it with `lotsWithStock` / `lotStock` (packages/db). Any operation that
  changes a lot's stock must call `lockLotForStock(scope, lotId)` first (row lock) and write exactly one
  `mouvement_stock` row + one `stock_modifie` event per movement. A lot is expired ON its
  `date_peremption` (`isExpired`), same rule as the synthetic generator.
- **Events:** `appendEvent(scope, type, payload)` inside the same `tenantDb.run` as the business write
  (it validates against `contracts/events/<type>.v1.schema.json` and rejects PII). To change a payload,
  edit the JSON schema first (contract owned with the data plane), then `pnpm --filter @agricoop/events
generate` regenerates the TS types.
- **Orders:** placement = one `tenantDb.runForCode` transaction: `lockLotsForAllocation` (all candidate
  lots locked in global `date_peremption, lot_id` order → no deadlocks) → `allocateFefo` (all or
  nothing; 409 `stock_insuffisant` with `manquants`) → client upsert → commande + one ligne and one
  `sortie` per (product, lot) → events. Status changes go through `CommandesService.transition()`
  (row lock, `canTransition`, restock on `annulee`, `commande_statut_modifie`); it is idempotent by
  default (payment callbacks may be replayed).
- **Storefront accounts:** `ClientsService` links a Keycloak user to its per-coop `client`: on `sub`
  via `client_compte` when proposal 003 is applied (auto-detected), otherwise on the token's
  VERIFIED e-mail = `client_pii.email`. `client_pii` is written/read only there.
- **Payments:** `PaymentGateway` port (`CmiMockGateway`: per-coop HMAC store key, signed form
  callback at `/coops/:code/paiements/cmi/callback`, mock hosted page). Notifications go through
  `NotificationProvider` after commit; never log addresses or phone numbers.
- **Relay:** `relayBatch` claims rows with `FOR UPDATE SKIP LOCKED`, publishes, then marks `publie`
  in the same transaction (at-least-once); invalid events → `agricoop.dead_letter.v1` without payload.
- Unique violations: catch and map with `isUniqueViolation(error, '<constraint>')` → `Problems.conflict`.

## Local dev

- `cp .env.example .env`, then
  `docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d` (infra: Postgres 5433,
  Keycloak 8080, Redpanda 19092, Console 8088, Mailpit 8025) and `pnpm dev`.
  Add `--profile apps` to also run the app images.
- Demo coops `COOP01` / `COOP02` have fixed ids (`apps/dev/seed`), matching the Keycloak group
  attribute `tenant_id`. Demo users are listed in `.env.example`.
