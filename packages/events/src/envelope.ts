/*
 * Event envelope shared by every event published to Redpanda.
 * Contract: contracts/events/README.md and contracts/events/*.schema.json.
 */

export const EVENT_TYPES = [
  'commande_creee',
  'commande_statut_modifie',
  'stock_modifie',
  'lot_cree',
  'qr_scanne',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CURRENT_EVENT_VERSION = 1;

export interface EventEnvelope<TType extends EventType = EventType, TPayload = unknown> {
  /** UUID, equal to outbox.event_id. Consumers dedupe on it (at-least-once delivery). */
  event_id: string;
  type: TType;
  version: number;
  /** Tenant; also the Kafka message key. */
  coop_id: string;
  /** ISO-8601 timestamp (outbox.created_at). */
  occurred_at: string;
  is_synthetic: boolean;
  payload: TPayload;
}

/** Kafka topic for an event type and version: `agricoop.<type>.v<version>`. */
export function topicFor(type: EventType, version: number = CURRENT_EVENT_VERSION): string {
  return `agricoop.${type}.v${version}`;
}
