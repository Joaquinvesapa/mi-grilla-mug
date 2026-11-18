#!/usr/bin/env bash
# Leaves the test database ready (FIX-004): creates it if it does not exist, applies the migrations
# and loads the festival grid. It is the database of TEST_DATABASE_URL, never the development one in
# DATABASE_URL: `tests/test-database.ts` refuses a missing, remote or development database before
# running anything, and hands each command DATABASE_URL set to the test database.
#
#   pnpm db:test:prepare
#
# - `prisma migrate deploy` creates the database when it is missing, on the running server: no init
#   script in docker-compose.yml, which would only run on an empty volume.
# - Safe to run again: applied migrations are skipped and the seed updates what is already there.
# - `--env-file-if-exists` never overrides a variable already in the environment, so in the CI the
#   job's TEST_DATABASE_URL wins; locally it comes from `.env`. The URL is never printed.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

node --env-file-if-exists=.env tests/test-database.ts pnpm exec prisma migrate deploy
node --env-file-if-exists=.env tests/test-database.ts node prisma/seed.ts
