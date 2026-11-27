/*
 * Event envelope and topic, as defined by the shared contract written with the data plane:
 * contracts/events/evenements.schema.json (see contracts/events/README.md).
 *
 * - One topic for every event type, keyed by coop_id: `agricoop.events`.
 * - Envelope = the outbox columns (event_id, coop_id, type, created_at → occurred_at) + version;
 *   nothing else (the contract forbids additional properties).
 * - Three event types. The payload shape of each is `$defs.<type>` in the contract.
 */
export const EVENT_TYPES = ['commande_creee', 'stock_modifie', 'qr_scanne'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CURRENT_EVENT_VERSION = 1;

/** The topic consumed by the data plane (pseudonymiser, Redpanda Connect). */
export const EVENT_TOPIC = 'agricoop.events';

export interface EventEnvelope<TType extends EventType = EventType, TPayload = unknown> {
  /** UUID, equal to outbox.event_id. Consumers dedupe on it (at-least-once delivery). */
  event_id: string;
  /** Tenant; also the Kafka message key (partitioning). */
  coop_id: string;
  type: TType;
  version: typeof CURRENT_EVENT_VERSION;
  /** ISO-8601 timestamp (outbox.created_at). */
  occurred_at: string;
  payload: TPayload;
}
