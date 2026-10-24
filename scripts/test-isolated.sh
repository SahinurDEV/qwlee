#!/usr/bin/env sh
# Run the API test-suite against a throw-away stack with its own database
# (docker-compose.test.yml). Nothing touches your live or demo data.
#
#   scripts/test-isolated.sh            # run all tests
#   KEEP=1 scripts/test-isolated.sh     # leave the test stack running
set -eu
cd "$(dirname "$0")/.."
PORT=${TEST_API_PORT:-17171}
MAIL=${TEST_MAILPIT_PORT:-18025}
# TEST_COMPOSE_EXTRA: extra compose file, e.g. a host-network override.
C="docker compose -f docker-compose.test.yml${TEST_COMPOSE_EXTRA:+ -f $TEST_COMPOSE_EXTRA}"

down() { [ "${KEEP:-0}" = "1" ] || $C down -v >/dev/null 2>&1 || true; }
trap down EXIT INT TERM

echo "→ starting test stack (API on :$PORT)"
$C down -v >/dev/null 2>&1 || true
$C up -d --build --wait --wait-timeout 300
i=0
until curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1 || [ $i -ge 120 ]; do i=$((i+1)); sleep 1; done
echo "→ seeding test database"
$C exec -T backend npm run seed >/dev/null

echo "→ running tests"
$C run --rm --no-deps -T \
  -v "$(pwd)/backend/tests:/app/tests:ro" \
  -e API_URL="${IN_API_URL:-http://backend:7171}" \
  -e MAILPIT_URL="${IN_MAILPIT_URL:-http://mailpit:8025}" \
  -e SOCKET_URL="${IN_SOCKET_URL:-http://backend:8181}" \
  backend npm test "$@"
