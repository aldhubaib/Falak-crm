// Task time-estimate presets offered in the "Move to In Progress" confirm
// dialog, and the formatter every surface uses to render Task.estimateMin.

export const ESTIMATE_OPTIONS: { label: string; min: number }[] = [
  { label: "30m", min: 30 },
  { label: "1h", min: 60 },
  { label: "2h", min: 120 },
  { label: "4h", min: 240 },
  { label: "1d", min: 1440 },
  { label: "2d", min: 2880 },
];

export function formatEstimate(min: number): string {
  if (min % 1440 === 0) return `${min / 1440}d`;
  if (min % 60 === 0) return `${min / 60}h`;
  if (min > 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${min}m`;
}
