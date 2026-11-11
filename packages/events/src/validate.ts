import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { EventType } from './envelope.js';
import {
  type CommandeCreeePayloadV1,
  type CommandeStatutModifiePayloadV1,
  EVENT_SCHEMAS,
  type LotCreePayloadV1,
  type QrScannePayloadV1,
  type StockModifiePayloadV1,
} from './generated/index.js';
import { assertNoPii } from './pii.js';

/** Payload type of each event type (v1), generated from contracts/events. */
export interface EventPayloads {
  commande_creee: CommandeCreeePayloadV1;
  commande_statut_modifie: CommandeStatutModifiePayloadV1;
  stock_modifie: StockModifiePayloadV1;
  lot_cree: LotCreePayloadV1;
  qr_scanne: QrScannePayloadV1;
}
export type EventPayload<T extends EventType> = EventPayloads[T];

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const schema of Object.values(EVENT_SCHEMAS)) ajv.addSchema(schema);

const payloadValidators = new Map<EventType, ValidateFunction>();
const eventValidators = new Map<EventType, ValidateFunction>();

function validatorFor(type: EventType, pointer: string, cache: Map<EventType, ValidateFunction>) {
  let fn = cache.get(type);
  if (!fn) {
    const schema = EVENT_SCHEMAS[type];
    fn = ajv.getSchema(`${schema.$id}${pointer}`);
    if (!fn) throw new Error(`No JSON schema for event type ${type}`);
    cache.set(type, fn);
  }
  return fn;
}

export class InvalidEventError extends Error {
  constructor(
    readonly eventType: string,
    readonly problems: string[],
  ) {
    // Paths and keywords only — never the offending values.
    super(`Invalid ${eventType} event: ${problems.join('; ')}`);
    this.name = 'InvalidEventError';
  }
}

function describe(fn: ValidateFunction): string[] {
  return (fn.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? e.keyword}`);
}

/**
 * Checks a payload before it is written to the outbox: no personal data keys (Law 09-08), and
 * conformity to contracts/events/<type>.v1.schema.json (#/$defs/payload).
 */
export function assertValidPayload<T extends EventType>(type: T, payload: EventPayload<T>): void {
  assertNoPii(payload);
  const fn = validatorFor(type, '#/$defs/payload', payloadValidators);
  if (!fn(payload)) throw new InvalidEventError(type, describe(fn));
}

/** Validates a full envelope as published on Redpanda (used by the relay and contract tests). */
export function assertValidEvent(event: { type: EventType } & Record<string, unknown>): void {
  const type = event.type;
  const fn = validatorFor(type, '', eventValidators);
  if (!fn(event)) throw new InvalidEventError(type, describe(fn));
}
