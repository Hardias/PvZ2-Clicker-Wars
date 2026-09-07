import Decimal from 'break_eternity.js';

/** Big-number type used across the game (break_eternity Decimal). */
export type BigNum = Decimal;

/** Anything that can be coerced into a BigNum. */
export type BigSource = BigNum | number | string;

/**
 * Coerce a value into a fresh Decimal.
 * Accepts numbers, strings (serialized Decimals), and Decimal instances
 * (including Decimals wrapped in Vue reactive proxies).
 */
export function big(value: BigSource): BigNum {
  if (typeof value === 'number') return new Decimal(value);
  return new Decimal(value);
}

/** Convert a Decimal-backed value to a plain JS number (may be +/-Infinity for very large values). */
export function toNum(value: BigNum | number): number {
  if (typeof value === 'number') return value;
  const d = new Decimal(value);
  return d.toNumber();
}

/** Deserialize a possibly-missing/string/number field into a Decimal. */
export function desBig(value: unknown, fallback: BigSource = 0): BigNum {
  if (typeof value === 'number') return new Decimal(value);
  if (typeof value === 'string') {
    try {
      return new Decimal(value);
    } catch {
      return new Decimal(fallback);
    }
  }
  if (value instanceof Decimal) return new Decimal(value);
  return new Decimal(fallback);
}