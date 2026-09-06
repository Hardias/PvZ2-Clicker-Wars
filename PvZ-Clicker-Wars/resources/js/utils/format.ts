import Decimal from 'break_eternity.js';
import { BigNum } from './bigNumber';

// Short-scale suffixes: every 3 orders of magnitude
const SUFFIXES = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

const INFINITY = '\u221E';

// Largest suffix tier index (Vg = 1e75); values at or above 10^75 fall back to exponential notation.
const MAX_SUFFIX_EXP = SUFFIXES.length * 3; // 75

function formatFiniteNumber(value: number): string {
  if (value < 1000) return Math.floor(value).toString();

  let scaled = value;
  let tier = 0;
  while (scaled >= 1000 && tier < SUFFIXES.length - 1) {
    scaled /= 1000;
    tier++;
  }

  const suffix = SUFFIXES[tier];
  if (scaled >= 1000) {
    // Beyond the suffix ladder (extreme values): fall back to exponential notation
    return scaled.toExponential(2).replace(/e\+?/, 'e');
  }
  if (tier === 0) return Math.floor(scaled).toString();
  return scaled.toFixed(1).replace(/\.0$/, '') + suffix;
}

/**
 * Format a possibly-massive number (plain JS number or break_eternity Decimal) for display.
 * Suffixes run to Vg (1e75), then exponential notation takes over for truly enormous values.
 */
export function formatNumber(value: BigNum | number): string {
  if (value === undefined || value === null) return '0';
  if (typeof value === 'number') {
    if (!isFinite(value)) return value > 0 ? INFINITY : '-' + INFINITY;
    return formatFiniteNumber(value);
  }

  const d = new Decimal(value);
  if (d.isNan()) return '0';

  if (d.lt(0)) return '-' + formatNumber(d.neg());

  const num = d.toNumber();
  if (num === 0) return '0';

  // Values below 1 are floored like the plain-number path
  const exp = d.exponent;
  if (exp < 0) return '0';
  if (exp < 3) return Math.floor(num).toString();

  if (exp < MAX_SUFFIX_EXP) {
    const tier = Math.floor(exp / 3);
    const scaled = d.div(10 ** (tier * 3)).toNumber();
    return scaled.toFixed(1).replace(/\.0$/, '') + SUFFIXES[tier];
  }

  // Beyond `Number` range (>~1e308) or beyond the suffix ladder: exponential via the Decimal
  return d.toExponential(2).replace(/e\+?/, 'e');
}