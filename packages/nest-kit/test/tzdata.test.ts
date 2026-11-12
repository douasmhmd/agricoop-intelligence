import { describe, expect, it } from 'vitest';
import { tzDataIsCurrent, tzDataWarning } from '../src/tzdata.js';

describe('tz data guard', () => {
  it('accepts tz data that includes the 2026 Moroccan change (2026c+)', () => {
    expect(tzDataIsCurrent('2026c')).toBe(true);
    expect(tzDataIsCurrent('2026e')).toBe(true);
    expect(tzDataIsCurrent('2027a')).toBe(true);
    expect(tzDataWarning('2026e')).toBeUndefined();
  });

  it('flags older or unknown tz data', () => {
    expect(tzDataIsCurrent('2026a')).toBe(false);
    expect(tzDataIsCurrent('2025b')).toBe(false);
    expect(tzDataIsCurrent(undefined)).toBe(false);
    expect(tzDataWarning('2026a')).toMatch(/predates 2026c/);
  });
});
