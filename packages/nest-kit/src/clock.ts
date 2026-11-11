import { isoDateInZone } from '@agricoop/shared';

/** Time source, injectable so tests can pin "today". */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol.for('agricoop.CLOCK');

export const systemClock: Clock = { now: () => new Date() };

/** Business date in Morocco (YYYY-MM-DD). */
export function today(clock: Clock): string {
  return isoDateInZone(clock.now());
}
