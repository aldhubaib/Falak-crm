/** Compact relative age for dashboard task rows (e.g. "2h", "3d"). */
export function formatAgeLabel(from: Date): string {
  const ms = Math.max(0, Date.now() - from.getTime());
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
