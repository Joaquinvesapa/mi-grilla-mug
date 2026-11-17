#!/usr/bin/env bash
# Runs the Playwright E2E suite (all projects, WebKit included) inside the official Playwright
# image, for hosts that cannot run Playwright's WebKit build (missing system libraries).
#
#   pnpm test:e2e:docker                          # every project
#   pnpm test:e2e:docker --project iphone-webkit  # extra arguments go to `playwright test`
#
# - The image tag matches the @playwright/test version in package.json.
# - The host's node_modules and .next are never touched: the container sees its own copies in
#   named Docker volumes mounted over them. The pnpm store and the pnpm binary live in a third
#   volume, so later runs reuse them.
# - The container runs as the host uid/gid, so whatever it writes into the repo (test-results/,
#   playwright-report/, next-env.d.ts) belongs to the user, not to root.
# - Linux only: the container shares the host's network (`--network host`), so its 127.0.0.1 is the
#   host's. That is how `next start` inside it reaches the Postgres of docker-compose.yml at the
#   DATABASE_URL of `.env` (127.0.0.1:5432), unchanged. It also means port 3100 has to be free on
#   the host. Docker Desktop (macOS, Windows) does not share the host's loopback this way.
# - The database has to be up and migrated first, on the host: `pnpm db:up && pnpm db:migrate`.
# - DATABASE_URL and BETTER_AUTH_SECRET are passed by name (`-e NAME`, never `-e NAME=value`), so
#   their values never show up in this script, its output or `ps`. Docker forwards them only when
#   they are set in the host's environment; otherwise `next start` reads them from the repo's
#   `.env`, which the container sees through the /work mount. BETTER_AUTH_URL is not passed: the
#   Playwright config sets it to the URL the tests use.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.65.1-noble"
VOLUME_PREFIX="mi-grilla-e2e"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST_UID="$(id -u)"
HOST_GID="$(id -g)"

VOLUMES=(
  -v "${VOLUME_PREFIX}-node-modules:/work/node_modules"
  -v "${VOLUME_PREFIX}-next:/work/.next"
  -v "${VOLUME_PREFIX}-home:/home/e2e"
)

# The mount points must exist on the host before Docker mounts volumes over them; otherwise the
# daemon creates them, owned by root.
mkdir -p "$REPO/node_modules" "$REPO/.next"

# Fresh named volumes are owned by root: hand them to the host user once.
docker run --rm "${VOLUMES[@]}" "$IMAGE" \
  chown "$HOST_UID:$HOST_GID" /work/node_modules /work/.next /home/e2e

docker run --rm --init --ipc=host --network host \
  --user "$HOST_UID:$HOST_GID" \
  -e HOME=/home/e2e \
  -e CI \
  -e DATABASE_URL \
  -e BETTER_AUTH_SECRET \
  -v "$REPO:/work" \
  "${VOLUMES[@]}" \
  -w /work \
  "$IMAGE" \
  bash -euo pipefail -c '
    export PATH="$HOME/.local/bin:$PATH"
    # pnpm exactly as packageManager pins it (the image ships no corepack).
    want="$(node -p "require(\"./package.json\").packageManager.split(\"@\")[1]")"
    if [ "$(pnpm --version 2>/dev/null || true)" != "$want" ]; then
      npm install --global --prefix "$HOME/.local" --no-fund --no-audit "pnpm@$want"
    fi
    pnpm install --frozen-lockfile
    pnpm test:e2e "$@"
  ' bash "$@"
