export function formatNumber(n) {
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 1000) return sign + Math.round(n).toString();
  const units = ['K', 'M', 'B', 'T'];
  let unitIndex = -1;
  while (n >= 1000 && unitIndex < units.length - 1) {
    n /= 1000;
    unitIndex++;
  }
  return `${sign}${n.toFixed(n < 10 ? 2 : 1)}${units[unitIndex]}`;
}

export function formatWeight(kg) {
  return `${kg.toFixed(kg < 1 ? 2 : 1)} kg`;
}

export function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
