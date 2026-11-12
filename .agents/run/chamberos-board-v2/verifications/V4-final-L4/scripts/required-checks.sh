#!/usr/bin/env bash
# From repository root; source stays read-only. Every command runs sequentially.
set -u
OUT="$PWD/.agents/run/chamberos-board-v2/verifications/V4-final-L4"
: > "$OUT/command-results.tsv"
run() {
  local label="$1"; shift
  printf '%s\tSTART\t%s\n' "$label" "$(date -Iseconds)" >> "$OUT/command-results.tsv"
  "$@" > "$OUT/logs/$label.log" 2>&1
  local result=$?
  printf '%s\t%s\t%s\n' "$label" "$result" "$(date -Iseconds)" >> "$OUT/command-results.tsv"
}
run npm-test npm test
run web-tests node --test --test-timeout=30000 web/tests/*.test.mjs
run typecheck npm run typecheck
run server-bundle npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-final-review-server.mjs
# Keep original generator untouched; its supported output override prevents writes
# to builder evidence. No configured preview: synthetic localhost fixtures only.
unset PREVIEW_URL H2_CHROME LD_LIBRARY_PATH
run smoke-run-1 env DELIVERY_DIR="$OUT/smoke-run-1" node scripts/generate-delivery-smoke.mjs
run smoke-run-2 env DELIVERY_DIR="$OUT/smoke-run-2" node scripts/generate-delivery-smoke.mjs
cat "$OUT/command-results.tsv"
if awk -F '\t' '$2 != "START" && $2 != 0 { failed=1 } END { exit failed }' "$OUT/command-results.tsv"; then exit 0; else exit 1; fi
