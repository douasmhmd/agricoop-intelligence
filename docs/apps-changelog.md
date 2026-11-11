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
