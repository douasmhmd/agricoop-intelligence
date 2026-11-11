import { describe, expect, it } from 'vitest';
import {
  formatMad,
  lineTotal,
  margin,
  money,
  moneyString,
  positiveMoneyString,
  sumMoney,
} from '../src/index.js';

describe('money', () => {
  it('avoids float errors', () => {
    // 0.1 + 0.2 !== 0.3 with JS numbers
    expect(sumMoney(['0.1', '0.2'])).toBe('0.30');
    expect(lineTotal('19.99', 3)).toBe('59.97');
  });

  it('rejects malformed amounts', () => {
    expect(() => money('1.234')).toThrow(RangeError);
    expect(() => money('-5')).toThrow(RangeError);
    expect(() => money('123456789')).toThrow(RangeError); // > NUMERIC(10,2)
    expect(moneyString.safeParse('12.5').success).toBe(true);
    expect(moneyString.safeParse('12.555').success).toBe(false);
    expect(positiveMoneyString.safeParse('0.00').success).toBe(false);
    expect(positiveMoneyString.safeParse('0.01').success).toBe(true);
    // Regression: malformed input must fail validation, not throw from decimal.js.
    expect(positiveMoneyString.safeParse('').success).toBe(false);
    expect(positiveMoneyString.safeParse('abc').success).toBe(false);
  });

  it('rejects non-integer quantities', () => {
    expect(() => lineTotal('10.00', 1.5)).toThrow(RangeError);
    expect(() => lineTotal('10.00', 0)).toThrow(RangeError);
  });

  it('computes product margin', () => {
    expect(margin('75.00', '41.25')).toEqual({ mad: '33.75', pct: '45.0' });
  });

  it('formats for display', () => {
    expect(formatMad('1234.5')).toBe('1\u202f234,50 MAD');
    expect(formatMad('75', 'ar')).toBe('75,00 د.م.');
  });
});
