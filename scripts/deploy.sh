#!/bin/sh
# Production deploy: apply versioned Prisma migrations, then start the app.
#
# Baseline guard: the first `migrate deploy` against a database created with
# `prisma db push` fails with P3005 ("schema is not empty"). ONLY that exact
# error is auto-baselined (marking 0_init as applied). Any other migration
# failure (bad SQL, connection issues, drift) aborts the deploy so a broken
# migration can never be masked by a silent baseline.
set -e

MIGRATE_LOG="$(mktemp)"
if npx prisma migrate deploy > "$MIGRATE_LOG" 2>&1; then
  cat "$MIGRATE_LOG"
else
  cat "$MIGRATE_LOG"
  if grep -q "P3005" "$MIGRATE_LOG"; then
    echo "P3005 detected - baselining existing database with 0_init"
    npx prisma migrate resolve --applied 0_init
    npx prisma migrate deploy
  else
    echo "migrate deploy failed with a non-P3005 error - aborting deploy"
    exit 1
  fi
fi
rm -f "$MIGRATE_LOG"

# Standalone output (next.config output: "standalone"): the server bundle
# doesn't include public/ or the static chunks — link them in, then boot the
# self-contained server. Falls back to `next start` for older builds.
if [ -f .next/standalone/server.js ]; then
  rm -rf .next/standalone/public .next/standalone/.next/static
  cp -r public .next/standalone/public
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static
  # Docker sets HOSTNAME to the container id and Next's standalone server
  # uses it as the bind address — the server then listens on the wrong
  # interface and Railway's healthcheck can never reach it. Bind everywhere.
  export HOSTNAME=0.0.0.0
  exec node .next/standalone/server.js
fi

exec npm start
