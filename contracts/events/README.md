# Event contract

**Source of truth: [`evenements.schema.json`](evenements.schema.json)** (JSON Schema 2020-12),
written by the data plane. Both planes validate against this same file:

- apps: `@agricoop/events` (types generated from it, Ajv validation before writing to the outbox and
  again in `apps/outbox-relay` before publishing);
- data plane: `data/pipelines/relais_outbox.py`, `pseudonymiseur.py`, `simuler_commandes.py`.

The operational plane writes business events to the `outbox` table in the **same database
transaction** as the business change; a relay publishes them to Redpanda.

## Topic and message

| | |
|---|---|
| Topic | `agricoop.events` (all event types) |
| Key | `coop_id` (all events of one cooperative stay ordered in one partition) |
| Value | UTF-8 JSON envelope (below) |
| Delivery | at least once: consumers deduplicate on `event_id` |

Downstream, `data/pipelines/pseudonymiseur.py` republishes to `agricoop.events.pseudo` with the
client identifier replaced by a keyed token, and writes the bronze layer.

## Envelope

Exactly these fields (`additionalProperties: false`):

| Field | From | Notes |
|---|---|---|
| `event_id` | `outbox.event_id` | UUID |
| `coop_id` | `outbox.coop_id` | tenant, message key |
| `type` | `outbox.type` | `commande_creee`, `stock_modifie`, `qr_scanne` |
| `version` | constant | `1` |
| `occurred_at` | `outbox.created_at` | ISO 8601 |
| `payload` | `outbox.payload` | shape per type: `$defs.<type>` |

## Event types (what the apps emit)

| Type | Written by | When |
|---|---|---|
| `commande_creee` | api | an order is placed (all lines, FEFO lot per line) |
| `stock_modifie` | api | every `mouvement_stock` row: lot creation (`entree`), order (`sortie`), cancellation (`entree`), loss (`perte`) |
| `qr_scanne` | qr | every scan of the public verification page (never the token) |

Order status changes (paid, shipped, delivered, cancelled) and lot creation have no event of their
own in this contract; their stock effects are `stock_modifie` events. Adding types is a contract
change agreed by both planes (CODEOWNERS), with a new `version`.

## Rules

- **No personal data**: never `nom`, `telephone`, `email`, `adresse` (or aliases) in a payload. The
  apps refuse to write such a payload (`assertNoPii`); the relays refuse to publish it.
- Amounts are JSON numbers with two decimals at most (`prix_unitaire_mad`); the apps compute them
  with decimal arithmetic and only convert at the boundary.
- An outbox row that does not match the contract is never published to `agricoop.events`:
  `apps/outbox-relay` sends it, **without payload**, to `agricoop.events.dead_letter`; the Python
  relay leaves it in the outbox and reports it.
- Run **one** relay at a time against a database (they are interchangeable: same topic, envelope
  and validation; `FOR UPDATE SKIP LOCKED` keeps them from publishing the same row twice).
