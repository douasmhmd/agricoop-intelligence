import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  defaultDatePeremption,
  isExpired,
  isoDateInZone,
} from '../src/index.js';

describe('dates', () => {
  it('uses the Moroccan calendar day, not UTC', () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Casablanca (UTC+1).
    expect(isoDateInZone(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    expect(isoDateInZone(new Date('2026-12-31T22:30:00Z'))).toBe('2026-12-31');
  });

  it('adds days across months and leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-11-01', 540)).toBe('2028-04-24');
    expect(defaultDatePeremption('2026-11-01', 540)).toBe('2028-04-24');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-11', '2026-12-11')).toBe(30);
    expect(daysBetween('2026-11-11', '2026-11-01')).toBe(-10);
  });

  it('treats a lot as expired on its date_peremption', () => {
    expect(isExpired('2026-11-11', '2026-11-10')).toBe(false);
    expect(isExpired('2026-11-11', '2026-11-11')).toBe(true);
  });

  it('rejects malformed dates', () => {
    expect(() => addDays('11/11/2026', 1)).toThrow(RangeError);
  });
});

describe('toIsoTimestamp', () => {
  it('normalizes Postgres timestamptz text to ISO UTC', async () => {
    const { toIsoTimestamp } = await import('../src/index.js');
    expect(toIsoTimestamp('2026-11-11 10:00:00.123+00')).toBe('2026-11-11T10:00:00.123Z');
    expect(toIsoTimestamp('2026-11-11 11:00:00+01')).toBe('2026-11-11T10:00:00.000Z');
    expect(() => toIsoTimestamp('nope')).toThrow(RangeError);
  });
});

describe('weeks', () => {
  it('normalizes to Mondays', async () => {
    const { mondayOf, weeksBetween } = await import('../src/index.js');
    expect(mondayOf('2026-11-11')).toBe('2026-11-09'); // Wednesday
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09'); // Sunday
    expect(weeksBetween('2026-11-11', '2026-11-25')).toEqual([
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
    ]);
  });
});
