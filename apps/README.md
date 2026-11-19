# AgriCoop Intelligence — applications

The application side of the platform: storefront, back office, business API, QR authenticity service
and the outbox relay that streams business events to Redpanda for the data plane.

| App            | What it is                                                  | Dev port | Path prefix |
| -------------- | ----------------------------------------------------------- | -------- | ----------- |
| `web`          | Storefront (mobile-first) and public QR check `/v/:token`   | 5173     | —           |
| `backoffice`   | Cooperative back office and platform admin                  | 5174     | —           |
| `api`          | Business API: catalogue, lots, stock, orders, payments, admin | 3000   | `/api/v1`   |
| `qr`           | QR codes: generation, PDF labels, public verification, anomalies | 3001 | `/qr/v1`    |
| `outbox-relay` | `outbox` table → topics `agricoop.<type>.v1`                | 3002     | —           |
| `e2e`          | Playwright happy paths (storefront and back office)         | —        | —           |

Shared code lives in `packages/` (`shared`, `db`, `events`, `nest-kit`, `testing`, `config`). The
contracts (database schema, OpenAPI, event schemas) live in `contracts/` and are shared with the data
plane: see `docs/conventions.md` for the rules.

## Prerequisites

- **Node 24** (`.nvmrc`) with corepack: `corepack enable`. Node 24 matters: Morocco has been on
  permanent UTC+0 since 2026-09-20 and older runtimes (e.g. Node 22.22, tz data 2026a) still apply
  UTC+1. The services log a warning at start-up when the tz data is too old.
- **pnpm 12** (pinned in `package.json`, installed by corepack).
- **Docker** with Compose v2 (Docker Desktop on Windows / macOS).

## Run it

```bash
cp .env.example .env          # local-only values
pnpm install
```

### Option A — develop (hot reload)

Infrastructure in containers, apps on the host:

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --wait
pnpm dev
```

### Option B — the whole stack in containers

The same images as in production, built locally:

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml --profile apps up -d --build --wait
```

Both options use the same ports (stop one before starting the other).

### Where things are

| URL                                | What                                         |
| ---------------------------------- | -------------------------------------------- |
| http://localhost:5173              | Storefront                                   |
| http://localhost:5174              | Back office                                  |
| http://localhost:3000/docs         | API Swagger UI (dev mode only)               |
| http://localhost:3001/docs         | QR service Swagger UI (dev mode only)        |
| http://localhost:8080              | Keycloak (admin: `KC_ADMIN_USER` / `KC_ADMIN_PASSWORD`) |
| http://localhost:8088              | Redpanda Console (topic `agricoop.events`)   |
| http://localhost:8025              | Mailpit (e-mails sent by the apps)           |
| `localhost:5433`                   | Postgres (root `docker-compose.yml`)         |

### Demo users and data

Demo users (password `KC_DEMO_PASSWORD` from `.env`): `manager.coop01`, `manager.coop02` (cooperative
managers), `client.demo` (customer), `revendeur.demo` (reseller), `admin.saas` (platform admin).

**Shared seed (recommended).** The data plane provides a dump of the whole database (COOP01: three
campaigns of synthetic sales, stock, QR scans, plus forecasts, customer segments and QR alerts from
their models). Load it into the local database (replaces everything in it):

```bash
pnpm db:restore -- <path/to/agricoop_seed.dump>
```

It then re-adds the apps' demo cooperative COOP02 and the analytics grants. Sign in as
`manager.coop01` to see the data plane's data.

The `db-seed` service runs `apps/dev/seed/*.sql` on every `up` (idempotent). Re-run it any time:

```bash
pnpm db:seed
```

- `001_demo_coops.sql`: COOP01 (if missing; its id is the one in the shared dump) and COOP02, with
  the ids used by the Keycloak realm.
- `002_demo_catalogue.sql`: for **COOP02** only, a catalogue, lots (one expiring within 30 days, one
  expired), stock movements, three orders and two demo QR codes. All rows are `is_synthetic = true`.
  COOP01 is left to the synthetic generator (`data/synthetic-factory`), which owns all its rows.
- Demo QR codes: http://localhost:5173/v/DemoToken1234567890Abc (authentic) and
  http://localhost:5173/v/DemoTokenSignale000001 (flagged by the cooperative).

Payments use a CMI-style mock: checkout redirects to a local page where you approve or decline.

