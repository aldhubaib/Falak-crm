import Redis from "ioredis";

// Small Redis-backed cache for hot, JSON-serializable lookups (permissions,
// throttle flags). Degrades to a straight pass-through when REDIS_URL is not
// configured or Redis is unreachable — caching is never load-bearing.

const globalForCache = globalThis as unknown as {
  redisCache: Redis | null | undefined;
};

function getRedis(): Redis | null {
  if (globalForCache.redisCache !== undefined) return globalForCache.redisCache;
  const url = process.env.REDIS_URL;
  const client = url
    ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 })
    : null;
  client?.on("error", (err) =>
    console.error("[cache] redis error:", err.message),
  );
  globalForCache.redisCache = client;
  return client;
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (!redis) return load();

  try {
    const hit = await redis.get(key);
    if (hit != null) return JSON.parse(hit) as T;
  } catch {
    // Fall through to loading fresh.
  }

  const value = await load();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Best-effort.
  }
  return value;
}

export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Best-effort.
  }
}

// Returns true at most once per TTL window — used to throttle expensive
// best-effort work (e.g. third-party API backfills).
export async function claimThrottle(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const res = await redis.set(key, "1", "EX", ttlSeconds, "NX");
    return res === "OK";
  } catch {
    return true;
  }
}
