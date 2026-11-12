#!/usr/bin/env bash
# Regenerate the full screenshot set against a production server (dev-mode compiles cause networkidle flakes).
# Usage: scripts/screenshots-prod.sh <outdir> [port]   (npm run screenshots:prod -- artifacts/screenshots)
# SKIP_BUILD=1 reuses the last `next build`. Uses (and resets) data/e2e.db, as e2e/screenshots.spec.ts requires.
set -u
cd "$(dirname "$0")/.."
USAGE="Usage: npm run screenshots:prod -- <outdir> [port]   (outdir: artifacts/<name> or /tmp/<name>)"
OUT=${1:-}
PORT=${2:-3150}
[ -n "$OUT" ] || { echo "$USAGE"; exit 1; }
# The output folder is deleted and rewritten, so only allow a folder under artifacts/ or /tmp, never with "..".
case "$OUT" in *..*) echo "Refusing to write to $OUT (no \"..\" in the path)"; exit 1 ;; esac
case "$OUT" in artifacts/?*|/tmp/?*) ;; *) echo "Refusing to write to $OUT"; echo "$USAGE"; exit 1 ;; esac
# PIDs listening on $PORT (ss on Linux, lsof elsewhere).
port_pids() {
  if command -v ss >/dev/null 2>&1; then ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | cut -d= -f2
  else lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null; fi
}
if [ -n "$(port_pids)" ]; then echo "PORT $PORT BUSY"; exit 1; fi
# The spec asserts DATABASE_PATH is data/e2e.db; start it fresh.
rm -f data/e2e.db data/e2e.db-wal data/e2e.db-shm; rm -rf data/e2e-uploads data/shots-*
export DATABASE_PATH=data/e2e.db UPLOADS_DIR=data/e2e-uploads APP_URL=http://localhost:$PORT
[ "${SKIP_BUILD:-}" = 1 ] || npm run build > /tmp/shots-build.log 2>&1 || { echo BUILD_FAILED; tail -20 /tmp/shots-build.log; exit 1; }
PORT=$PORT SHELFIE_TEST=1 SHELFIE_ALLOW_GUEST_SHOPS=1 npx next start --port $PORT > /tmp/shots-server.log 2>&1 &
SERVER=$!
kill_port() { for p in $(port_pids); do kill "$p" 2>/dev/null; done; }
trap 'kill $SERVER 2>/dev/null; kill_port' EXIT
UP=0
for i in $(seq 1 60); do curl -sf "http://localhost:$PORT/api/health" >/dev/null && { UP=1; break; }; sleep 1; done
# Never delete the last screenshots for a run that can't happen.
[ "$UP" = 1 ] || { echo "SERVER_NOT_READY (no answer from :$PORT/api/health after 60 s)"; tail -20 /tmp/shots-server.log; exit 1; }
rm -rf "$OUT"
E2E_PORT=$PORT E2E_REUSE_SERVER=1 SCREENSHOTS_DIR=$OUT npx playwright test e2e/screenshots.spec.ts --retries 1 > /tmp/shots-run.log 2>&1
STATUS=$?
echo "EXIT=$STATUS"
grep -E "passed|failed|flaky" /tmp/shots-run.log | tail -5
ls "$OUT"/*.png | wc -l
exit $STATUS
