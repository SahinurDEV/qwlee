#!/usr/bin/env sh
# Run the API test-suite against a running stack WITHOUT leaving test data
# behind: the Mongo database is snapshotted before the run and restored
# afterwards (even if tests fail). Mailpit messages created by the tests
# are not touched.
#
#   scripts/test-live.sh                       # API at http://localhost:7171
#   API_URL=https://example.com/api scripts/test-live.sh
#
# Extra compose files (e.g. a host-network override) can be passed via
# COMPOSE="docker compose -f docker-compose.yml -f other.yml".
set -eu
cd "$(dirname "$0")/.."
COMPOSE=${COMPOSE:-docker compose}
DB=${MONGO_DB:-qwlee}
SNAP=/tmp/qwlee-pretest.archive

# Fresh backend process: the in-memory login rate limiter would otherwise
# carry failures over from a previous run (429s). The suite makes many
# deliberate failed sign-ins, so it runs with a higher limit; the normal
# limit (AUTH_RATE_LIMIT_MAX from .env, default 20) is put back afterwards.
wait_api() {
  i=0
  until curl -fsS "${API_URL:-http://localhost:7171}/v1/info/geo" >/dev/null 2>&1 || [ $i -ge 90 ]; do i=$((i+1)); sleep 1; done
}
echo "→ restarting backend (test rate limit)"
AUTH_RATE_LIMIT_MAX=${TEST_AUTH_RATE_LIMIT_MAX:-500} $COMPOSE up -d --no-deps --force-recreate backend >/dev/null 2>&1
wait_api

echo "→ snapshotting database '$DB'"
$COMPOSE exec -T mongo mongodump --quiet --db "$DB" --archive="$SNAP"

restore() {
  echo "→ restoring database '$DB'"
  $COMPOSE exec -T mongo mongorestore --quiet --drop --nsInclude "$DB.*" --archive="$SNAP"
  $COMPOSE exec -T mongo rm -f "$SNAP"
  echo "→ restarting backend (normal rate limit)"
  $COMPOSE up -d --no-deps --force-recreate backend >/dev/null 2>&1
  wait_api
}
trap restore EXIT INT TERM

# Subshell: the restore trap runs compose from the repo root.
(cd backend && API_URL=${API_URL:-http://localhost:7171} MAILPIT_URL=${MAILPIT_URL:-http://localhost:8025} npm test)
