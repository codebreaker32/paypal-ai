#!/usr/bin/env bash
# Regenerate the full judged screenshot set against a production server (dev-mode compiles cause networkidle flakes).
# Usage: scripts/screenshots-prod.sh [outdir] [port]   (npm run screenshots:prod -- docs/judge/screenshots/round-3)
# SKIP_BUILD=1 reuses the last `next build`. Uses (and resets) data/e2e.db, as e2e/screenshots.spec.ts requires.
set -u
cd "$(dirname "$0")/.."
OUT=${1:-docs/judge/screenshots/round-2}
PORT=${2:-3150}
# The output folder is deleted and rewritten, so only allow a screenshots folder or /tmp.
case "$OUT" in docs/judge/screenshots/?*|/tmp/?*) ;; *) echo "Refusing to write to $OUT (use docs/judge/screenshots/<name> or /tmp/<name>)"; exit 1 ;; esac
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
PORT=$PORT SHELFIE_TEST=1 npx next start --port $PORT > /tmp/shots-server.log 2>&1 &
SERVER=$!
kill_port() { for p in $(port_pids); do kill "$p" 2>/dev/null; done; }
trap 'kill $SERVER 2>/dev/null; kill_port' EXIT
for i in $(seq 1 60); do curl -sf "http://localhost:$PORT/api/health" >/dev/null && break; sleep 1; done
rm -rf "$OUT"
E2E_PORT=$PORT E2E_REUSE_SERVER=1 SCREENSHOTS_DIR=$OUT npx playwright test e2e/screenshots.spec.ts --retries 1 > /tmp/shots-run.log 2>&1
STATUS=$?
echo "EXIT=$STATUS"
grep -E "passed|failed|flaky" /tmp/shots-run.log | tail -5
ls "$OUT"/*.png | wc -l
exit $STATUS
