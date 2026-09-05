// Short-scale suffixes: every 3 orders of magnitude
const SUFFIXES = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

export function formatNumber(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0';
  if (!isFinite(value)) return value > 0 ? '\u221E' : '-\u221E';
  if (value < 0) return '-' + formatNumber(-value);

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