### Analytics (data plane gold layer)

The back office's analytics endpoints (`/api/analytics/*`, contract `contracts/api/analytics.yaml`)
read the data plane's `gold` views as the read-only role `analytics_reader`. Build the layer once
(and again after the data plane changes `data/bi/`):

```bash
pnpm db:gold
```

It creates the notebooks' ML tables if missing (they stay empty until the data plane runs
`data/ml/*.ipynb`) and runs `data/bi/01..04_*.sql` unchanged.

### Events

The apps write `commande_creee`, `stock_modifie` and `qr_scanne` events to the outbox following the
data plane's contract (`contracts/events/evenements.schema.json`); `outbox-relay` publishes them to
the `agricoop.events` topic. The data plane's own tools (`data/pipelines/`: Python relay,
pseudonymiser, order simulator) work on the same outbox and topic: run one relay at a time.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test                 # unit + integration tests (Testcontainers: Docker must be running)
pnpm format:check
```

After changing an endpoint, regenerate the OpenAPI contract and the front-end clients:

```bash
pnpm contracts:openapi
```

### End-to-end tests

They run against a running stack (option A or B) with the demo seed:

```bash
pnpm --filter @agricoop/e2e e2e:install   # once: Playwright's Chromium
pnpm e2e
```

- Storefront (phone viewport): browse COOP02, add to cart, sign in as `client.demo` at checkout, pay
  with the mock, see the order paid; check a demo QR code and an unknown one.
- Back office: sign in as `manager.coop02`, create a product and a lot, ship the order just paid.
- Every page is also checked for Content-Security-Policy violations.

Each run adds an order and a product to COOP02 (as a real user would: `is_synthetic = false`). Failure
reports: `pnpm --filter @agricoop/e2e e2e:report`.

## Container images

`apps/docker/node-service.Dockerfile` (api, qr, outbox-relay) and `apps/docker/spa.Dockerfile` (web,
backoffice), built from the repository root:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -f apps/docker/node-service.Dockerfile --build-arg APP=api -t agricoop/api .
```

- Multi-stage, multi-arch (`linux/amd64`, `linux/arm64` for Ampere nodes). The dependency install and
  build run once on the build machine's architecture; only the small runtime layer is per-architecture.
- Non-root: Node images run as `node`, front ends on `nginx-unprivileged` (UID 101, port 8080). The
  compose file also drops all capabilities, forbids privilege escalation and makes the Node
  containers' root file system read-only.
- `<Dockerfile>.dockerignore` keeps `.env`, `data/` and `node_modules` out of the build context.
- Front ends are configured at start-up, so one image serves every environment:

  | Variable         | Default                                 |
  | ---------------- | --------------------------------------- |
  | `OIDC_AUTHORITY` | `http://localhost:8080/realms/agricoop` |
  | `OIDC_CLIENT_ID` | `agricoop-web` / `agricoop-backoffice`  |
  | `API_UPSTREAM`   | `http://api:3000`                       |
  | `QR_UPSTREAM`    | `http://qr:3001`                        |

  nginx serves them as `/config.js`, proxies `/api/v1/` and `/qr/v1/`, and sets a strict
  Content-Security-Policy plus the usual security headers. Access logs carry no client IP (law 09-08).
- Probes: Node services expose `/health/live`, `/health/ready` and `/metrics`; front ends `/healthz`.
- Services refuse to start in production with development secrets (e.g. `PAYMENT_MOCK_SECRET`).

## CI

`.github/workflows/apps-ci.yml` runs on changes to `apps/**`, `packages/**` or `contracts/**`:

1. **checks**: format, lint, typecheck, tests (incl. Testcontainers), and a contract drift check
   (`pnpm contracts:openapi` must not change any committed file).
2. **images**: the five images built for `linux/amd64` and `linux/arm64` (not pushed yet).
3. **e2e**: the whole stack started with Compose, then the Playwright happy paths. Reports and
   container logs are uploaded when it fails.

## Further reading

- `docs/conventions.md`: conventions and rules (tenancy, PII, money, events, time zone).
- `contracts/events/README.md`: the event contract consumed by the data plane.
- `contracts/db/proposals/README.md`: proposed schema changes (RLS, outbox envelope, customer accounts).
- `docs/apps-changelog.md`: what was built, phase by phase.
