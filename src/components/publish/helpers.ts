import { type Item, type Project } from "./types";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DOW_TINY = ["S", "M", "T", "W", "T", "F", "S"];

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const fmtShort = (d: Date) =>
  `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;

export function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

export function formatFullDate(d: Date) {
  return `${DOW_SHORT[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function groupByProject(
  items: Item[],
): { project: Project; items: Item[] }[] {
  const map = new Map<string, { project: Project; items: Item[] }>();
  for (const it of items) {
    const g = map.get(it.projectId) ?? { project: it.project, items: [] };
    g.items.push(it);
    map.set(it.projectId, g);
  }
  return [...map.values()];
}
