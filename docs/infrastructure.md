# Falak CRM — Infrastructure Runbook

Operational setup for running Falak CRM for ~100 concurrent users. Code-side
changes (migrations, Redis bus, query fixes) live in the repo; this file covers
the account-level configuration that must be done in Railway / Cloudflare.

## 1. Database migrations (replaces `db push`)

Deploys now run `scripts/deploy.sh`, which applies committed Prisma migrations
(`prisma migrate deploy`) and baselines an existing database automatically on
the first run. The old `prisma db push --accept-data-loss` start command is
gone — it could silently drop production data on schema drift.

Day-to-day schema changes:

```bash
# after editing prisma/schema.prisma
npx prisma migrate dev --name describe_the_change
# commit the new folder under prisma/migrations/
```

Never run `db push` against production again.

## 2. Redis (required for multi-instance)

Add one **Redis** service to the Railway project. It serves two consumers:

| Consumer | Env var | Where |
|---|---|---|
| App SSE bus + caches (`src/lib/realtime.ts`, `src/lib/cache.ts`) | `REDIS_URL` | Next.js app service |
| Centrifugo engine (`centrifugo/config.json`) | `CENTRIFUGO_ENGINE_REDIS_ADDRESS` | Centrifugo service |

Use Railway's **private** Redis URL for both. Without `REDIS_URL` the app falls
back to an in-process event bus, which only works with a single replica.

## 3. Cloudflare R2 CORS (direct browser uploads)

Uploads go browser → R2 via presigned URLs. If R2's CORS rules are missing,
every upload silently falls back to the server proxy
(`/api/files/[id]/upload`), which buffers whole files in the app's memory —
that path must be the rare exception, not the norm.

Set this CORS policy on the R2 bucket (Cloudflare dashboard → R2 → bucket →
Settings → CORS policy):

```json
[
  {
    "AllowedOrigins": ["https://panel.falak.media", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`ExposeHeaders: ["ETag"]` is mandatory — the multipart uploader reads each
part's ETag from the response headers to register it with the server; without
it multipart uploads fail over to the proxy.

To verify: upload a >25 MB file on the assets page with the browser network
tab open. You should see `PUT` requests going to
`*.r2.cloudflarestorage.com`, not to `/api/files/.../upload`.

## 4. Cloudflare in front of the app (global users)

The team is spread across regions; static assets should be served from the
edge, not from the Railway region.

1. In Cloudflare DNS, set `panel.falak.media` to **Proxied** (orange cloud)
   pointing at the Railway app domain (CNAME).
2. Cloudflare respects Next.js's `Cache-Control` headers out of the box:
   `/_next/static/*` is immutable and gets cached at the edge; HTML/API stay
   dynamic. No cache rules are strictly required, but a rule to
   "Cache Everything" on `/_next/static/*` with a long edge TTL is safe.
3. Set SSL mode to **Full (strict)**.
4. WebSockets (Centrifugo) are on a separate hostname; if you move it behind
   Cloudflare too, WebSockets are supported on all plans — no config needed.

## 5. Railway sizing & replicas

Order matters: only scale to multiple replicas **after** Redis is configured
(step 2), otherwise SSE/realtime breaks across instances.

1. App service → Settings → Deploy → **Replicas: 2** (2 vCPU / 4 GB each is a
   sensible starting point for 100 users).
2. Database connections: each replica opens up to `DB_POOL_MAX` (default 20)
   Postgres connections. Keep `replicas × DB_POOL_MAX` comfortably below the
   Postgres plan's `max_connections` (Railway default ≈ 100). With 2 replicas,
   `DB_POOL_MAX=20` (40 total) is fine.
3. Centrifugo can stay at 1 replica; with the Redis engine it can be scaled
   later without config changes.

## 6. Observability

- Railway → Postgres → enable slow query logging:
  `ALTER SYSTEM SET log_min_duration_statement = 500; SELECT pg_reload_conf();`
  (logs every query slower than 500 ms).
- Watch the app service's CPU/RAM graphs after each phase; upgrade instance
  size only when they show sustained pressure.
- Watch Postgres connection count — if it approaches the limit, lower
  `DB_POOL_MAX` or add PgBouncer.

## Environment variables summary (new since the overhaul)

| Variable | Service | Purpose |
|---|---|---|
| `REDIS_URL` | app | SSE bus across replicas + short-TTL caches |
| `CENTRIFUGO_ENGINE_REDIS_ADDRESS` | centrifugo | Redis engine (state survives restarts / replicas) |
