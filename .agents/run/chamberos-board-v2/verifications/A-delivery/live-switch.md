# Live Release Cutover & Rollback Runbook (NOT Executed)

## 1. Current Production State (Read-Only Inspection)

- **Live Public URL:** `https://board.workflows.ac` -> container `http://127.0.0.1:8787`
- **Current Release Symlink:** `/workspace/releases/board/current` -> `/workspace/releases/board/98261a8-20261103`
- **Previous Release Directory Present:** `/workspace/releases/board/8b7e059-20261102`
- **Supervisor Script:** `/workspace/config/opencode/tools/board/supervisor.sh`
- **Start / Restart Helper:** `/workspace/config/opencode/tools/board/start.sh`
- **Runtime Data & PIDs:** `/workspace/.openchamber-data/board/` (`supervisor.pid`, `child.pid`, `board.log`, `sessions.json`)
- **Verified Staged Foundation Artifact:** `/tmp/opencode/board-v2-staging/ddfaa2c-foundation/` (commit `ddfaa2c` / `ddfaa2c92819e5851b2579065570630cf28609bd`)

No live files under `/workspace/releases/board/` or `/workspace/.openchamber-data/board/` were modified during this audit and preview preparation.

---

## 2. How the Board Supervisor Validates and Runs a Release

On every start and restart iteration, `/workspace/config/opencode/tools/board/supervisor.sh`:
1. Resolves `RELEASE_DIR="${BOARD_RELEASE_DIR:-/workspace/releases/board/current}"`.
2. Verifies that `checksums.sha256` exists, runs `(cd "$RELEASE_DIR" && sha256sum -c --strict checksums.sha256)`, and checks that zero unlisted files exist in `$RELEASE_DIR`.
3. Changes directory into `"$RELEASE_DIR"` (`cd "$RELEASE_DIR"`) and launches `node web/dist/server.mjs`.

Because `supervisor.sh` runs `cd "$RELEASE_DIR"` once when the supervisor process starts, **switching `/workspace/releases/board/current` requires restarting the supervisor via `/workspace/config/opencode/tools/board/start.sh`** (not merely sending `SIGTERM` to `child.pid`).

---

## 3. Cutover Procedure (When Approved by Human Reviewer)

Run the following commands only after human sign-off on the `ddfaa2c` preview:

```bash
# 1. Copy the verified staged release into /workspace/releases/board/
TARGET_RELEASE="/workspace/releases/board/ddfaa2c-20261106"
cp -a /tmp/opencode/board-v2-staging/ddfaa2c-foundation "$TARGET_RELEASE"

# 2. Verify strict SHA-256 manifest and zero unlisted files in the destination directory
(cd "$TARGET_RELEASE" && sha256sum -c --strict checksums.sha256)

# 3. Record current symlink target for rollback verification
readlink -f /workspace/releases/board/current
# Expected before switch: /workspace/releases/board/98261a8-20261103

# 4. Atomically repoint /workspace/releases/board/current to the new release
ln -sfn "$TARGET_RELEASE" /workspace/releases/board/current

# 5. Restart the board supervisor and child server cleanly
/workspace/config/opencode/tools/board/start.sh

# 6. Verify local and public health endpoints
curl -fsS http://127.0.0.1:8787/health
curl -fsS https://board.workflows.ac/health
```

### Optional Post-Cutover Cleanup of Preview Server

Once live cutover is verified, stop the isolated preview server on port `4041`:

```bash
if [ -f /tmp/opencode/board-v2-staging/ddfaa2c-state/preview.pid ]; then
  kill -TERM "$(cat /tmp/opencode/board-v2-staging/ddfaa2c-state/preview.pid)" 2>/dev/null || true
fi
```

---

## 4. Rollback Procedure (Target: `/workspace/releases/board/98261a8-20261103`)

If any issue is observed during or after cutover, roll back immediately to `/workspace/releases/board/98261a8-20261103`:

```bash
# 1. Verify rollback target checksums
(cd /workspace/releases/board/98261a8-20261103 && sha256sum -c --strict checksums.sha256)

# 2. Atomically repoint /workspace/releases/board/current back to 98261a8-20261103
ln -sfn /workspace/releases/board/98261a8-20261103 /workspace/releases/board/current

# 3. Restart the supervisor and child server
/workspace/config/opencode/tools/board/start.sh

# 4. Confirm health and log output
curl -fsS http://127.0.0.1:8787/health
tail -n 20 /workspace/.openchamber-data/board/board.log
```
