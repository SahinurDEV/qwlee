#!/bin/sh
# Mongo backups for the "backup" compose service (mongo:7 image).
#   default: loop — back up every BACKUP_INTERVAL_HOURS (24), keep the
#            newest BACKUP_KEEP (7) archives, and also run when the admin
#            dashboard asks ("Back up now" creates /backups/requests/run-now).
#   once:    one backup and exit (docker compose run --rm backup once).
# Each run writes /backups/status.json, which the admin Backups page reads.
set -u
DIR=${BACKUP_DIR:-/backups}
URI=${MONGODB_URL:-mongodb://mongo:27017/qwlee}
KEEP=${BACKUP_KEEP:-7}
EVERY=${BACKUP_INTERVAL_HOURS:-24}
# Uploaded images/files (the API's uploads volume, mounted read-only).
UPLOADS=${UPLOADS_DIR:-/uploads}
# Off-server copy: a directory on another disk / NFS / synced folder,
# bind-mounted at /offsite (BACKUP_OFFSITE_PATH in .env). Empty = skip.
OFFSITE=${OFFSITE_DIR:-/offsite}
mkdir -p "$DIR/requests"
# The API container (non-root) drops "Back up now" requests here.
chmod 1777 "$DIR/requests"

run() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  f="$DIR/qwlee-$ts.archive.gz"
  start=$(date +%s)
  if err=$(mongodump --uri="$URI" --archive="$f.tmp" --gzip --quiet 2>&1); then
    mv "$f.tmp" "$f"; ok=true; err=""
  else
    rm -f "$f.tmp"; ok=false; f=""
  fi
  # Uploads go into a tar next to the database archive.
  up=""
  if [ "$ok" = true ] && [ -d "$UPLOADS" ]; then
    u="$DIR/qwlee-$ts.uploads.tar.gz"
    if tar -czf "$u.tmp" -C "$UPLOADS" . 2>/dev/null; then mv "$u.tmp" "$u"; up=$(basename "$u"); else rm -f "$u.tmp"; fi
  fi
  ls -1t "$DIR"/qwlee-*.uploads.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
  # Off-server copy (mirrors the kept archives).
  off=false
  if [ "$ok" = true ] && [ -d "$OFFSITE" ] && [ -w "$OFFSITE" ]; then
    if cp "$f" "$OFFSITE/" && { [ -z "$up" ] || cp "$DIR/$up" "$OFFSITE/"; }; then off=true; fi
    ls -1t "$OFFSITE"/qwlee-*.archive.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
    ls -1t "$OFFSITE"/qwlee-*.uploads.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
  fi
  secs=$(( $(date +%s) - start ))
  bytes=0; [ -n "$f" ] && bytes=$(stat -c %s "$f")
  ls -1t "$DIR"/qwlee-*.archive.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
  err=$(printf '%s' "$err" | tr '\n"\\' '   ' | cut -c1-300)
  printf '{"at":"%s","ok":%s,"file":"%s","bytes":%s,"seconds":%s,"error":"%s","keep":%s,"intervalHours":%s,"uploads":"%s","offsite":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ok" "$(basename "${f:-none}")" "$bytes" "$secs" "$err" "$KEEP" "$EVERY" "$up" "$off" > "$DIR/status.json.tmp"
  mv "$DIR/status.json.tmp" "$DIR/status.json"
  echo "backup ok=$ok file=${f:-none} bytes=$bytes"
}

if [ "${1:-loop}" = "once" ]; then run; exit 0; fi
last=0
while true; do
  now=$(date +%s)
  if [ -f "$DIR/requests/run-now" ] || [ $((now - last)) -ge $((EVERY * 3600)) ]; then
    rm -f "$DIR/requests/run-now"
    run
    last=$now
  fi
  sleep 30
done
