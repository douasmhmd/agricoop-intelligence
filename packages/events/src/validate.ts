import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { EventType } from './envelope.js';
import {
  type CommandeCreeePayload,
  EVENT_CONTRACT,
  type QrScannePayload,
  type StockModifiePayload,
} from './generated/index.js';
import { assertNoPii } from './pii.js';

/** Payload type of each event type, generated from contracts/events/evenements.schema.json. */
export interface EventPayloads {
  commande_creee: CommandeCreeePayload;
  stock_modifie: StockModifiePayload;
  qr_scanne: QrScannePayload;
}
export type EventPayload<T extends EventType> = EventPayloads[T];

// allowUnionTypes: the contract uses `"type": ["string", "null"]` with a format.
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
ajv.addSchema(EVENT_CONTRACT);

const payloadValidators = new Map<EventType, ValidateFunction>();

function payloadValidator(type: EventType): ValidateFunction {
  let fn = payloadValidators.get(type);
  if (!fn) {
    fn = ajv.getSchema(`${EVENT_CONTRACT.$id}#/$defs/${type}`);
    if (!fn) throw new Error(`No payload schema for event type ${type}`);
    payloadValidators.set(type, fn);
  }
  return fn;
}

const eventValidator = (): ValidateFunction => {
  const fn = ajv.getSchema(EVENT_CONTRACT.$id);
  if (!fn) throw new Error('Event contract not loaded');
  return fn;
};

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
 * conformity to the shared contract (`$defs.<type>` of contracts/events/evenements.schema.json).
 */
export function assertValidPayload<T extends EventType>(type: T, payload: EventPayload<T>): void {
  assertNoPii(payload);
  const fn = payloadValidator(type);
  if (!fn(payload)) throw new InvalidEventError(type, describe(fn));
}

/** Validates a full envelope as published on Redpanda (used by the relay and contract tests). */
export function assertValidEvent(event: { type: string } & Record<string, unknown>): void {
  const type = event.type; // read before the validator's type guard narrows `event`
  const fn = eventValidator();
  if (!fn(event)) throw new InvalidEventError(type, describe(fn));
}
