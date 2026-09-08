import { describe, it, expect } from 'vitest';
import Decimal from 'break_eternity.js';
import { big, desBig, toNum } from './bigNumber';

describe('big', () => {
  it('coerces a plain number', () => {
    const d = big(42);
    expect(d instanceof Decimal).toBe(true);
    expect(d.toNumber()).toBe(42);
  });

  it('coerces a numeric string', () => {
    expect(big('1e21').toNumber()).toBe(1e21);
  });

  it('coerces an existing Decimal into a fresh instance', () => {
    const src = new Decimal(123);
    const out = big(src);
    expect(out).not.toBe(src);
    expect(out.eq(123)).toBe(true);
  });

  it('coerces a Decimal wrapped in a reactive proxy', () => {
    const target = new Decimal(7);
    const proxy = new Proxy(target, {});
    expect(big(proxy as unknown as Decimal).toNumber()).toBe(7);
  });
});

describe('toNum', () => {
  it('returns number values as-is', () => {
    expect(toNum(5)).toBe(5);
  });

  it('converts a Decimal to a number', () => {
    expect(toNum(new Decimal('1e30'))).toBe(1e30);
  });
});

describe('desBig', () => {
  it('reads a number field', () => {
    expect(desBig(10).toNumber()).toBe(10);
  });

  it('reads a numeric string field', () => {
    expect(desBig('1.5e12').toNumber()).toBe(1.5e12);
  });

  it('falls back on an invalid string', () => {
    expect(desBig('not-a-number', 3).toNumber()).toBe(3);
  });

  it('reads an actual Decimal instance', () => {
    expect(desBig(new Decimal(99)).toNumber()).toBe(99);
  });

  it('falls back on null/undefined/other values', () => {
    expect(desBig(undefined, 11).toNumber()).toBe(11);
    expect(desBig(null, 11).toNumber()).toBe(11);
    expect(desBig({}, 11).toNumber()).toBe(11);
    expect(desBig([], 11).toNumber()).toBe(11);
  });

  it('defaults to zero when no fallback is given', () => {
    expect(desBig(undefined).toNumber()).toBe(0);
  });
});
