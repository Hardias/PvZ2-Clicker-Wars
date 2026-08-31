export function formatNumber(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0';
  if (value < 1000) return Math.floor(value).toString();
  if (value < 1000000) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (value < 1000000000) return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  return (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
}
