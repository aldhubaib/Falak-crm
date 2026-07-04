#!/bin/sh
# Production deploy: apply versioned Prisma migrations, then start the app.
#
# The first `migrate deploy` against a pre-existing database (created via
# `prisma db push`) fails with P3005 because the schema is not empty. In that
# case we baseline it by marking the 0_init migration as already applied,
# then retry. Fresh databases simply run all migrations from scratch.
set -e

if ! npx prisma migrate deploy; then
  echo "migrate deploy failed - baselining existing database with 0_init"
  npx prisma migrate resolve --applied 0_init
  npx prisma migrate deploy
fi

exec npm start
