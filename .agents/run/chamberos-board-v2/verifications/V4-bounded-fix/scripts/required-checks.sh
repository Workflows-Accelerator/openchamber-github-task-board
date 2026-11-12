#!/usr/bin/env bash
# Required checks, sequential; no retries. Evidence always in this bounded pass.
set -u
OUT=.agents/run/chamberos-board-v2/verifications/V4-bounded-fix
run() {
  local name="$1" command="$2" start code
  start="$(date -u +%FT%TZ)"
  bash -c "$command" > "$OUT/logs/$name.log" 2>&1
  code=$?
  printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$code" "$start" "$(date -u +%FT%TZ)" "$command" >> "$OUT/command-results.tsv"
  printf '%s exit=%s\n' "$name" "$code"
  if [ "$code" -ne 0 ]; then exit "$code"; fi
}
run npm-test 'npm test'
run web-tests 'node --test --test-timeout=30000 web/tests/*.test.mjs'
run typecheck 'npm run typecheck'
run server-bundle 'npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-bounded-fix-server.mjs'
# Refuse a pre-existing preview: generator's default fallback must be synthetic.
run smoke-port-safety "node --input-type=module -e \"import net from 'node:net';const s=net.createServer();s.once('error',e=>{console.error(e.code);process.exitCode=1});s.listen(4041,'127.0.0.1',()=>s.close());\""
run delivery-smoke 'DELIVERY_DIR=.agents/run/chamberos-board-v2/verifications/V4-bounded-fix/smoke node scripts/generate-delivery-smoke.mjs'
