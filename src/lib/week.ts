// Monday 00:00 UTC of the given moment's week — the identity of a planning
// week for Weekly Plan slots.
export function weekStartOf(now = new Date()): Date {
  const day = (now.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day),
  );
}
