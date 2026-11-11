# Conventions — AgriCoop Intelligence

Multi-tenant SaaS for Moroccan agricultural cooperatives (PoC: olive oil sector).
How to work in this repo: the binding conventions for the application scope.

## Ownership (see `.github/CODEOWNERS`)

| Path          | Owner                    | Allowed                                                        |
|---------------|--------------------------|----------------------------------------------------------------|
| `apps/`       | Omar (apps)              | create / edit freely                                           |
| `packages/`   | Omar (apps tooling)      | create / edit freely                                           |
| `contracts/`  | **shared**, both approve | add `api/openapi.yaml` (generated), `events/*`, `db/proposals/*`. **Never edit `db/schema.sql`.** |
| `data/`       | Mohamed (data)           | **read only**                                                  |
| `infra/terraform/` | shared              | **read only**                                                  |
| `docker-compose.yml` (root) | shared     | **read only**; app services go in `docker-compose.apps.yml`   |
| `docs/`       | shared                   | append to `docs/apps-changelog.md`                             |

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
  orders/outbox → QR → backoffice → storefront → hardening). After each phase: `pnpm lint && pnpm typecheck
  && pnpm test` green, OpenAPI regenerated + Orval clients regenerated if endpoints changed, entry appended
  to `docs/apps-changelog.md`, Conventional Commit, short summary, then **stop and wait for the user**.
- Make small implementation choices yourself and note them in the changelog. Ask only for choices that
  affect `contracts/` or the data plane.

## Local dev

- Postgres from the root compose: `localhost:5433`, db/user `agricoop` (password in root compose, local only).
- `docker compose -f docker-compose.yml -f docker-compose.apps.yml up`
