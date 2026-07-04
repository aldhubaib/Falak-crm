# Centrifugo real-time server (DevOps)

Centrifugo is the single real-time transport for Falak CRM: live chat/comments,
rejection routing, board updates, presence (online/offline), and typing.
The Next.js app is the source of truth (Postgres); Centrifugo only delivers
events. It never stores business data and never creates notifications.

## What runs where

- **App (Next.js)** publishes events to Centrifugo over the private HTTP API and
  mints short-lived JWTs so browsers can connect/subscribe.
- **Centrifugo** fans those events out to connected browsers over WebSocket.

## Deploy on Railway

1. Create a new service in the same Railway project from the Docker image
   `centrifugo/centrifugo:v6`.
2. Start command:

   ```
   centrifugo -c /app/config.json
   ```

   Mount this repo's `centrifugo/config.json` (commit it into the image, or use a
   Railway config file mount). The namespaces/presence live in that file; secrets
   come from env vars below (Centrifugo overrides config keys from env).
3. Set these variables on the Centrifugo service:

   | Variable | Value |
   |---|---|
   | `CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY` | long random string (shared with the app as `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY`) |
   | `CENTRIFUGO_HTTP_API_KEY` | long random string (shared with the app as `CENTRIFUGO_API_KEY`) |
   | `CENTRIFUGO_CLIENT_ALLOWED_ORIGINS` | `https://panel.falak.media` (space/comma separated; add localhost for dev) |
   | `CENTRIFUGO_HTTP_SERVER_PORT` | `8000` (Railway will inject `PORT`; map it) |

4. Give the service a **public domain** (browsers connect over WSS) and note the
   internal/private URL (the app publishes to it server-side).
5. Health check path: `/health`.

## App environment variables

Add to the Next.js service (see `.env.example`):

- `CENTRIFUGO_HTTP_API` — private base URL of Centrifugo, e.g.
  `http://centrifugo.railway.internal:8000` (used for server publishes).
- `CENTRIFUGO_API_KEY` — must equal `CENTRIFUGO_HTTP_API_KEY`.
- `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY` — must equal Centrifugo's
  `CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY`.
- `NEXT_PUBLIC_CENTRIFUGO_WS` — public WebSocket URL, e.g.
  `wss://centrifugo-production.up.railway.app/connection/websocket`.

## Deploy order

1. Deploy Centrifugo service + its secrets and public domain.
2. Add the four app env vars above.
3. Deploy the app.

The app degrades gracefully: if the Centrifugo vars are missing, publishes are
skipped and the client stays on its polling/refresh fallbacks. Nothing breaks.

## Local development

Run Centrifugo locally with Docker, pointing at this config and dev secrets:

```bash
docker run -it --rm -p 8000:8000 \
  -v "$(pwd)/centrifugo/config.json:/app/config.json" \
  -e CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY=dev-secret \
  -e CENTRIFUGO_HTTP_API_KEY=dev-api-key \
  centrifugo/centrifugo:v6 centrifugo -c /app/config.json
```

Then in `.env.local`:

```
CENTRIFUGO_HTTP_API=http://localhost:8000
CENTRIFUGO_API_KEY=dev-api-key
CENTRIFUGO_TOKEN_HMAC_SECRET_KEY=dev-secret
NEXT_PUBLIC_CENTRIFUGO_WS=ws://localhost:8000/connection/websocket
```

## Scaling (100+ users)

A single Centrifugo node with the in-memory engine handles far more than 100
concurrent connections. For zero-downtime restarts / multiple replicas, switch
`engine.type` to `redis` and add a Redis service (see
https://centrifugal.dev/docs/server/engines). No app code changes are needed.
