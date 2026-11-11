# Event contract (v1)

> **Status: DRAFT v1 — pending review by the data plane (CODEOWNERS of `contracts/`).**
> Written by apps in phase 4. Field names and semantics are open for discussion until the
> Redpanda Connect → Azure pipeline consumes them; after that, changes follow the versioning rules below.

The operational plane (apps) publishes business events to Redpanda through a **transactional outbox**:
each event is inserted into `outbox` in the same database transaction as the business change, and
`apps/outbox-relay` publishes it.

## Topics

| Event type                | Topic                                  | Emitted when                                         |
|---------------------------|----------------------------------------|------------------------------------------------------|
| `commande_creee`          | `agricoop.commande_creee.v1`           | an order is placed (with its lines)                  |
| `commande_statut_modifie` | `agricoop.commande_statut_modifie.v1`  | an order changes status                              |
| `stock_modifie`           | `agricoop.stock_modifie.v1`            | a `mouvement_stock` row is written (one event each)  |
| `lot_cree`                | `agricoop.lot_cree.v1`                 | a production lot is created                          |
| `qr_scanne`               | `agricoop.qr_scanne.v1`                | a QR code is scanned on the public verification page |

- **Message key:** `coop_id` → all events of one cooperative are ordered within a partition.
- **Value:** UTF-8 JSON, one envelope per message (below). JSON Schema (draft 2020-12) per type:
  `contracts/events/<type>.v1.schema.json` (`#/$defs/payload` is the payload alone).
- **Delivery:** at-least-once. Consumers **must deduplicate on `event_id`**.
- **Order:** guaranteed per `coop_id` key for events published by one relay in commit order
  (`outbox.created_at`); do not rely on cross-cooperative ordering.

## Envelope

```json
{
  "event_id": "uuid — outbox.event_id, dedup key",
  "type": "lot_cree",
  "version": 1,
  "coop_id": "uuid — tenant, also the message key",
  "occurred_at": "2026-11-11T10:00:00.000Z — outbox.created_at (UTC)",
  "is_synthetic": false,
  "payload": { "…": "type-specific, see the schema" }
}
```

`is_synthetic` is `true` only for events produced by the demo seed; filter it out of real analytics.
(Until schema proposal 002 is merged, the relay sets `version = 1` and `is_synthetic = false`.)

## Payload conventions

- **No personal data, ever (Law 09-08 / CNDP).** Payloads carry IDs (`client_id`, `produit_id`,
  `lot_id`, …), non-personal client attributes from the `client` table (`type_client`, `ville`),
  quantities and amounts. Never `client_pii` fields, names, phone numbers, e-mails, addresses, IP
  addresses or identity-provider subjects. Display names are not carried either (no `nom` key):
  join on IDs in the analytics plane. Enforced by `assertValidPayload` (packages/events) at write
  time and by a contract test over these schemas.
- **Money:** strings with 2 decimals at most (`"75.00"`), MAD. Never JSON numbers.
- **Dates:** `date` = `YYYY-MM-DD`; timestamps = ISO-8601 UTC (`date-time`).
- Field names match `contracts/db/schema.sql` column names (French, snake_case).
- `additionalProperties: false` everywhere: producers cannot add undeclared fields.

## Semantics worth knowing

- `stock_modifie` is emitted for **every** stock movement, with `stock_apres` (stock of the lot after
  the movement) and `motif`: `creation_lot` (initial `entree`), `commande` (`sortie`),
  `annulation_commande` (compensating `entree`), `perte`. Summing `quantite` by `type_mouvement`
  reproduces the operational stock.
- `commande_creee.lignes` may contain several lines for the same product when the order was allocated
  across several lots (FEFO).
- `commande_statut_modifie` is emitted for each transition `creee → payee → expediee → livree` and for
  `annulee` (from `creee` / `payee`).
- `qr_scanne.resultat` is `alerte` when `alertes` is non-empty: `qr_inactif` (QR deactivated or
  flagged), `lot_perime`, `scans_multiples` (too many scans), `villes_multiples` (more than 2 cities
  in 24 h, unit-level QR codes only).

## Versioning

- Additive, optional changes may be made within v1 after agreement.
- Any breaking change (removing / renaming a field, changing a type or meaning) creates
  `<type>.v2.schema.json` and a new topic `agricoop.<type>.v2`; v1 keeps being published during the
  migration window.

## Tooling

- `packages/events` generates TypeScript types from these files (`pnpm --filter @agricoop/events generate`)
  and validates payloads at runtime (Ajv, draft 2020-12).
