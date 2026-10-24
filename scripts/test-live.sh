#!/usr/bin/env sh
# Kept for old docs and habits. Tests no longer run against a live or
# demo database; this runs them on a throw-away stack instead.
echo "test-live.sh: running the isolated test stack (scripts/test-isolated.sh)"
exec "$(dirname "$0")/test-isolated.sh" "$@"
