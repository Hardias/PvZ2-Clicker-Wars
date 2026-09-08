import { describe, it, expect } from 'vitest';
import Decimal from 'break_eternity.js';
import { formatNumber } from './format';

describe('formatNumber (plain numbers)', () => {
  it('formats small integers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(5)).toBe('5');
    expect(formatNumber(999)).toBe('999');
  });

  it('floors fractional values', () => {
    expect(formatNumber(12.9)).toBe('12');
  });

  it('applies short-scale suffixes', () => {
    expect(formatNumber(1_000)).toBe('1k');
    expect(formatNumber(1_500)).toBe('1.5k');
    expect(formatNumber(1_000_000)).toBe('1M');
    expect(formatNumber(1_000_000_000)).toBe('1B');
  });

  it('returns 0 for null/undefined', () => {
    expect(formatNumber(null as unknown as number)).toBe('0');
    expect(formatNumber(undefined as unknown as number)).toBe('0');
  });
});

describe('formatNumber (Decimals)', () => {
  it('formats small Decimal values', () => {
    expect(formatNumber(new Decimal(7))).toBe('7');
  });

  it('floors values below 1000', () => {
    expect(formatNumber(new Decimal(999.9))).toBe('999');
  });

  it('applies suffixes', () => {
    expect(formatNumber(new Decimal('1e3'))).toBe('1k');
    expect(formatNumber(new Decimal('2.5e6'))).toBe('2.5M');
  });

  it('handles negative values', () => {
    expect(formatNumber(new Decimal('-1500'))).toBe('-1.5k');
  });

  it('falls back to exponential notation past the suffix ladder', () => {
    expect(formatNumber(new Decimal('1e76'))).toContain('e');
  });

  it('returns 0 for NaN', () => {
    expect(formatNumber(new Decimal('NaN'))).toBe('0');
  });
});
