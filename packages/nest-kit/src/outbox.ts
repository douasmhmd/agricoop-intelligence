import { outbox, type TenantScope } from '@agricoop/db';
import { assertValidPayload, type EventPayload, type EventType } from '@agricoop/events';

/**
 * Transactional outbox: writes an event in the SAME transaction as the business change, so it is
 * published if and only if the change commits. The payload is checked first — no personal data,
 * conformity to contracts/events/<type>.v1.schema.json — and an invalid payload aborts the transaction.
 *
 * Returns the event_id.
 */
export async function appendEvent<T extends EventType>(
  scope: TenantScope,
  type: T,
  payload: EventPayload<T>,
): Promise<string> {
  assertValidPayload(type, payload);
  const row = await scope.insert(outbox, { type, payload });
  return row.event_id;
}
